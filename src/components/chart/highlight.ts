import type { FamilyId } from "#/domain/model";

/**
 * Which model the chart emphasizes. A click pins a model until it is clicked
 * again, cleared, or leaves the chart; hover and focus preview over the pin.
 */
export type ModelHighlight = {
	pinned: FamilyId | null;
	hovered: FamilyId | null;
	focused: FamilyId | null;
};

export type PreviewSource = "hover" | "focus";

export type HighlightEvent =
	| { type: "preview"; source: PreviewSource; modelId: FamilyId }
	| { type: "endPreview"; source: PreviewSource; modelId: FamilyId }
	| { type: "toggle"; modelId: FamilyId }
	| { type: "prune"; plotted: ReadonlySet<FamilyId> }
	| { type: "clear" };

export const NO_HIGHLIGHT: ModelHighlight = {
	pinned: null,
	hovered: null,
	focused: null,
};

const SOURCE_SLOT = { hover: "hovered", focus: "focused" } as const;

export function updateHighlight(
	state: ModelHighlight,
	event: HighlightEvent,
): ModelHighlight {
	switch (event.type) {
		case "preview":
			return { ...state, [SOURCE_SLOT[event.source]]: event.modelId };
		case "endPreview":
			return endPreview(state, event.source, event.modelId);
		case "toggle":
			// Unpinning also drops both previews so the clear shows while hovered.
			return state.pinned === event.modelId
				? NO_HIGHLIGHT
				: { ...state, pinned: event.modelId };
		case "prune":
			return plottedHighlight(state, event.plotted);
		case "clear":
			return NO_HIGHLIGHT;
	}
}

/** A leave can arrive after that source already moved to another model. */
function endPreview(
	state: ModelHighlight,
	source: PreviewSource,
	modelId: FamilyId,
): ModelHighlight {
	const slot = SOURCE_SLOT[source];
	return state[slot] === modelId ? { ...state, [slot]: null } : state;
}

/** The highlight with every model that is not plotted dropped. */
function plottedHighlight(
	state: ModelHighlight,
	plotted: ReadonlySet<FamilyId>,
): ModelHighlight {
	const keep = (id: FamilyId | null) =>
		id !== null && plotted.has(id) ? id : null;
	const next = {
		pinned: keep(state.pinned),
		hovered: keep(state.hovered),
		focused: keep(state.focused),
	};
	const unchanged =
		next.pinned === state.pinned &&
		next.hovered === state.hovered &&
		next.focused === state.focused;
	return unchanged ? state : next;
}

export function highlightedModel(state: ModelHighlight): FamilyId | null {
	return state.hovered ?? state.focused ?? state.pinned;
}
