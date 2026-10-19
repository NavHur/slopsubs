import type { FamilyId } from "#/domain/model";

/**
 * Which model the chart emphasizes. A click pins a model until it is
 * clicked again or cleared; hover and focus preview one on top of the pin.
 */
export type ModelHighlight = {
	pinned: FamilyId | null;
	preview: FamilyId | null;
};

export type HighlightEvent =
	| { type: "preview"; modelId: FamilyId }
	| { type: "endPreview"; modelId: FamilyId }
	| { type: "toggle"; modelId: FamilyId }
	| { type: "clear" };

export const NO_HIGHLIGHT: ModelHighlight = { pinned: null, preview: null };

export function updateHighlight(
	state: ModelHighlight,
	event: HighlightEvent,
): ModelHighlight {
	switch (event.type) {
		case "preview":
			return { ...state, preview: event.modelId };
		case "endPreview":
			// A leave can arrive after focus already moved to another model.
			return state.preview === event.modelId
				? { ...state, preview: null }
				: state;
		case "toggle":
			// Unpinning also drops the preview so the clear shows while hovered.
			return state.pinned === event.modelId
				? NO_HIGHLIGHT
				: { ...state, pinned: event.modelId };
		case "clear":
			return NO_HIGHLIGHT;
	}
}

export function highlightedModel(state: ModelHighlight): FamilyId | null {
	return state.preview ?? state.pinned;
}
