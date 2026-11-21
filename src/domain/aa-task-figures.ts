// Builds the AA eval dataset's rows from AA's model and eval pages: scores and
// cost per task from the model pages, tokens and time per task from the eval
// pages, and the last value read for any figure a page no longer carries.

import {
	checkTokenWeights,
	tokensByRecord,
	type EvalTokens,
} from "./aa-eval-tokens";
import {
	flightFromHtml,
	readModels,
	resolveRows,
	type EvalRow,
	type ModelReading,
	type ResolvedRow,
	type Skips,
} from "./aa-evals";
import type { BenchmarkPoint } from "./model";
import { roundedOrNull } from "./rounding";

const SECONDS_DECIMALS = 1;

/** A row of the dataset as it stands, whose figures a run may keep. */
type PriorRow = Pick<
	ResolvedRow,
	| "family"
	| "effort"
	| "eval"
	| "costPerTaskUsd"
	| "tokensPerTask"
	| "secondsPerTask"
>;

type ImportInput = {
	/** The HTML of AA's model pages. */
	modelPages: readonly string[];
	/** The HTML of AA's eval pages. */
	evalPages: readonly string[];
	byFamily: Map<string, BenchmarkPoint[]>;
	/** The rows the dataset holds now, for figures AA no longer publishes. */
	prior: readonly PriorRow[];
};

/** How many rows have each task figure fresh from AA, carried forward from the
 * prior dataset, or not at all. Tokens and time count as one figure. */
export type CarryReport = {
	costFresh: number;
	costCarried: number;
	figuresFresh: number;
	figuresCarried: number;
	withoutFigures: number;
};

type ImportResult = { rows: ResolvedRow[]; skips: Skips; carry: CarryReport };

/** The model's rows with the tokens and time its eval-page record gives them. */
function withTokensAndTime(
	model: ModelReading,
	tokens: EvalTokens | undefined,
): EvalRow[] {
	return model.rows.map((row) => {
		const perTask = tokens?.get(row.eval);
		if (perTask === undefined || model.outputSpeed === null) return row;
		const tokensPerTask = Math.round(perTask);
		return {
			...row,
			tokensPerTask,
			secondsPerTask: roundedOrNull(
				tokensPerTask / model.outputSpeed,
				SECONDS_DECIMALS,
			),
		};
	});
}

const rowKey = (r: { family: string; effort: string; eval: string }) =>
	`${r.family}@${r.effort}@${r.eval}`;

/** The row with any figure AA did not publish taken from `before`: the cost on
 * its own, tokens and time together. */
function carryRow(row: ResolvedRow, before: PriorRow | undefined): ResolvedRow {
	const pair = row.tokensPerTask === null ? before : row;
	return {
		...row,
		costPerTaskUsd: row.costPerTaskUsd ?? before?.costPerTaskUsd ?? null,
		tokensPerTask: pair?.tokensPerTask ?? null,
		secondsPerTask: pair?.secondsPerTask ?? null,
	};
}

const count = (
	rows: readonly ResolvedRow[],
	has: (r: ResolvedRow) => boolean,
) => rows.filter(has).length;
const hasCost = (r: ResolvedRow) => r.costPerTaskUsd !== null;
const hasTokens = (r: ResolvedRow) => r.tokensPerTask !== null;

function carryReport(
	fresh: readonly ResolvedRow[],
	carried: readonly ResolvedRow[],
): CarryReport {
	const costFresh = count(fresh, hasCost);
	const figuresFresh = count(fresh, hasTokens);
	return {
		costFresh,
		costCarried: count(carried, hasCost) - costFresh,
		figuresFresh,
		figuresCarried: count(carried, hasTokens) - figuresFresh,
		withoutFigures: count(carried, (r) => !hasCost(r) || !hasTokens(r)),
	};
}

/** Throws when a whole kind of figure is missing from a run: AA has moved its
 * pages again, which carrying figures forward must not hide. */
function checkSomethingFresh(carry: CarryReport): void {
	if (!carry.costFresh)
		throw new Error("AA's model pages gave no fresh cost for any row");
	if (!carry.figuresFresh)
		throw new Error("AA's eval pages gave no fresh tokens for any row");
}

export function importAaEvals(input: ImportInput): ImportResult {
	const tokens = tokensByRecord(input.evalPages.map(flightFromHtml));
	const models = readModels(input.modelPages.map(flightFromHtml));
	for (const model of models) {
		const counted = tokens.get(model.id);
		if (counted) checkTokenWeights(model, counted);
	}
	const raw = models.flatMap((model) =>
		withTokensAndTime(model, tokens.get(model.id)),
	);
	const { rows: fresh, skips } = resolveRows(raw, input.byFamily);
	if (!fresh.length) throw new Error("No eval rows matched the catalog");
	const prior = new Map(input.prior.map((r) => [rowKey(r), r]));
	const rows = fresh.map((row) => carryRow(row, prior.get(rowKey(row))));
	const carry = carryReport(fresh, rows);
	checkSomethingFresh(carry);
	return { rows, skips, carry };
}
