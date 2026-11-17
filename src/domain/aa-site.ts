// Reads an AA model page's flight payload: each model's score, prices and
// release date, and the cost, tokens and time per task of those AA has run.

import { z } from "zod";
import { firstReading, flightRecords } from "./flight";
import { roundedOrNull } from "./rounding";

/** What one Intelligence Index task costs a model, at AA's prices. */
export type TaskCost = {
	costPerTaskUsd: number;
	tokensPerTask: number | null;
	secondsPerTask: number | null;
};

/** The fields read from one model record; the page carries many more. */
const SiteModel = z.object({
	slug: z.string().min(1),
	name: z.string().min(1),
	releaseDate: z.string().min(1),
	creator: z.object({ slug: z.string().min(1), name: z.string().min(1) }),
	chartDefaultSelected: z.boolean(),
	intelligenceIndex: z.number().nullable(),
	price1mInputTokens: z.number().nonnegative().nullable(),
	price1mOutputTokens: z.number().nonnegative().nullable(),
	intelligenceIndexCostPerTask: z
		.object({ cost: z.object({ total: z.number().nonnegative() }) })
		.nullish(),
	intelligenceIndexOutputTokensPerTask: z
		.object({ output: z.number() })
		.nullish(),
	intelligenceIndexTimePerTask: z.number().nullish(),
});
type SiteModel = z.infer<typeof SiteModel>;

/** One model AA lists, as the catalog merge reads it. */
export type AaModel = Pick<
	SiteModel,
	| "slug"
	| "name"
	| "releaseDate"
	| "creator"
	| "intelligenceIndex"
	| "price1mInputTokens"
	| "price1mOutputTokens"
>;

/** What the import reads from AA's site. */
export type AaSite = {
	models: AaModel[];
	/** Task cost by AA slug, for the models AA has costed. */
	costs: Map<string, TaskCost>;
};

function taskCost(model: SiteModel): TaskCost | null {
	const cost = model.intelligenceIndexCostPerTask?.cost.total;
	if (cost === undefined) return null;
	return {
		costPerTaskUsd: Number(cost.toFixed(5)),
		tokensPerTask: roundedOrNull(
			model.intelligenceIndexOutputTokensPerTask?.output,
			0,
		),
		secondsPerTask: roundedOrNull(model.intelligenceIndexTimePerTask, 1),
	};
}

function aaModel(model: SiteModel): AaModel {
	return {
		slug: model.slug,
		name: model.name,
		releaseDate: model.releaseDate,
		creator: { slug: model.creator.slug, name: model.creator.name },
		intelligenceIndex: model.intelligenceIndex,
		price1mInputTokens: roundedOrNull(model.price1mInputTokens, 6),
		price1mOutputTokens: roundedOrNull(model.price1mOutputTokens, 6),
	};
}

/**
 * Every model record on the page. Throws when the page has no model records,
 * or carries only AA's default chart selection, which a model in it gets
 * instead of every model.
 */
function pageRecords(flight: string): SiteModel[] {
	const records = flightRecords(flight).map((record) =>
		SiteModel.parse(record),
	);
	if (!records.length) throw new Error("No model records in the page");
	if (records.every((model) => model.chartDefaultSelected))
		throw new Error(
			"The page lists only AA's default chart selection; read a model page outside it",
		);
	return records;
}

/**
 * Every model on the page, and each costed model's task cost. Throws when
 * the page lists a model twice, or when `pageRecords` rejects the page.
 */
export function readAaSite(flight: string): AaSite {
	const records = pageRecords(flight);
	const costs = new Map<string, TaskCost>();
	const slugs = new Set<string>();
	for (const model of records) {
		if (slugs.has(model.slug))
			throw new Error(`The page lists ${model.slug} twice`);
		slugs.add(model.slug);
		const cost = taskCost(model);
		if (cost) costs.set(model.slug, cost);
	}
	return { models: records.map(aaModel), costs };
}

/** One site's model and cost, compared across pages. */
const recordKey = (site: AaSite, model: AaModel) =>
	JSON.stringify([model, site.costs.get(model.slug) ?? null]);

/**
 * Every model on any of the pages, each once. A model several pages embed must
 * read the same on all of them; a mismatch stops the import.
 */
export function joinAaSites(sites: readonly AaSite[]): AaSite {
	const seen = new Map<string, string>();
	const joined: AaSite = { models: [], costs: new Map() };
	const listed = sites.flatMap((site) =>
		site.models.map((model) => ({ site, model })),
	);
	for (const { site, model } of listed) {
		if (!firstReading(seen, model.slug, recordKey(site, model))) continue;
		joined.models.push(model);
		const cost = site.costs.get(model.slug);
		if (cost) joined.costs.set(model.slug, cost);
	}
	return joined;
}
