// Imports Artificial Analysis per-eval Intelligence Index scores from the
// plan-covered families' model pages into src/data/aa-evals.json, and stops
// when the pages lack the per-eval cost, tokens and time the file needs.

import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	extractEvals,
	flightFromHtml,
	resolveRows,
	type ResolvedRow,
	type Skips,
} from "../src/domain/aa-evals.ts";
import { AA_EVAL_IDS } from "../src/domain/enums.ts";
import { aaPageSlugs, loadAaPages } from "./aa-page.ts";
import { loadCatalogByFamily } from "./catalog-by-family.ts";
import { PLAN_FAMILIES } from "./plan-families.ts";

const ROOT = new URL("..", import.meta.url);
const OUTPUT = new URL("src/data/aa-evals.json", ROOT);
/** Where the fresh scores go when the import cannot write the whole file. */
const SCORES_OUTPUT = join(tmpdir(), "slopsubs-aa-eval-scores.json");

function parseArgs(argv: string[]): { html: string[] } {
	const args: { html: string[] } = { html: [] };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--html") args.html.push(...argv.slice(++i, i + 1));
		else throw new Error(`Unknown argument ${argv[i]}`);
	}
	return args;
}

function logSummary(rows: ResolvedRow[], skips: Skips): void {
	const models = new Set(rows.map((r) => `${r.family}@${r.effort}`));
	console.log(
		`Read ${rows.length} eval rows for ${models.size} model variants`,
	);
	if (skips.families.size)
		console.log(`No catalog family for ${[...skips.families].join(", ")}`);
	if (skips.efforts.size)
		console.log(`No catalog effort for ${[...skips.efforts].join(", ")}`);
	if (skips.mappedToDefault.size)
		console.log(
			`Mapped to the sole default variant: ${[...skips.mappedToDefault].join(", ")}`,
		);
}

/** A row the charts can't place: no cost, tokens or time per task. */
const lacksTaskFigures = (row: ResolvedRow) =>
	row.costPerTaskUsd === null ||
	row.tokensPerTask === null ||
	row.secondsPerTask === null;

async function main() {
	const { html } = parseArgs(process.argv.slice(2));
	const byFamily = await loadCatalogByFamily(ROOT);
	const covered = Object.values(PLAN_FAMILIES).flatMap((plan) => plan.families);
	const pages = await loadAaPages(
		aaPageSlugs(covered, [...byFamily.values()].flat()),
		html,
	);
	const raw = extractEvals(pages.map(flightFromHtml));
	if (!raw.length) throw new Error("No eval rows extracted from website");
	const { rows, skips } = resolveRows(raw, byFamily);
	if (!rows.length) throw new Error("No eval rows matched the catalog");
	logSummary(rows, skips);
	const incomplete = rows.filter(lacksTaskFigures).length;
	if (incomplete) {
		await writeFile(SCORES_OUTPUT, `${JSON.stringify(rows, null, 2)}\n`);
		throw new Error(
			`AA's model pages carry no per-eval cost, tokens or time for ${incomplete} of ${rows.length} rows, ` +
				`so src/data/aa-evals.json is unchanged. The fresh scores are in ${SCORES_OUTPUT}; ` +
				"patch the file by hand as docs/agents/data-refresh.md describes.",
		);
	}
	const output = {
		fetchedAt: new Date().toISOString(),
		source: "Artificial Analysis website (model page flight payload)",
		evals: [...AA_EVAL_IDS],
		rows,
	};
	await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
}

await main();
