import { useReducer, useState } from "react";
import type { FamilyId } from "#/domain/model";

/**
 * Which models the chart emphasizes. A click pins a model, alongside any
 * already pinned, until it is clicked again, cleared, or leaves the chart;
 * hover and focus preview one more beside the pins.
 */
type ModelHighlight = {
	/** In the order they were pinned; never repeats a model. */
	pinned: readonly FamilyId[];
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
	pinned: [],
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
			return togglePin(state, event.modelId);
		case "prune":
			return plottedHighlight(state, event.plotted);
		case "clear":
			return NO_HIGHLIGHT;
	}
}

/** Pins the model beside the others, or unpins it. Unpinning also drops its
 * previews, so the unpin shows while the pointer is still on its label. */
function togglePin(state: ModelHighlight, modelId: FamilyId): ModelHighlight {
	if (!state.pinned.includes(modelId)) {
		return { ...state, pinned: [...state.pinned, modelId] };
	}
	const unless = (id: FamilyId | null) => (id === modelId ? null : id);
	return {
		pinned: state.pinned.filter((id) => id !== modelId),
		hovered: unless(state.hovered),
		focused: unless(state.focused),
	};
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
		pinned: state.pinned.filter((id) => plotted.has(id)),
		hovered: keep(state.hovered),
		focused: keep(state.focused),
	};
	const unchanged =
		next.pinned.length === state.pinned.length &&
		next.hovered === state.hovered &&
		next.focused === state.focused;
	return unchanged ? state : next;
}

/** The pinned models, then the previewed one if it is not pinned already. */
export function highlightedModels(state: ModelHighlight): readonly FamilyId[] {
	const preview = state.hovered ?? state.focused;
	if (preview === null || state.pinned.includes(preview)) return state.pinned;
	return [...state.pinned, preview];
}

/** Shared label and legend highlight. */
export function useModelHighlight(plotted: ReadonlySet<FamilyId>) {
	const [highlight, dispatch] = useReducer(updateHighlight, NO_HIGHLIGHT);
	const [prunedFor, setPrunedFor] = useState(plotted);
	if (prunedFor !== plotted) {
		// Forget models that left the chart before this render commits.
		setPrunedFor(plotted);
		dispatch({ type: "prune", plotted });
	}
	return [highlight, dispatch] as const;
}
