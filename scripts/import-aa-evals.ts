// Imports Artificial Analysis per-eval Intelligence Index scores, cost, tokens
// and time from a model page's Next.js flight payload into src/data/aa-evals.json.

import { readFile, writeFile } from "node:fs/promises";
import { BenchmarkDataset } from "../src/domain/model.ts";

const SOURCE = "https://artificialanalysis.ai/models/gemini-4-argon";
const ROOT = new URL("..", import.meta.url);
const OUTPUT = new URL("src/data/aa-evals.json", ROOT);

const EVAL_SLUGS: readonly string[] = [
	"aa-briefcase",
	"automationbench-aa",
	"terminalbench-4-0",
	"frontiercode-2-0",
	"omniscience",
	"gdp-pdf",
	"hle-diamond",
	"critpt-v2-hard",
	"terminal-bench-science",
];

/** Website release slugs the catalog files under another family. */
const FAMILY_ALIASES: Record<string, string> = {
	"qwen3-8-max-0902": "qwen3-8-max",
};

const CHUNK_MARKER = "__next_f.push([1,";
const EVALS_KEY = '"intelligenceIndexEvaluations":';
/** How far before an evals array its model's release and effort slugs sit. */
const LOOKBACK = 8000;
/** The longest evals array the scan will follow. */
const MAX_ARRAY_LENGTH = 20000;
const BRACKET_DELTA: Record<string, number> = { "[": 1, "]": -1 };

type CatalogModel = BenchmarkDataset["models"][number];

type EvalRow = {
	family: string;
	effort: string | null;
	eval: string;
	score: number;
	costPerTaskUsd: number | null;
	tokensPerTask: number | null;
	secondsPerTask: number | null;
};

type RawEval = {
	slug: string;
	score: number;
	outputTokensPerTask?: number;
	costPerTask?: number;
	timePerTask?: number;
};

function parseArgs(argv: string[]): { html?: string } {
	const args: { html?: string } = {};
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--html") args.html = argv[++i];
		else throw new Error(`Unknown argument ${argv[i]}`);
	}
	return args;
}

async function loadHtml(path: string | undefined): Promise<string> {
	if (path) return readFile(path, "utf8");
	const response = await fetch(SOURCE, {
		headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64)" },
	});
	if (!response.ok) throw new Error(`${SOURCE}: HTTP ${response.status}`);
	return response.text();
}

