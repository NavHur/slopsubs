import { z } from "zod";
import type { TaskCost } from "./aa-index-cost";
import { EFFORTS, type Effort } from "./model";
import { roundedOrNull } from "./rounding";

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
export const SlopaPoint = z.object({
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
export type SlopaPoint = z.infer<typeof SlopaPoint>;

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

/** A gap under a tenth of a cent per million tokens can't move the cost chart. */
const PRICE_TOLERANCE = 0.001;

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
	/** AA's own cost per task by slug, for points slopalytics hasn't costed. */
	siteCosts: ReadonlyMap<string, TaskCost>;
};

export type MergedCatalog = {
	models: SlopaPoint[];
	/** Disagreements that do not stop the import. */
	warnings: string[];
	/** AA-only points published without cost data from either source. */
	missingCost: string[];
	/** AA models left out because no plan covers their family. */
	skipped: string[];
};

type EffortLabel = { label: string; order: number };

/** Throws when the two sources disagree on a point's Intelligence Index. */
function checkScore(point: SlopaPoint, aaScore: number | null): void {
	if (point.score === null) return;
	if (aaScore === null)
		throw new Error(
			`${point.id}: slopalytics scores ${point.score}, AA has no index`,
		);
	if (Math.abs(aaScore - point.score) > SCORE_TOLERANCE)
		throw new Error(
			`${point.id}: AA index ${aaScore}, slopalytics ${point.score}`,
		);
}

/** One warning per price AA and slopalytics disagree on. */
function priceWarnings(point: SlopaPoint, aa: AaModel): string[] {
	const prices: [string, number | null, number | null][] = [
		["input", point.inputPricePerMTokUsd, aa.pricing.price_1m_input_tokens],
		["output", point.outputPricePerMTokUsd, aa.pricing.price_1m_output_tokens],
	];
	return prices
		.filter(([, ours, theirs]) => priceDiffers(ours, theirs))
		.map(
			([label, ours, theirs]) =>
				`${point.id}: ${label} $${ours}/MTok on slopalytics, $${theirs} on AA; using AA`,
		);
}

/** A slopalytics point carrying AA's score, prices and release date, and
 * AA's own cost when slopalytics has none. */
function mergePoint(
	point: SlopaPoint,
	aaById: ReadonlyMap<string, AaModel>,
	siteCosts: ReadonlyMap<string, TaskCost>,
	warnings: string[],
): SlopaPoint {
	const slug = AA_ALIASES[point.id] ?? point.id;
	const aa = aaById.get(slug);
	if (!aa) throw new Error(`AA has no model for ${point.id} (${point.name})`);
	const aaScore = aa.evaluations.artificial_analysis_intelligence_index;
	checkScore(point, aaScore);
	warnings.push(...priceWarnings(point, aa));
	const siteCost = point.costPerTaskUsd === null ? siteCosts.get(slug) : null;
	return {
		...point,
		...siteCost,
		released: aa.release_date,
		score: roundedOrNull(aaScore, 2),
		inputPricePerMTokUsd: aa.pricing.price_1m_input_tokens,
		outputPricePerMTokUsd: aa.pricing.price_1m_output_tokens,
	};
}

/** Whether a plan covers the family this slug is, or is a variant of. */
function inCoveredFamily(slug: string, covered: ReadonlySet<string>): boolean {
	return (
		covered.has(slug) || [...covered].some((f) => slug.startsWith(`${f}-`))
	);
}

/** An AA-only model as a point, with AA's own cost when it has one. */
function aaOnlyPoint(
	aa: AaModel,
	derived: { family: string; effort: Effort },
	effortOf: ReadonlyMap<Effort, EffortLabel>,
	siteCost: TaskCost | undefined,
): SlopaPoint {
	const effort = effortOf.get(derived.effort);
	if (!effort)
		throw new Error(`No effort label for ${aa.slug}'s ${derived.effort}`);
	const name = displayName(aa.name);
	return {
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
		score: roundedOrNull(
			aa.evaluations.artificial_analysis_intelligence_index,
			2,
		),
		costPerTaskUsd: null,
		tokensPerTask: null,
		secondsPerTask: null,
		...siteCost,
		inputPricePerMTokUsd: aa.pricing.price_1m_input_tokens,
		outputPricePerMTokUsd: aa.pricing.price_1m_output_tokens,
	};
}

/**
 * The point for an AA-only model, or null when no plan covers its family.
 * A covered family's model with no readable effort stops the import.
 */
function aaOnlyModel(
	aa: AaModel,
	{ coveredFamilies, siteCosts }: MergeOptions,
	effortOf: ReadonlyMap<Effort, EffortLabel>,
): SlopaPoint | null {
	const derived = deriveModel(aa);
	if (!derived) {
		if (inCoveredFamily(aa.slug, coveredFamilies))
			throw new Error(
				`AA's ${aa.slug} (${aa.name}) is in a family a plan covers, but cannot read an effort from its name`,
			);
		return null;
	}
	return coveredFamilies.has(derived.family)
		? aaOnlyPoint(aa, derived, effortOf, siteCosts.get(aa.slug))
		: null;
}

/**
 * Artificial Analysis wins on scores, prices and release dates; slopalytics
 * supplies cost, tokens and time, and AA's website fills them in for points
 * slopalytics hasn't costed. A score disagreement is an error, since it
 * means one side changed its benchmark. A price disagreement is only a
 * warning: AA's list price is what we plot, but a promo can explain the gap.
 */
export function mergeCatalog(
	aaModels: readonly AaModel[],
	slopaPoints: readonly SlopaPoint[],
	options: MergeOptions,
): MergedCatalog {
	const aaById = new Map(aaModels.map((model) => [model.slug, model]));
	const warnings: string[] = [];
	const missingCost: string[] = [];
	const skipped: string[] = [];
	const models = slopaPoints.map((point) =>
		mergePoint(point, aaById, options.siteCosts, warnings),
	);

	const effortOf = new Map(
		slopaPoints.map((point) => [
			point.effort,
			{ label: point.effortLabel, order: point.effortOrder },
		]),
	);
	const known = new Set([
		...slopaPoints.map((point) => point.id),
		...Object.values(AA_ALIASES),
	]);
	for (const aa of aaModels.filter((model) => !known.has(model.slug))) {
		const added = aaOnlyModel(aa, options, effortOf);
		if (!added) {
			skipped.push(aa.slug);
			continue;
		}
		models.push(added);
		if (added.costPerTaskUsd === null) missingCost.push(aa.slug);
	}

	return { models, warnings, missingCost, skipped };
}
