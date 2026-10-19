import { describe, expect, it } from "vitest";
import type { FamilyId } from "#/domain/model";
import {
	type HighlightEvent,
	highlightedModel,
	NO_HIGHLIGHT,
	updateHighlight,
} from "./highlight";

const a = "claude-opus-5-5" as FamilyId;
const b = "claude-haiku-5-5" as FamilyId;

const run = (...events: HighlightEvent[]) =>
	highlightedModel(events.reduce(updateHighlight, NO_HIGHLIGHT));

describe("model highlight", () => {
	it("previews a model only while hovered or focused", () => {
		expect(run({ type: "preview", modelId: a })).toBe(a);
		expect(
			run({ type: "preview", modelId: a }, { type: "endPreview", modelId: a }),
		).toBeNull();
	});

	it("keeps a clicked model highlighted after the pointer leaves", () => {
		expect(
			run(
				{ type: "preview", modelId: a },
				{ type: "toggle", modelId: a },
				{ type: "endPreview", modelId: a },
			),
		).toBe(a);
	});

	it("lets a hovered model show over the pinned one, then returns to it", () => {
		const pinned: HighlightEvent = { type: "toggle", modelId: a };
		expect(run(pinned, { type: "preview", modelId: b })).toBe(b);
		expect(
			run(
				pinned,
				{ type: "preview", modelId: b },
				{ type: "endPreview", modelId: b },
			),
		).toBe(a);
	});

	it("clears when the pinned model is toggled again, even while hovered", () => {
		expect(
			run(
				{ type: "preview", modelId: a },
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

	it("clears pin and preview on Escape", () => {
		expect(
			run(
				{ type: "toggle", modelId: a },
				{ type: "preview", modelId: b },
				{ type: "clear" },
			),
		).toBeNull();
	});

	it("ignores a stale leave from a model that is no longer previewed", () => {
		expect(
			run(
				{ type: "preview", modelId: a },
				{ type: "preview", modelId: b },
				{ type: "endPreview", modelId: a },
			),
		).toBe(b);
	});
});
