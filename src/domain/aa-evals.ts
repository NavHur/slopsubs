// Reads per-model Intelligence Index scores and cost out of AA model pages' Next.js
// flight payloads and files them under the catalog's families and efforts.

import { z } from "zod";
import { AA_EVAL_INDEX, isAaEvalId } from "./aa-eval-index";
import { AA_EVAL_IDS } from "./enums";
import type { AaEvalId } from "./eval-units";
import { firstReading, flightRecords, stringLiteralEnd } from "./flight";
import type { BenchmarkPoint, Effort } from "./model";
import { roundedOrNull } from "./rounding";

const COST_DECIMALS = 5;

/** Website release slugs the catalog files under another family. */
const FAMILY_ALIASES: Record<string, string> = {
	"qwen3-8-max-0902": "qwen3-8-max",
};

const CHUNK_MARKER = "__next_f.push([1,";

const Score = z.number().nullish();

/** The fields read from one model record: who it is, its eval scores, and the
 * index's cost, output tokens and time per task. */
const EvalRecord = z.object({
	id: z.string().min(1),
	slug: z.string().min(1),
	intelligenceIndexCostPerTask: z
		.object({
			cost: z.object({ total: z.number().nonnegative() }),
			evaluations: z.array(
				z.object({
					slug: z.string(),
					weightedCostPerTask: z.number().nonnegative(),
				}),
			),
		})
		.nullish(),
	intelligenceIndexOutputTokensPerTask: z
		.object({ output: z.number().nonnegative() })
		.nullish(),
	intelligenceIndexTimePerTask: z.number().nonnegative().nullish(),
	release: z.object({ slug: z.string().min(1) }),
	effort: z.object({ slug: z.string().min(1) }).nullish(),
	isReasoning: z.boolean(),
	briefcaseBreakdown: z
		.object({ overall: z.object({ elo: z.number() }) })
		.nullish(),
	automationBenchPartialScore: Score,
	terminalBench40: Score,
	frontierCode20: Score,
	omniscience: Score,
	gdpPdfAllPass: Score,
	hleDiamond: Score,
	critptAgenticHard: Score,
	terminalBenchScience: Score,
});
export type EvalRecord = z.infer<typeof EvalRecord>;

/** A website row. `effort` is the website's slug, `none` for an effortless model
 * that does not reason, and null for one that does. The model pages carry the
 * cost per task but no tokens or time, so those start null. */
export type EvalRow = {
	family: string;
	effort: string | null;
	eval: AaEvalId;
	score: number;
	costPerTaskUsd: number | null;
	tokensPerTask: number | null;
	secondsPerTask: number | null;
};

/** A website row filed under the catalog's family and effort. */
export type ResolvedRow = EvalRow & { effort: Effort };

