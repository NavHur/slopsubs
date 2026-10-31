// Imports per-model, per-effort benchmark points (Artificial Analysis data)
// from the slopalytics.com bundle into src/data/benchmarks.json.
// The bundle is untrusted: it is tokenized as a data literal, never executed.
// ceiling: depends on slopalytics' bundle shape; switch to the Artificial
// Analysis API once we hold a key.
//
// Usage: node scripts/import-benchmarks.ts [bundle.js]

import { readFile, writeFile } from "node:fs/promises";

const SITE = "https://slopalytics.com";
const OUTPUT = new URL("../src/data/benchmarks.json", import.meta.url);

type Literal =
	| null
	| boolean
	| number
	| string
	| Literal[]
	| { [key: string]: Literal };

async function loadBundle(path: string | undefined): Promise<string> {
	if (path) return readFile(path, "utf8");
	const html = await (await fetch(SITE)).text();
	const script = html.match(/\/assets\/index-[\w-]+\.js/)?.[0];
	if (!script) throw new Error(`No index bundle referenced from ${SITE}`);
	return (await fetch(SITE + script)).text();
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

const ROUND = (value: unknown, digits: number) =>
	typeof value === "number" ? Number(value.toFixed(digits)) : null;

// Slopalytics' "Code only" scores: Terminal-Bench 4.0 and FrontierCode 2.0,
// weighted equally, with the cost and tokens of running just those evals.
function codingScore(code: Literal | undefined) {
	if (!code || typeof code !== "object" || Array.isArray(code)) return null;
	return {
		score: ROUND(code.intelligence, 2),
		costPerTaskUsd: ROUND(code.cost, 5),
		tokensPerTask: ROUND(code.tokens, 0),
		secondsPerTask: ROUND(code.time, 1),
	};
}

async function main() {
	const bundle = await loadBundle(process.argv[2]);
	const dataset = extract(bundle, /=\{fetchedAt:/) as Record<string, Literal>;
	const frontier = extract(bundle, /=\{"gpt-6-astra":\{tier:/) as Record<
		string,
		Literal
	>;
	const models = (dataset.models as Record<string, Literal>[]).map((m) => ({
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
		score: ROUND(m.intelligence, 2),
		costPerTaskUsd: ROUND(m.cost, 5),
		tokensPerTask: ROUND(m.tokens, 0),
		secondsPerTask: ROUND(m.time, 1),
		inputPricePerMTokUsd: m.inputPrice,
		outputPricePerMTokUsd: m.outputPrice,
		coding: codingScore(m.code),
	}));
	const output = {
		fetchedAt: dataset.fetchedAt,
		source: "Artificial Analysis via slopalytics.com",
		frontier,
		models,
	};
	await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
	console.log(
		`Wrote ${models.length} benchmark points, ${Object.keys(frontier).length} frontier families`,
	);
}

await main();
