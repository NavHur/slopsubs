import { z } from "zod";
import { EFFORTS, type Effort } from "./model";

/**
 * Artificial Analysis' free data API gives the model list, Intelligence Index
 * scores, list prices and release dates, but not the cost or tokens per task
 * the chart's x axis needs. Slopalytics still supplies those, so the import
 * merges the two and refuses to write when they disagree.
 */

/** One model as Artificial Analysis' data API returns it. */
const AaModel = z.object({
	slug: z.string().min(1),
	name: z.string().min(1),
	release_date: z.string().min(1),
	model_creator: z.object({
		slug: z.string().min(1),
		name: z.string().min(1),
	}),
	evaluations: z.object({
		artificial_analysis_intelligence_index: z.number().nullable(),
	}),
	pricing: z.object({
		price_1m_input_tokens: z.number().nonnegative().nullable(),
		price_1m_output_tokens: z.number().nonnegative().nullable(),
	}),
});
export type AaModel = z.infer<typeof AaModel>;

/** The API wraps its rows in a status envelope the import ignores. */
export const AaResponse = z.object({ data: z.array(AaModel) });

/** The fields the import keeps from one slopalytics bundle point. */
const SlopaPointSchema = z.object({
	id: z.string().min(1),
	family: z.string().min(1),
	name: z.string().min(1),
	variant: z.string().min(1),
	lab: z.string().min(1),
	labName: z.string().min(1),
	released: z.string().min(1),
	open: z.boolean(),
	deprecated: z.boolean(),
	effort: z.enum(EFFORTS),
	effortLabel: z.string().min(1),
	effortOrder: z.number(),
	score: z.number().nullable(),
	costPerTaskUsd: z.number().nonnegative().nullable(),
	tokensPerTask: z.number().nullable(),
	secondsPerTask: z.number().nullable(),
	inputPricePerMTokUsd: z.number().nonnegative().nullable(),
	outputPricePerMTokUsd: z.number().nonnegative().nullable(),
});
export type SlopaPoint = z.infer<typeof SlopaPointSchema>;
export { SlopaPointSchema };

/**
 * Our id where Artificial Analysis now uses the same slug for another effort:
 * our mistral-large-4 point is AA's Preview, while AA gave the bare slug to
 * its High variant.
 */
export const AA_ALIASES: Record<string, string> = {
	"mistral-large-4": "mistral-large-4-preview",
};

/** Two sources rounding to one decimal still agree within this. */
export const SCORE_TOLERANCE = 0.06;

/** A per-token gap under a tenth of a cent can't move the cost chart. */
const PRICE_TOLERANCE = 0.001;

const round = (value: number | null, digits: number) =>
	value === null ? null : Number(value.toFixed(digits));

/** Whether two prices differ by more than rounding noise. */
const priceDiffers = (ours: number | null, theirs: number | null) =>
	ours !== null && theirs !== null && Math.abs(ours - theirs) > PRICE_TOLERANCE;

/** The effort a parenthesised name ends in, e.g. "(Max, Default Fallback)". */
const EFFORT_WORDS: Record<string, Effort> = Object.fromEntries(
	EFFORTS.map((effort) => [effort, effort]),
) as Record<string, Effort>;
EFFORT_WORDS["non-reasoning"] = "none";

/** The family and effort an AA-only model belongs to, or null if unreadable. */
export function deriveModel(model: Pick<AaModel, "slug" | "name">): {
	family: string;
	effort: Effort;
} | null {
	const word = /\(([^)]+)\)\s*$/
		.exec(model.name)?.[1]
		?.split(",")[0]
		?.trim()
		.toLowerCase();
	if (!word) return null;
	const effort = EFFORT_WORDS[word];
	if (!effort) return null;
	const suffix = effort === "none" ? "non-reasoning" : effort;
	const family = model.slug.endsWith(`-${suffix}`)
		? model.slug.slice(0, -suffix.length - 1)
		: model.slug;
	return { family, effort };
}

/** AA's name without the effort it already states separately. */
function displayName(name: string): string {
	return name.replace(/\s*\([^)]*\)\s*$/, "");
}

export type MergeOptions = {
	/** Families a plan covers, so an AA-only model is one that would ship. */
	coveredFamilies: ReadonlySet<string>;
	/** Write AA-only models with no cost data instead of refusing to run. */
	allowMissingCost?: boolean;
};