/** The string literal of the push chunk starting at `marker`, decoded. */
function decodeChunk(
	html: string,
	marker: number,
): { text: string; next: number } {
	const open = marker + CHUNK_MARKER.length;
	if (html[open] !== '"')
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
export function flightFromHtml(html: string): string {
	const chunks: string[] = [];
	let marker = html.indexOf(CHUNK_MARKER);
	while (marker >= 0) {
		const chunk = decodeChunk(html, marker);
		chunks.push(chunk.text);
		marker = html.indexOf(CHUNK_MARKER, chunk.next);
	}
	if (!chunks.length) throw new Error("No flight chunks found in page");
	return chunks.join("");
}

/** A record's own effort slug: `none` for an effortless model that does not
 * reason; null for one that does, filed under its default or only reasoning variant. */
function recordEffort(record: EvalRecord): string | null {
	if (record.effort) return record.effort.slug;
	return record.isReasoning ? null : "none";
}

/** How far apart the record's weighted costs and its total may be, relative to
 * the total, before the index is taken to have changed. */
const COST_SUM_TOLERANCE = 1e-4;

/** The eval AA's cost entry is for. Throws on one the importer lacks a weight for. */
function costedEval(slug: string): AaEvalId {
	if (!isAaEvalId(slug))
		throw new Error(`AA's index costs an unknown eval: ${slug}`);
	return slug;
}

/** The record's cost per task for each eval it costs: AA's weighted cost over
 * the eval's weight in the index. Throws when the costs do not add up to the
 * record's index total, cover an eval the importer lacks a weight for, or cover
 * one eval twice. */
function recordCosts(record: EvalRecord): Map<AaEvalId, number> {
	const costs = new Map<AaEvalId, number>();
	const index = record.intelligenceIndexCostPerTask;
	if (!index) return costs;
	let weighted = 0;
	for (const { slug, weightedCostPerTask } of index.evaluations) {
		const evalId = costedEval(slug);
		if (costs.has(evalId))
			throw new Error(`AA's index costs ${slug} twice for ${record.slug}`);
		weighted += weightedCostPerTask;
		costs.set(evalId, weightedCostPerTask / AA_EVAL_INDEX[evalId].weight);
	}
	if (
		Math.abs(weighted - index.cost.total) >
		index.cost.total * COST_SUM_TOLERANCE
	)
		throw new Error(
			`The weighted costs for ${record.slug} add up to ${weighted}, but AA's index cost is ${index.cost.total}`,
		);
	return costs;
}

/** One row per eval the record has a score for. */
function recordRows(record: EvalRecord): EvalRow[] {
	const family = record.release.slug;
	const effort = recordEffort(record);
	const costs = recordCosts(record);
	return AA_EVAL_IDS.flatMap((id) => {
		const score = AA_EVAL_INDEX[id].score(record);
		if (score === null || score === undefined) return [];
		return [
			{
				family,
				effort,
				eval: id,
				score,
				costPerTaskUsd: roundedOrNull(costs.get(id), COST_DECIMALS),
				tokensPerTask: null,
				secondsPerTask: null,
			},
		];
	});
}

/** A model page's record, read: its eval rows, and the output speed (tokens per
 * second) that turns its tokens per task into time. */
export type ModelReading = {
	id: string;
	slug: string;
	rows: EvalRow[];
	outputSpeed: number | null;
	/** The index's output tokens per task, the sum of the evals' weighted tokens. */
	indexOutputTokens: number | null;
};

function outputSpeed(record: EvalRecord): number | null {
	const tokens = record.intelligenceIndexOutputTokensPerTask?.output;
	const seconds = record.intelligenceIndexTimePerTask;
	if (!tokens || !seconds) return null;
	const speed = tokens / seconds;
	if (!Number.isFinite(speed) || speed <= 0)
		throw new Error(`AA's index output speed for ${record.slug} is not usable`);
	return speed;
}

/**
 * Every model the flight payloads embed, each once. A model several pages
 * embed must read the same on all of them.
 */
export function readModels(flights: readonly string[]): ModelReading[] {
	const seen = new Map<string, string>();
	return flights.flatMap(flightRecords).flatMap((record) => {
		const parsed = EvalRecord.parse(record);
		const reading: ModelReading = {
			id: parsed.id,
			slug: parsed.slug,
			rows: recordRows(parsed),
			outputSpeed: outputSpeed(parsed),
			indexOutputTokens:
				parsed.intelligenceIndexOutputTokensPerTask?.output ?? null,
		};
		if (!firstReading(seen, parsed.slug, JSON.stringify(reading))) return [];
		return [reading];
	});
}

/** The catalog model a website effort names; null when the catalog lacks it.
 * A null effort is a reasoning model with no named effort. */
export function pickModel(
	candidates: BenchmarkPoint[],
	effort: string | null,
	family: string,
): BenchmarkPoint | null {
	if (effort !== null)
		return candidates.find((m) => m.effort === effort) ?? null;
	const [only, ...rest] = candidates;
	if (!rest.length) return only.effort === "none" ? null : only;
	const fallback = candidates.find((m) => m.effort === "default");
	if (!fallback) throw new Error(`Ambiguous null effort for ${family}`);
	return fallback;
}

/** Website rows the import skipped, and efforts it filed under a sole default. */
export type Skips = {
	families: Set<string>;
	efforts: Set<string>;
	mappedToDefault: Set<string>;
};

type Resolution = {
	byFamily: Map<string, BenchmarkPoint[]>;
	/** Each catalog family's distinct website efforts. */
	siteEfforts: Map<string, Set<string | null>>;
	skips: Skips;
};

const catalogFamily = (r: EvalRow) => FAMILY_ALIASES[r.family] ?? r.family;

/** The family's one default model, when the website lists it at one effort. */
function soleDefault(
	candidates: BenchmarkPoint[],
	siteEffortCount: number,
): BenchmarkPoint | null {
	const [only, ...rest] = candidates;
	return siteEffortCount === 1 && !rest.length && only.effort === "default"
		? only
		: null;
}

/** The row filed under the catalog's family and effort, or null if skipped. */
function resolveRow(r: EvalRow, resolution: Resolution): ResolvedRow | null {
	const { byFamily, skips } = resolution;
	const family = catalogFamily(r);
	const candidates = byFamily.get(family);
	if (!candidates) {
		skips.families.add(r.family);
		return null;
	}
	const exact = pickModel(candidates, r.effort, family);
	const siteEffortCount = resolution.siteEfforts.get(family)?.size ?? 0;
	const match = exact ?? soleDefault(candidates, siteEffortCount);
	if (!match) {
		// The website carries efforts the catalog can't price; they skip the chart.
		skips.efforts.add(`${r.family} (${r.effort ?? "reasoning"})`);
		return null;
	}
	if (!exact) skips.mappedToDefault.add(`${r.family} (${r.effort})`);
	return { ...r, family, effort: match.effort };
}

function siteEffortsOf(raw: EvalRow[]): Map<string, Set<string | null>> {
	const efforts = new Map<string, Set<string | null>>();
	for (const r of raw) {
		const family = catalogFamily(r);
		efforts.set(family, (efforts.get(family) ?? new Set()).add(r.effort));
	}
	return efforts;
}

/** The key a resolved row is unique by across the dataset. */
export const rowKey = (r: { family: string; effort: string; eval: string }) =>
	`${r.family}@${r.effort}@${r.eval}`;

/** Resolves rows against the catalog, failing loud on duplicates. */
export function resolveRows(
	raw: EvalRow[],
	byFamily: Map<string, BenchmarkPoint[]>,
) {
	const skips: Skips = {
		families: new Set(),
		efforts: new Set(),
		mappedToDefault: new Set(),
	};
	const resolution = { byFamily, siteEfforts: siteEffortsOf(raw), skips };
	const rows = new Map<string, ResolvedRow>();
	for (const r of raw) {
		const row = resolveRow(r, resolution);
		if (!row) continue;
		const key = rowKey(row);
		if (rows.has(key)) throw new Error(`Two rows for ${key}`);
		rows.set(key, row);
	}
	return { rows: [...rows.values()], skips };
}
