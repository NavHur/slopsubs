// Merges Artificial Analysis (scores, prices, releases) with slopalytics (cost
// and tokens per task) into src/data/benchmarks.json.

import { readFile, writeFile } from "node:fs/promises";
import {
	type AaModel,
	AaResponse,
	mergeCatalog,
	SlopaPoint,
} from "../src/domain/catalog.ts";
import { Plans } from "../src/domain/model.ts";
import { roundedOrNull } from "../src/domain/rounding.ts";

const SITE = "https://slopalytics.com";
const AA_API = "https://artificialanalysis.ai/api/v2/data/llms/models";
const OUTPUT = new URL("../src/data/benchmarks.json", import.meta.url);
const PLANS = new URL("../src/data/plans.json", import.meta.url);

type Literal =
	| null
	| boolean
	| number
	| string
	| Literal[]
	| { [key: string]: Literal };

type Args = {
	bundle?: string;
	aa?: string;
	allowMissingCost: boolean;
};

function parseArgs(argv: string[]): Args {
	const args: Args = { allowMissingCost: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--bundle") args.bundle = argv[++i];
		else if (arg === "--aa") args.aa = argv[++i];
		else if (arg === "--allow-missing-cost") args.allowMissingCost = true;
		else throw new Error(`Unknown argument ${arg}`);
	}
	return args;
}

async function loadBundle(path: string | undefined): Promise<string> {
	if (path) return readFile(path, "utf8");
	const html = await (await fetch(SITE)).text();
	const script = html.match(/\/assets\/index-[\w-]+\.js/)?.[0];
	if (!script) throw new Error(`No index bundle referenced from ${SITE}`);
	return (await fetch(SITE + script)).text();
}

/** AA's rows, from a cached response or one request with the API key. */
async function loadAa(path: string | undefined): Promise<AaModel[]> {
	if (path)
		return AaResponse.parse(JSON.parse(await readFile(path, "utf8"))).data;
	const key = process.env.AA_API_KEY;
	if (!key)
		throw new Error(
			"Set AA_API_KEY in .env.local (bun loads it), or pass --aa <models.json>",
		);
	const response = await fetch(AA_API, { headers: { "x-api-key": key } });
	if (!response.ok) throw new Error(`${AA_API}: HTTP ${response.status}`);
	return AaResponse.parse(await response.json()).data;
}

function balancedEnd(source: string, start: number): number {
	const open = source[start];
	const close = open === "{" ? "}" : "]";
	let depth = 0;
	let quote: string | null = null;
	for (let i = start; i < source.length; i++) {
		const ch = source[i];
		if (quote) {
			if (ch === "\\") i++;
			else if (ch === quote) quote = null;
			continue;
		}
		if (ch === "`" || ch === '"' || ch === "'") quote = ch;
		else if (ch === open) depth++;
		else if (ch === close && --depth === 0) return i + 1;
	}
	throw new Error(`Unbalanced literal starting at ${start}`);
}

// Rewrites a minified JS data literal (bare keys, backtick strings, !0/!1,
// .5 and 1e6 numbers) as JSON.
function literalToJson(literal: string): string {
	const token =
		/`([^`$\\]*)`|"((?:[^"\\]|\\.)*)"|!0|!1|([A-Za-z_$][\w$]*)(?=\s*:)|(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)|[\s\S]/g;
	return literal.replace(token, (match, backtick, quoted, key, number) => {
		if (backtick !== undefined) return JSON.stringify(backtick);
		if (quoted !== undefined) return match;
		if (match === "!0") return "true";
		if (match === "!1") return "false";
		if (key !== undefined) return JSON.stringify(key);
		if (number !== undefined) return String(Number(number));
		return match;
	});
}

function extract(source: string, anchor: RegExp): Literal {
	const found = anchor.exec(source);
	if (!found) throw new Error(`Anchor ${anchor} not found in bundle`);
	const start = found.index + found[0].indexOf("{");
	return JSON.parse(
		literalToJson(source.slice(start, balancedEnd(source, start))),
	);
}

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const [bundle, aa] = await Promise.all([
		loadBundle(args.bundle),
		loadAa(args.aa),
	]);
	const dataset = extract(bundle, /=\{fetchedAt:/) as Record<string, Literal>;
	const frontier = extract(bundle, /=\{"gpt-6-astra":\{tier:/) as Record<
		string,
		Literal
	>;
	const slopa = SlopaPoint.array().parse(
		(dataset.models as Record<string, Literal>[]).map((m) => ({
			id: m.id,
			family: m.family,
			name: m.name,
			variant: m.variant,
			lab: m.lab,
			labName: m.labName,
			released: m.released,
			open: m.open,
			deprecated: m.deprecated,
			effort: m.effort,
			effortLabel: m.effortLabel,
			effortOrder: m.effortOrder,
			score: roundedOrNull(m.intelligence, 2),
			costPerTaskUsd: roundedOrNull(m.cost, 5),
			tokensPerTask: roundedOrNull(m.tokens, 0),
			secondsPerTask: roundedOrNull(m.time, 1),
			inputPricePerMTokUsd: m.inputPrice,
			outputPricePerMTokUsd: m.outputPrice,
		})),
	);
	const plans = Plans.parse(JSON.parse(await readFile(PLANS, "utf8")));
	const merged = mergeCatalog(aa, slopa, {
		coveredFamilies: new Set(plans.flatMap((plan) => plan.families)),
	});
	if (merged.missingCost.length && !args.allowMissingCost)
		throw new Error(
			`AA lists ${merged.missingCost.join(", ")} with no cost data from slopalytics. ` +
				"Update the bundle, or pass --allow-missing-cost to publish them as " +
				'"No cost data".',
		);
	const output = {
		fetchedAt: new Date().toISOString(),
		source:
			"Artificial Analysis (scores, prices, releases); Slopalytics (cost and tokens per task)",
		frontier,
		models: merged.models,
	};
	await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
	console.log(
		`Wrote ${merged.models.length} benchmark points, ${Object.keys(frontier).length} frontier families`,
	);
	if (merged.skipped.length)
		console.log(
			`Left out ${merged.skipped.length} AA models no plan covers: ${merged.skipped.join(", ")}`,
		);
	for (const warning of merged.warnings) console.warn(`warning: ${warning}`);
	if (merged.missingCost.length)
		console.warn(`No cost data yet: ${merged.missingCost.join(", ")}`);
}

await main();