/** Index of the quote closing the string literal opened at `open`. */
function stringLiteralEnd(text: string, open: number): number {
	let i = open + 1;
	while (i < text.length && text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
	return i;
}

/** The string literal of the push chunk starting at `marker`, decoded. */
function decodeChunk(
	html: string,
	marker: number,
): { text: string; next: number } {
	const open = html.indexOf('"', marker);
	if (open < 0)
		throw new Error(`Flight chunk at offset ${marker} has no string literal`);
	const close = stringLiteralEnd(html, open);
	try {
		return { text: JSON.parse(html.slice(open, close + 1)), next: close + 1 };
	} catch (cause) {
		throw new Error(`Flight chunk at offset ${marker} is not a JSON string`, {
			cause,
		});
	}
}

/** Reconstructs the React Flight string from Next.js push chunks. */
function flightFromHtml(html: string): string {
	const chunks: string[] = [];
	let marker = html.indexOf(CHUNK_MARKER);
	while (marker >= 0) {
		const chunk = decodeChunk(html, marker);
		chunks.push(chunk.text);
		marker = html.indexOf(CHUNK_MARKER, chunk.next);
	}
	if (!chunks.length) throw new Error("No flight chunks found in model page");
	return chunks.join("");
}

/** End of the bracketed array starting at `start`, or -1 if it never closes. */
function arrayEnd(text: string, start: number): number {
	const limit = Math.min(text.length, start + MAX_ARRAY_LENGTH);
	let depth = 0;
	for (let i = start; i < limit; i++) {
		if (text[i] === '"') i = stringLiteralEnd(text, i);
		depth += BRACKET_DELTA[text[i]] ?? 0;
		if (depth === 0) return i + 1;
	}
	return -1;
}

function lastCapture(text: string, pattern: RegExp): string | null {
	const found = [...text.matchAll(pattern)].at(-1);
	return found ? found[1] : null;
}

function roundedOrNull(
	value: number | undefined,
	round: (value: number) => number,
): number | null {
	return typeof value === "number" ? round(value) : null;
}

function toRow(family: string, effort: string | null, e: RawEval): EvalRow {
	return {
		family,
		effort,
		eval: e.slug,
		score: e.score,
		costPerTaskUsd: roundedOrNull(e.costPerTask, (v) => Number(v.toFixed(5))),
		tokensPerTask: roundedOrNull(e.outputTokensPerTask, Math.round),
		secondsPerTask: roundedOrNull(e.timePerTask, (v) => Number(v.toFixed(1))),
	};
}

function parseEvals(raw: string, family: string): RawEval[] {
	try {
		return JSON.parse(raw);
	} catch (cause) {
		throw new Error(`Evals array for ${family} is not valid JSON`, { cause });
	}
}

/** The chart-eval rows of the evals array whose key sits at `keyIndex`. */
function rowsAt(flight: string, keyIndex: number): EvalRow[] {
	const before = flight.slice(Math.max(0, keyIndex - LOOKBACK), keyIndex);
	const family = lastCapture(before, /"release":\{"slug":"([^"]+)"/g);
	if (!family) return [];
	const effort = lastCapture(before, /"effort":\{"slug":"([^"]+)"/g);
	const start = keyIndex + EVALS_KEY.length;
	const end = arrayEnd(flight, start);
	if (end < 0)
		throw new Error(
			`Evals array for ${family} at offset ${start} does not close within ${MAX_ARRAY_LENGTH} characters`,
		);
	return parseEvals(flight.slice(start, end), family)
		.filter((e) => EVAL_SLUGS.includes(e.slug))
		.map((e) => toRow(family, effort, e));
}

/** Extracts per-model eval rows from the flight payload. */
function extractEvals(flight: string): EvalRow[] {
	return [...flight.matchAll(new RegExp(`${EVALS_KEY}\\[`, "g"))].flatMap(
		(found) => rowsAt(flight, found.index),
	);
}

async function loadCatalog(): Promise<Map<string, CatalogModel[]>> {
	const catalog = BenchmarkDataset.parse(
		JSON.parse(
			await readFile(new URL("src/data/benchmarks.json", ROOT), "utf8"),
		),
	);
	const byFamily = new Map<string, CatalogModel[]>();
	for (const m of catalog.models)
		byFamily.set(m.family, [...(byFamily.get(m.family) ?? []), m]);
	return byFamily;
}

/** The catalog model a website effort names; null when the catalog lacks it. */
function pickModel(
	candidates: CatalogModel[],
	effort: string | null,
	family: string,
): CatalogModel | null {
	if (effort !== null)
		return candidates.find((m) => m.effort === effort) ?? null;
	if (candidates.length === 1) return candidates[0];
	const fallback =
		candidates.find((m) => m.effort === "none") ??
		candidates.find((m) => m.effort === "default");
	if (!fallback) throw new Error(`Ambiguous null effort for ${family}`);
	return fallback;
}

type Skips = { families: Set<string>; efforts: Set<string> };

/** The row filed under the catalog's family and effort, or null if skipped. */
function resolveRow(
	r: EvalRow,
	byFamily: Map<string, CatalogModel[]>,
	skips: Skips,
): EvalRow | null {
	const family = FAMILY_ALIASES[r.family] ?? r.family;
	const candidates = byFamily.get(family);
	if (!candidates) {
		skips.families.add(r.family);
		return null;
	}
	const match = pickModel(candidates, r.effort, family);
	if (!match) {
		// The website carries efforts the catalog can't price; they skip the chart.
		skips.efforts.add(`${r.family} (${r.effort})`);
		return null;
	}
	return { ...r, family, effort: match.effort };
}

/** Resolves rows against the catalog, failing loud on duplicates. */
function resolveRows(raw: EvalRow[], byFamily: Map<string, CatalogModel[]>) {
	const skips: Skips = { families: new Set(), efforts: new Set() };
	const rows = new Map<string, EvalRow>();
	for (const r of raw) {
		const row = resolveRow(r, byFamily, skips);
		if (!row) continue;
		const key = `${row.family}@${row.effort}@${row.eval}`;
		if (rows.has(key)) throw new Error(`Two rows for ${key}`);
		rows.set(key, row);
	}
	return { rows: [...rows.values()], skips };
}

function logSummary(rows: EvalRow[], skips: Skips): void {
	const models = new Set(rows.map((r) => `${r.family}@${r.effort}`));
	console.log(
		`Wrote ${rows.length} eval rows for ${models.size} model variants`,
	);
	if (skips.families.size)
		console.log(`No catalog family for ${[...skips.families].join(", ")}`);
	if (skips.efforts.size)
		console.log(`No catalog effort for ${[...skips.efforts].join(", ")}`);
}

async function main() {
	const { html } = parseArgs(process.argv.slice(2));
	const raw = extractEvals(flightFromHtml(await loadHtml(html)));
	if (!raw.length) throw new Error("No eval rows extracted from website");
	const { rows, skips } = resolveRows(raw, await loadCatalog());
	if (!rows.length) throw new Error("No eval rows matched the catalog");
	const output = {
		fetchedAt: new Date().toISOString(),
		source: "Artificial Analysis website (model page flight payload)",
		evals: [...EVAL_SLUGS],
		rows,
	};
	await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
	logSummary(rows, skips);
}

await main();
