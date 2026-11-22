import { Schema } from "effect";
// Imports AA's per-eval Intelligence Index scores and task figures into
// src/data/aa-evals.json; a figure AA stops publishing keeps its prior value.

import { readFile, writeFile } from "node:fs/promises";
import type { Skips } from "../src/domain/aa-evals.ts";
import {
	importAaEvals,
	type CarryReport,
} from "../src/domain/aa-task-figures.ts";
import { AA_EVAL_IDS } from "../src/domain/enums.ts";
import { AaEvalsDataset, type AaEvalRow } from "../src/domain/model.ts";
import { parseArgs, summaryLine } from "./aa-eval-cli.ts";
import { aaPageSlugs, loadAaEvalPages, loadAaPages } from "./aa-page.ts";
import { loadCatalogByFamily } from "./catalog-by-family.ts";
import { PLAN_FAMILIES } from "./plan-families.ts";

const ROOT = new URL("..", import.meta.url);
const OUTPUT = new URL("src/data/aa-evals.json", ROOT);

/** The rows the file holds now; none when there is no file yet. */
async function readPriorRows(): Promise<AaEvalRow[]> {
	try {
		const text = await readFile(OUTPUT, "utf8");
		return Schema.decodeUnknownSync(AaEvalsDataset)(JSON.parse(text)).rows;
	} catch (cause) {
		const missing =
			cause instanceof Error && "code" in cause && cause.code === "ENOENT";
		if (!missing) throw cause;
		console.log(`No ${OUTPUT.pathname} yet: no figures to carry forward`);
		return [];
	}
}

function logSummary(
	rows: Parameters<typeof summaryLine>[0],
	skips: Skips,
): void {
	console.log(summaryLine(rows));
	if (skips.families.size)
		console.log(`No catalog family for ${[...skips.families].join(", ")}`);
	if (skips.efforts.size)
		console.log(`No catalog effort for ${[...skips.efforts].join(", ")}`);
	if (skips.mappedToDefault.size)
		console.log(
			`Mapped to the sole default variant: ${[...skips.mappedToDefault].join(", ")}`,
		);
}

function logCarry(carry: CarryReport): void {
	console.log(
		`Cost per task: ${carry.costFresh} rows fresh, ${carry.costCarried} carried forward`,
	);
	console.log(
		`Tokens and time per task: ${carry.figuresFresh} rows fresh, ${carry.figuresCarried} carried forward`,
	);
	if (carry.withoutFigures)
		console.log(
			`${carry.withoutFigures} rows have no cost, or no tokens and time, from any run`,
		);
}

async function main() {
	const { html, evalHtml } = parseArgs(process.argv.slice(2));
	const byFamily = await loadCatalogByFamily(ROOT);
	const covered = Object.values(PLAN_FAMILIES).flatMap((plan) => plan.families);
	const { rows, skips, carry } = importAaEvals({
		modelPages: await loadAaPages(
			aaPageSlugs(covered, [...byFamily.values()].flat()),
			html,
		),
		evalPages: await loadAaEvalPages(evalHtml),
		byFamily,
		prior: await readPriorRows(),
	});
	logSummary(rows, skips);
	logCarry(carry);
	const output = Schema.decodeUnknownSync(AaEvalsDataset)({
		fetchedAt: new Date().toISOString(),
		source: "Artificial Analysis website (model and eval page flight payloads)",
		evals: [...AA_EVAL_IDS],
		rows,
	});
	await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
}

await main();
