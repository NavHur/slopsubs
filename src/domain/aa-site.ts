// Reads an AA model page's Next.js flight payload: every model AA lists, with
// its Intelligence Index, list prices and release date, and the whole index's
// cost, tokens and time per task for the models AA has run.

import { z } from "zod";
import { MODEL_START_PATTERN, stringLiteralEnd } from "./flight";
import { roundedOrNull } from "./rounding";

/** What one Intelligence Index task costs a model, at AA's prices. */
export type TaskCost = {
	costPerTaskUsd: number;
	tokensPerTask: number | null;
	secondsPerTask: number | null;
};

const BRACE_DELTA: Record<string, number> = { "{": 1, "}": -1 };

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

/** End of the object starting at `start`, skipping braces inside strings. */
function objectEnd(text: string, start: number): number {
	let depth = 0;
	for (let i = start; i < text.length; i++) {
		if (text[i] === '"') i = stringLiteralEnd(text, i);
		else depth += BRACE_DELTA[text[i]] ?? 0;
		if (depth === 0) return i + 1;
	}
	throw new Error(`Object at offset ${start} never closes`);
}

/** The model record starting at `start`; null for an id-and-slug object
 * that is not one, such as a model's creator. */
function recordAt(flight: string, start: number): SiteModel | null {
	const text = flight.slice(start, objectEnd(flight, start));
	let record: unknown;
	try {
		record = JSON.parse(text);
	} catch (cause) {
		throw new Error(`Record at offset ${start} is not valid JSON`, { cause });
	}
	if (typeof record !== "object" || !record || !("intelligenceIndex" in record))
		return null;
	return SiteModel.parse(record);
}

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
		price1mInputTokens: model.price1mInputTokens,
		price1mOutputTokens: model.price1mOutputTokens,
	};
}

/**
 * Every model on the page, and each costed model's task cost. Throws when
 * the page carries only AA's default chart selection, which a model in it
 * gets instead of every model.
 */
export function readAaSite(flight: string): AaSite {
	const records = [...flight.matchAll(MODEL_START_PATTERN)]
		.map((found) => recordAt(flight, found.index))
		.filter((model) => model !== null);
	if (!records.length) throw new Error("No model records in the page");
	if (records.every((model) => model.chartDefaultSelected))
		throw new Error(
			"The page lists only AA's default chart selection; read a model page outside it",
		);
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
