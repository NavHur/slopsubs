// Reads each model's whole Intelligence Index cost, tokens and time per task
// out of an AA model page's flight payload, for models slopalytics hasn't run.

import { z } from "zod";
import { roundedOrNull } from "./rounding";

/** What one Intelligence Index task costs a model, at AA's prices. */
export type TaskCost = {
	costPerTaskUsd: number;
	tokensPerTask: number | null;
	secondsPerTask: number | null;
};

const MODEL_START_PATTERN = /\{"id":"[0-9a-f-]{36}","slug":"/g;
const BRACE_DELTA: Record<string, number> = { "{": 1, "}": -1 };

/** The fields read from one model record; the page carries many more. */
const SiteModel = z.object({
	slug: z.string().min(1),
	chartDefaultSelected: z.boolean(),
	intelligenceIndexCostPerTask: z
		.object({ cost: z.object({ total: z.number().nonnegative() }) })
		.nullish(),
	intelligenceIndexOutputTokensPerTask: z
		.object({ output: z.number() })
		.nullish(),
	intelligenceIndexTimePerTask: z.number().nullish(),
});
type SiteModel = z.infer<typeof SiteModel>;

/** End of the object starting at `start`, skipping braces inside strings. */
function objectEnd(text: string, start: number): number {
	let depth = 0;
	for (let i = start; i < text.length; i++) {
		if (text[i] === '"') {
			i++;
			while (i < text.length && text[i] !== '"') i += text[i] === "\\" ? 2 : 1;
			continue;
		}
		depth += BRACE_DELTA[text[i]] ?? 0;
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

/**
 * Each costed model's task cost, by AA slug. Throws when the page carries
 * only AA's default chart selection, which a model in it gets instead of
 * every model.
 */
export function extractIndexCosts(flight: string): Map<string, TaskCost> {
	const models = [...flight.matchAll(MODEL_START_PATTERN)]
		.map((found) => recordAt(flight, found.index))
		.filter((model) => model !== null);
	if (!models.length) throw new Error("No model records in the page");
	if (models.every((model) => model.chartDefaultSelected))
		throw new Error(
			"The page lists only AA's default chart selection; read a model page outside it",
		);
	const costs = new Map<string, TaskCost>();
	for (const model of models) {
		const cost = taskCost(model);
		if (cost) costs.set(model.slug, cost);
	}
	return costs;
}
