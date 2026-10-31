// Imports Artificial Analysis Intelligence Index per-eval scores from the
// website (not the free data API, which omits cost/tokens/time per task).
// Fetches a model page, reconstructs the Next.js flight payload, and extracts
// each model's intelligenceIndexEvaluations (score, outputTokensPerTask,
// costPerTask, timePerTask) plus release slug and effort.
//
// Usage: bun scripts/import-aa-evals.ts [--html <page.html>]

import { readFile, writeFile } from "node:fs/promises";

const SOURCE = "https://artificialanalysis.ai/models/gemini-4-argon";
const OUTPUT = new URL("../src/data/aa-evals.json", import.meta.url);

const EVAL_SLUGS = [
	"aa-briefcase",
	"automationbench-aa",
	"terminalbench-4-0",
	"frontiercode-2-0",
	"omniscience",
	"gdp-pdf",
	"hle-diamond",
	"critpt-v2-hard",
	"terminal-bench-science",
] as const;

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

/** Reconstructs the React Flight string from Next.js push chunks. */
function flightFromHtml(html: string): string {
	let flight = "";
	let count = 0;
	let idx = 0;
	const marker = "__next_f.push([1,";
	while (true) {
		const p = html.indexOf(marker, idx);
		if (p < 0) break;
		const q1 = html.indexOf('"', p);
		if (q1 < 0) break;
		let i = q1 + 1;
		let esc = false;
		while (i < html.length) {
			const c = html[i];
			if (esc) esc = false;
			else if (c === "\\") esc = true;
			else if (c === '"') break;
			i++;
		}
		const quoted = html.slice(q1, i + 1);
		try {
			flight += JSON.parse(quoted);
			count++;
		} catch {
			// skip bad chunk
		}
		idx = i + 1;
	}
	if (!count) throw new Error("No flight chunks found in model page");
	return flight;
}

type EvalRow = {
	family: string;
	effort: string | null;
	eval: string;
	score: number;
	costPerTaskUsd: number | null;
	tokensPerTask: number | null;
	secondsPerTask: number | null;
};

/** Extracts per-model eval rows from the flight payload. */
function extractEvals(flight: string): EvalRow[] {
	const rows: EvalRow[] = [];
	const pat = /"intelligenceIndexEvaluations":\[/g;
	let m: RegExpExecArray | null;
	while ((m = pat.exec(flight))) {
		const back = flight.slice(Math.max(0, m.index - 8000), m.index);
		const rels = [...back.matchAll(/"release":\{"slug":"([^"]+)"/g)];
		if (!rels.length) continue;
		const family = rels[rels.length - 1][1];
		const effs = [...back.matchAll(/"effort":\{"slug":"([^"]+)"/g)];
		const effort = effs.length ? effs[effs.length - 1][1] : null;
		// Find balanced array starting at m.index + len(key)+1 (the '[')
		const start = m.index + '"intelligenceIndexEvaluations":'.length;
		let depth = 0;
		let inStr = false;
		let esc = false;
		let end = -1;
		for (let i = start; i < flight.length && i < start + 20000; i++) {
			const c = flight[i];
			if (inStr) {
				if (esc) esc = false;
				else if (c === "\\") esc = true;
				else if (c === '"') inStr = false;
			} else {
				if (c === '"') inStr = true;
				else if (c === "[") depth++;
				else if (c === "]") {
					depth--;
					if (depth === 0) {
						end = i + 1;
						break;
					}
				}
			}
		}
		if (end < 0) continue;
		const raw = flight.slice(start, end);
		if (raw === "[]") continue;
		let evals: Array<{
			slug: string;
			score: number;
			outputTokensPerTask: number;
			costPerTask: number;
			timePerTask: number;
		}>;
		try {
			evals = JSON.parse(raw);
		} catch {
			continue;
		}
		for (const e of evals) {
			if (!(EVAL_SLUGS as readonly string[]).includes(e.slug)) continue;
			rows.push({
				family,
				effort,
				eval: e.slug,
				score: e.score,
				costPerTaskUsd:
					typeof e.costPerTask === "number"
						? Number(e.costPerTask.toFixed(5))
						: null,
				tokensPerTask:
					typeof e.outputTokensPerTask === "number"
						? Math.round(e.outputTokensPerTask)
						: null,
				secondsPerTask:
					typeof e.timePerTask === "number"
						? Number(e.timePerTask.toFixed(1))
						: null,
			});
		}
	}
	return rows;
}

async function main() {
	const { html } = parseArgs(process.argv.slice(2));
	const page = await loadHtml(html);
	const flight = flightFromHtml(page);
	const raw = extractEvals(flight);
	if (!raw.length) throw new Error("No eval rows extracted from website");

	// Resolve website (release slug, effort) against the catalog, failing loud
	// on plan families and skipping the rest (they never reach the chart).
	const { BenchmarkDataset } = await import("../src/domain/model.ts");
	const ROOT = new URL("..", import.meta.url);
	const catalog = BenchmarkDataset.parse(
		JSON.parse(
			await readFile(new URL("src/data/benchmarks.json", ROOT), "utf8"),
		),
	);
	const byFamily = new Map<string, typeof catalog.models>();
	for (const m of catalog.models) {
		const list = byFamily.get(m.family) ?? [];
		list.push(m);
		byFamily.set(m.family, list);
	}
	const FAMILY_ALIASES: Record<string, string> = {
		"qwen3-8-max-0902": "qwen3-8-max",
	};
	const rows = [];
	const skippedFamilies = new Set<string>();
	const skippedEfforts = new Set<string>();
	const seen = new Set<string>();
	for (const r of raw) {
		const family = FAMILY_ALIASES[r.family] ?? r.family;
		const candidates = byFamily.get(family);
		if (!candidates) {
			skippedFamilies.add(r.family);
			continue;
		}
		let match;
		if (r.effort !== null) {
			match = candidates.find((m) => m.effort === r.effort);
			if (!match) {
				// Website carries variants the catalog lacks (e.g. newer efforts);
				// they can't be priced, so they never reach the chart.
				skippedEfforts.add(`${r.family} (${r.effort})`);
				continue;
			}
		} else if (candidates.length === 1) {
			match = candidates[0];
		} else {
			match =
				candidates.find((m) => m.effort === "none") ??
				candidates.find((m) => m.effort === "default");
			if (!match) throw new Error(`Ambiguous null effort for ${family}`);
		}
		const key = `${family}@${match.effort}@${r.eval}`;
		if (seen.has(key)) throw new Error(`Two rows for ${key}`);
		seen.add(key);
		rows.push({
			family,
			effort: match.effort,
			eval: r.eval,
			score: r.score,
			costPerTaskUsd: r.costPerTaskUsd,
			tokensPerTask: r.tokensPerTask,
			secondsPerTask: r.secondsPerTask,
		});
	}
	if (!rows.length) throw new Error("No eval rows matched the catalog");
	const output = {
		fetchedAt: new Date().toISOString(),
		source: "Artificial Analysis website (model page flight payload)",
		evals: [...EVAL_SLUGS],
		rows,
	};
	await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
	const models = new Set(rows.map((r) => `${r.family}@${r.effort}`));
	console.log(
		`Wrote ${rows.length} eval rows for ${models.size} model variants`,
	);
	if (skippedFamilies.size)
		console.log(`No catalog family for ${[...skippedFamilies].join(", ")}`);
	if (skippedEfforts.size)
		console.log(`No catalog effort for ${[...skippedEfforts].join(", ")}`);
}

await main();
