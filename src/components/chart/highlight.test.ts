import { describe, expect, it } from "vitest";
import type { FamilyId } from "#/domain/model";
import {
	type HighlightEvent,
	highlightedModel,
	NO_HIGHLIGHT,
	plottedHighlight,
	updateHighlight,
} from "./highlight";

const a = "claude-opus-5-5" as FamilyId;
const b = "claude-haiku-5-5" as FamilyId;

const reduce = (...events: HighlightEvent[]) =>
	events.reduce(updateHighlight, NO_HIGHLIGHT);
const run = (...events: HighlightEvent[]) =>
	highlightedModel(reduce(...events));

describe("model highlight", () => {
	it("previews a model only while hovered or focused", () => {
		expect(run({ type: "preview", source: "hover", modelId: a })).toBe(a);
		expect(run({ type: "preview", source: "focus", modelId: a })).toBe(a);
		expect(
			run(
				{ type: "preview", source: "hover", modelId: a },
				{ type: "endPreview", source: "hover", modelId: a },
			),
		).toBeNull();
	});

	it("keeps a clicked model highlighted after the pointer leaves", () => {
		expect(
			run(
				{ type: "preview", source: "hover", modelId: a },
				{ type: "toggle", modelId: a },
				{ type: "endPreview", source: "hover", modelId: a },
			),
		).toBe(a);
	});

	it("lets a hovered model show over the pinned one, then returns to it", () => {
		const pinned: HighlightEvent = { type: "toggle", modelId: a };
		expect(run(pinned, { type: "preview", source: "hover", modelId: b })).toBe(
			b,
		);
		expect(
			run(
				pinned,
				{ type: "preview", source: "hover", modelId: b },
				{ type: "endPreview", source: "hover", modelId: b },
			),
		).toBe(a);
	});

	it("returns to the focused model after hovering another one", () => {
		expect(
			run(
				{ type: "preview", source: "focus", modelId: a },
				{ type: "preview", source: "hover", modelId: b },
				{ type: "endPreview", source: "hover", modelId: b },
			),
		).toBe(a);
	});

	it("clears when the pinned model is toggled again, even while hovered", () => {
		expect(
			run(
				{ type: "preview", source: "hover", modelId: a },
				{ type: "toggle", modelId: a },
				{ type: "toggle", modelId: a },
			),
		).toBeNull();
	});

	it("moves the pin when another model is toggled", () => {
		expect(
			run({ type: "toggle", modelId: a }, { type: "toggle", modelId: b }),
		).toBe(b);
	});

	it("clears pin and previews on Escape", () => {
		expect(
			run(
				{ type: "toggle", modelId: a },
				{ type: "preview", source: "hover", modelId: b },
				{ type: "preview", source: "focus", modelId: b },
				{ type: "clear" },
			),
		).toBeNull();
	});

	it("ignores a stale leave from a model that is no longer previewed", () => {
		expect(
			run(
				{ type: "preview", source: "hover", modelId: a },
				{ type: "preview", source: "hover", modelId: b },
				{ type: "endPreview", source: "hover", modelId: a },
			),
		).toBe(b);
	});

	it("drops a pinned model that is no longer plotted", () => {
		const shown = plottedHighlight(
			reduce({ type: "toggle", modelId: a }),
			new Set([b]),
		);
		expect(shown.pinned).toBeNull();
		expect(highlightedModel(shown)).toBeNull();
	});

	it("returns to the pin once both previews of a model end", () => {
		const ended = reduce(
			{ type: "preview", source: "focus", modelId: a },
			{ type: "preview", source: "hover", modelId: a },
			{ type: "endPreview", source: "hover", modelId: a },
			{ type: "endPreview", source: "focus", modelId: a },
		);
		expect(highlightedModel(ended)).toBeNull();
		const pinned = updateHighlight(ended, { type: "toggle", modelId: b });
		expect(highlightedModel(pinned)).toBe(b);
	});
});
