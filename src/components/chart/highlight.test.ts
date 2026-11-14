import { describe, expect, it } from "vite-plus/test";
import type { FamilyId } from "#/domain/model";
import {
	type HighlightEvent,
	highlightedModels,
	NO_HIGHLIGHT,
	updateHighlight,
} from "./highlight";

const a = "claude-opus-5-5" as FamilyId;
const b = "claude-haiku-5-5" as FamilyId;

const reduce = (...events: HighlightEvent[]) =>
	events.reduce(updateHighlight, NO_HIGHLIGHT);
const run = (...events: HighlightEvent[]) =>
	highlightedModels(reduce(...events));

describe("model highlight", () => {
	it("previews a model only while hovered or focused", () => {
		expect(run({ type: "preview", source: "hover", modelId: a })).toEqual([a]);
		expect(run({ type: "preview", source: "focus", modelId: a })).toEqual([a]);
		expect(
			run(
				{ type: "preview", source: "hover", modelId: a },
				{ type: "endPreview", source: "hover", modelId: a },
			),
		).toEqual([]);
	});

	it("keeps a clicked model highlighted after the pointer leaves", () => {
		expect(
			run(
				{ type: "preview", source: "hover", modelId: a },
				{ type: "toggle", modelId: a },
				{ type: "endPreview", source: "hover", modelId: a },
			),
		).toEqual([a]);
	});

	it("previews a hovered model beside the pinned one, then drops it", () => {
		const pinned: HighlightEvent = { type: "toggle", modelId: a };
		expect(
			run(pinned, { type: "preview", source: "hover", modelId: b }),
		).toEqual([a, b]);
		expect(
			run(
				pinned,
				{ type: "preview", source: "hover", modelId: b },
				{ type: "endPreview", source: "hover", modelId: b },
			),
		).toEqual([a]);
	});

	it("returns to the focused model after hovering another one", () => {
		expect(
			run(
				{ type: "preview", source: "focus", modelId: a },
				{ type: "preview", source: "hover", modelId: b },
				{ type: "endPreview", source: "hover", modelId: b },
			),
		).toEqual([a]);
	});

	it("clears when the pinned model is toggled again, even while hovered", () => {
		expect(
			run(
				{ type: "preview", source: "hover", modelId: a },
				{ type: "toggle", modelId: a },
				{ type: "toggle", modelId: a },
			),
		).toEqual([]);
	});

	it("pins another model beside the first", () => {
		expect(
			run({ type: "toggle", modelId: a }, { type: "toggle", modelId: b }),
		).toEqual([a, b]);
	});

	it("unpins one model and keeps the others pinned", () => {
		expect(
			run(
				{ type: "toggle", modelId: a },
				{ type: "toggle", modelId: b },
				{ type: "preview", source: "hover", modelId: b },
				{ type: "toggle", modelId: b },
			),
		).toEqual([a]);
	});

	it("clears pin and previews on Escape", () => {
		expect(
			run(
				{ type: "toggle", modelId: a },
				{ type: "preview", source: "hover", modelId: b },
				{ type: "preview", source: "focus", modelId: b },
				{ type: "clear" },
			),
		).toEqual([]);
	});

	it("ignores a stale leave from a model that is no longer previewed", () => {
		expect(
			run(
				{ type: "preview", source: "hover", modelId: a },
				{ type: "preview", source: "hover", modelId: b },
				{ type: "endPreview", source: "hover", modelId: a },
			),
		).toEqual([b]);
	});

	it("forgets a pinned model that leaves the chart, so a reselect starts clean", () => {
		const state = reduce(
			{ type: "toggle", modelId: a },
			{ type: "prune", plotted: new Set([b]) },
			{ type: "prune", plotted: new Set([a, b]) },
		);
		expect(highlightedModels(state)).toEqual([]);
	});

	it("keeps the same state when every highlighted model is still plotted", () => {
		const state = reduce(
			{ type: "toggle", modelId: a },
			{ type: "preview", source: "hover", modelId: b },
			{ type: "preview", source: "focus", modelId: a },
		);
		const pruned = updateHighlight(state, {
			type: "prune",
			plotted: new Set([a, b]),
		});
		expect(pruned).toBe(state);
	});

	it("returns to the pin once both previews of a model end", () => {
		const previews: HighlightEvent[] = [
			{ type: "toggle", modelId: b },
			{ type: "preview", source: "focus", modelId: a },
			{ type: "preview", source: "hover", modelId: a },
		];
		expect(run(...previews)).toEqual([b, a]);
		expect(
			run(
				...previews,
				{ type: "endPreview", source: "hover", modelId: a },
				{ type: "endPreview", source: "focus", modelId: a },
			),
		).toEqual([b]);
	});
});
