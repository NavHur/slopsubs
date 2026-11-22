// Reads tokens per task from AA's eval pages, whose embedded model records carry
// each eval's total token counts, and checks them against the model pages.

import { z } from "zod";
import { AA_EVAL_INDEX } from "./aa-eval-index";
import type { ModelReading } from "./aa-evals";
import { AA_EVAL_IDS } from "./enums";
import type { AaEvalId } from "./eval-units";
import { firstReading, flightRecords } from "./flight";

/** How far apart the weighted tokens and the index's output tokens may be,
 * relative to the index's, before the weights or task counts are taken to be
 * wrong. AA rounds the index's figure. */
const TOKEN_SUM_TOLERANCE = 1e-3;

/** A model's tokens per task for each eval its record has counts for. */
export type EvalTokens = Map<AaEvalId, number>;

const TokenCount = z.object({
	answer: z.number().nonnegative().nullish(),
	reasoning: z.number().nonnegative().nullish(),
});

/** An eval page's record: a model and its token counts across the evals. */
const EvalPageRecord = z.object({
	id: z.string().min(1),
	slug: z.string().min(1),
	canonicalEvalTokenCounts: z
		.record(z.string(), TokenCount.nullish())
		.nullish(),
});
type TokenCounts = z.infer<typeof EvalPageRecord>["canonicalEvalTokenCounts"];

/** Tokens per task for one eval; null when the record has no counts for it. */
function evalTokens(evalId: AaEvalId, counts: TokenCounts): number | null {
	const { tokenKey, tasks } = AA_EVAL_INDEX[evalId];
	const count = counts?.[tokenKey];
	if (typeof count?.answer !== "number") return null;
	if (typeof count.reasoning !== "number") return null;
	return (count.answer + count.reasoning) / tasks;
}

/** The record's raw answer and reasoning counts per eval, in `AA_EVAL_IDS`
 * order, so two pages' records compare whatever their keys' order or split. */
function rawCounts(counts: TokenCounts) {
	return AA_EVAL_IDS.map((evalId) => {
		const count = counts?.[AA_EVAL_INDEX[evalId].tokenKey];
		return [evalId, count?.answer ?? null, count?.reasoning ?? null];
	});
}

function recordTokens(counts: TokenCounts): EvalTokens {
	const tokens: EvalTokens = new Map();
	for (const evalId of AA_EVAL_IDS) {
		const perTask = evalTokens(evalId, counts);
		if (perTask !== null) tokens.set(evalId, perTask);
	}
	return tokens;
}

/**
 * Tokens per task for each model the eval pages' flights embed, by record id.
 * A record several pages embed must count the same on all of them.
 */
export function tokensByRecord(
	evalFlights: readonly string[],
): Map<string, EvalTokens> {
	const seen = new Map<string, string>();
	const byRecord = new Map<string, EvalTokens>();
	for (const raw of evalFlights.flatMap(flightRecords)) {
		const { id, slug, canonicalEvalTokenCounts } = EvalPageRecord.parse(raw);
		const tokens = recordTokens(canonicalEvalTokenCounts);
		if (
			firstReading(
				seen,
				slug,
				JSON.stringify(rawCounts(canonicalEvalTokenCounts)),
			)
		)
			byRecord.set(id, tokens);
	}
	return byRecord;
}

/** Throws unless the eval weights and task counts turn the model's token counts
 * into the output tokens per task AA's index reports. A model without counts
 * for every eval cannot be checked. */
export function checkTokenWeights(
	model: ModelReading,
	tokens: EvalTokens,
): void {
	if (model.indexOutputTokens === null || tokens.size < AA_EVAL_IDS.length)
		return;
	let weighted = 0;
	for (const [evalId, perTask] of tokens)
		weighted += perTask * AA_EVAL_INDEX[evalId].weight;
	if (
		Math.abs(weighted - model.indexOutputTokens) >
		model.indexOutputTokens * TOKEN_SUM_TOLERANCE
	)
		throw new Error(
			`The weighted tokens per task for ${model.slug} add up to ${Math.round(weighted)}, but AA's index output tokens are ${Math.round(model.indexOutputTokens)}`,
		);
}
