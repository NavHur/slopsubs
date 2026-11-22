// Imports AA's per-eval Intelligence Index scores and task figures into
// src/data/aa-evals.json; a figure AA stops publishing keeps its prior value.

import { Clock, Effect, Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import type { Skips } from "../src/domain/aa-evals.ts";
import {
	importAaEvals,
	type CarryReport,
} from "../src/domain/aa-task-figures.ts";
import { AA_EVAL_IDS } from "../src/domain/enums.ts";
import { AaEvalsDataset } from "../src/domain/model.ts";
import { parseArgs, summaryLine } from "./aa-eval-cli.ts";
import {
	aaPageSlugs,
	loadAaEvalPages,
	loadAaPages,
	readAaPayload,
} from "./aa-page.ts";
import { loadCatalogByFamily } from "./catalog-by-family.ts";
import { readJsonFile, TextFiles } from "./effects/files.ts";
import { PLAN_FAMILIES } from "./plan-families.ts";

const ROOT = new URL("..", import.meta.url);
const OUTPUT = new URL("src/data/aa-evals.json", ROOT);

/** The rows the file holds now; none when there is no file yet. */
const readPriorRows = readJsonFile(AaEvalsDataset, OUTPUT).pipe(
	Effect.map(({ rows }) => rows),
	Effect.catchTag("FileReadError", (error) => {
		const cause = error.cause;
		if (!(cause instanceof Error && "code" in cause && cause.code === "ENOENT"))
			return Effect.fail(error);
		console.log(`No ${OUTPUT.pathname} yet: no figures to carry forward`);
		return Effect.succeed([]);
	}),
);

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

const main = Effect.gen(function* () {
	const files = yield* TextFiles;
	const { html, evalHtml } = parseArgs(process.argv.slice(2));
	const byFamily = yield* loadCatalogByFamily(ROOT);
	const covered = Object.values(PLAN_FAMILIES).flatMap((plan) => plan.families);
	const modelPages = yield* loadAaPages(
		aaPageSlugs(covered, [...byFamily.values()].flat()),
		html,
	);
	const evalPages = yield* loadAaEvalPages(evalHtml);
	const prior = yield* readPriorRows;
	const { rows, skips, carry } = yield* readAaPayload(() =>
		importAaEvals({ modelPages, evalPages, byFamily, prior }),
	);
	logSummary(rows, skips);
	logCarry(carry);
	const output = yield* Schema.decodeUnknownEffect(AaEvalsDataset)({
		fetchedAt: new Date(yield* Clock.currentTimeMillis).toISOString(),
		source: "Artificial Analysis website (model and eval page flight payloads)",
		evals: [...AA_EVAL_IDS],
		rows,
	});
	yield* files.write(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
});

await Effect.runPromise(
	main.pipe(
		Effect.provide(Layer.mergeAll(TextFiles.layer, FetchHttpClient.layer)),
	),
);
