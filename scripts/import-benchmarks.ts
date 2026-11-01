// Merges AA (scores, prices, releases) and slopalytics (cost, tokens per task)
// into src/data/benchmarks.json; AA's site costs points slopalytics hasn't run.

import { readFile, writeFile } from "node:fs/promises";
import { flightFromHtml } from "../src/domain/aa-evals.ts";
import { extractIndexCosts } from "../src/domain/aa-index-cost.ts";
import {
	type AaModel,
	AaResponse,
	mergeCatalog,
	SlopaPoint,
} from "../src/domain/catalog.ts";
import { Plans } from "../src/domain/model.ts";
import { roundedOrNull } from "../src/domain/rounding.ts";
import { loadAaPage } from "./aa-page.ts";
import { extract, type Literal } from "./bundle-literal.ts";

const SITE = "https://slopalytics.com";
const AA_API = "https://artificialanalysis.ai/api/v2/data/llms/models";
const OUTPUT = new URL("../src/data/benchmarks.json", import.meta.url);
const PLANS = new URL("../src/data/plans.json", import.meta.url);

type Args = {
	bundle?: string;
	aa?: string;
	html?: string;
	allowMissingCost: boolean;
};

function parseArgs(argv: string[]): Args {
	const args: Args = { allowMissingCost: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--bundle") args.bundle = argv[++i];
		else if (arg === "--aa") args.aa = argv[++i];
		else if (arg === "--html") args.html = argv[++i];
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

async function main() {
	const args = parseArgs(process.argv.slice(2));
	const [bundle, aa, page] = await Promise.all([
		loadBundle(args.bundle),
		loadAa(args.aa),
		loadAaPage(args.html),
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
		siteCosts: extractIndexCosts(flightFromHtml(page)),
	});
	if (merged.missingCost.length && !args.allowMissingCost)
		throw new Error(
			`AA lists ${merged.missingCost.join(", ")} with no cost data from slopalytics or AA's site. ` +
				"Update the bundle, or pass --allow-missing-cost to publish them as " +
				'"No cost data".',
		);
	const output = {
		fetchedAt: new Date().toISOString(),
		source:
			"Artificial Analysis (scores, prices, releases); Slopalytics (cost and tokens per task), else AA's website",
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