export type MergedCatalog = {
	models: SlopaPoint[];
	/** Disagreements that do not stop the import. */
	warnings: string[];
	/** AA-only points published without cost or token data. */
	missingCost: string[];
	/** AA models left out because no plan covers their family. */
	skipped: string[];
};

/**
 * Artificial Analysis wins on scores, prices and release dates; slopalytics
 * supplies cost, tokens and time. A score disagreement is an error, since it
 * means one side changed its benchmark. A price disagreement is only a
 * warning: AA's list price is what we plot, but a promo can explain the gap.
 */
export function mergeCatalog(
	aaModels: readonly AaModel[],
	slopaPoints: readonly SlopaPoint[],
	{ coveredFamilies, allowMissingCost = false }: MergeOptions,
): MergedCatalog {
	const aaById = new Map(aaModels.map((model) => [model.slug, model]));
	const warnings: string[] = [];
	const missingCost: string[] = [];
	const skipped: string[] = [];

	const models = slopaPoints.map((point) => {
		const aa = aaById.get(AA_ALIASES[point.id] ?? point.id);
		if (!aa) throw new Error(`AA has no model for ${point.id} (${point.name})`);

		const aaScore = aa.evaluations.artificial_analysis_intelligence_index;
		if (point.score !== null) {
			if (aaScore === null)
				throw new Error(
					`${point.id}: slopalytics scores ${point.score}, AA has no index`,
				);
			if (Math.abs(aaScore - point.score) > SCORE_TOLERANCE)
				throw new Error(
					`${point.id}: AA index ${aaScore}, slopalytics ${point.score}`,
				);
		}

		const input = aa.pricing.price_1m_input_tokens;
		const output = aa.pricing.price_1m_output_tokens;
		for (const [label, ours, theirs] of [
			["input", point.inputPricePerMTokUsd, input],
			["output", point.outputPricePerMTokUsd, output],
		] as const)
			if (priceDiffers(ours, theirs))
				warnings.push(
					`${point.id}: ${label} $${ours}/MTok on slopalytics, $${theirs} on AA; using AA`,
				);

		return {
			...point,
			released: aa.release_date,
			score: round(aaScore, 2),
			inputPricePerMTokUsd: input,
			outputPricePerMTokUsd: output,
		};
	});

	const effortOf = new Map(
		slopaPoints.map((point) => [
			point.effort,
			{ label: point.effortLabel, order: point.effortOrder },
		]),
	);
	const knownIds = new Set(slopaPoints.map((point) => point.id));
	/** AA slugs our own ids already claim through AA_ALIASES. */
	const claimedByAlias = new Set(Object.values(AA_ALIASES));

	for (const aa of aaModels) {
		if (knownIds.has(aa.slug) || claimedByAlias.has(aa.slug)) continue;
		const derived = deriveModel(aa);
		if (!derived || !coveredFamilies.has(derived.family)) {
			skipped.push(aa.slug);
			continue;
		}
		const effort = effortOf.get(derived.effort);
		if (!effort)
			throw new Error(`No effort label for ${aa.slug}'s ${derived.effort}`);
		const name = displayName(aa.name);
		models.push({
			id: aa.slug,
			family: derived.family,
			name,
			variant: name,
			lab: aa.model_creator.slug,
			labName: aa.model_creator.name,
			released: aa.release_date,
			open: false,
			deprecated: false,
			effort: derived.effort,
			effortLabel: effort.label,
			effortOrder: effort.order,
			score: round(aa.evaluations.artificial_analysis_intelligence_index, 2),
			costPerTaskUsd: null,
			tokensPerTask: null,
			secondsPerTask: null,
			inputPricePerMTokUsd: aa.pricing.price_1m_input_tokens,
			outputPricePerMTokUsd: aa.pricing.price_1m_output_tokens,
		});
		missingCost.push(aa.slug);
	}

	if (missingCost.length && !allowMissingCost)
		throw new Error(
			`AA lists ${missingCost.join(", ")} with no cost data from slopalytics. ` +
				"Update the bundle, or pass --allow-missing-cost to publish them as " +
				'"No cost data".',
		);

	return { models, warnings, missingCost, skipped };
}
