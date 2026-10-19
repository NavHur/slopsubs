import { useReducer, useState } from "react";
import type { ValuePoint } from "#/domain/value";

/**
 * Which point's details the chart shows. A click pins a point until it is
 * clicked again, closed, or leaves the chart; hover and focus preview over
 * the pin.
 */
export type PointDetails = {
	hovered: ValuePoint | null;
	/** Key of the pinned point, which survives the rebuild of every point. */
	pinned: string | null;
};

export type PointDetailsEvent =
	| { type: "hover"; point: ValuePoint | null }
	| { type: "togglePin"; point: ValuePoint }
	| { type: "close" }
	| { type: "prune"; points: readonly ValuePoint[] };

export const NO_DETAILS: PointDetails = { hovered: null, pinned: null };

const pointKey = (point: ValuePoint) =>
	`${point.seriesId}/${point.benchmark.id}`;

export function updatePointDetails(
	state: PointDetails,
	event: PointDetailsEvent,
): PointDetails {
	switch (event.type) {
		case "hover":
			return { ...state, hovered: event.point };
		case "togglePin":
			// Unpinning also drops the preview so the click visibly closes it.
			return state.pinned === pointKey(event.point)
				? NO_DETAILS
				: { ...state, pinned: pointKey(event.point) };
		case "close":
			return NO_DETAILS;
		case "prune":
			return plottedDetails(state, event.points);
	}
}

/** The details with points that left the chart dropped, the rest current. */
function plottedDetails(
	state: PointDetails,
	points: readonly ValuePoint[],
): PointDetails {
	const current = new Map(points.map((p) => [pointKey(p), p]));
	const next = {
		hovered: state.hovered && (current.get(pointKey(state.hovered)) ?? null),
		pinned:
			state.pinned !== null && current.has(state.pinned) ? state.pinned : null,
	};
	const unchanged =
		next.hovered === state.hovered && next.pinned === state.pinned;
	return unchanged ? state : next;
}

/** The point whose details show, and whether they are pinned. */
export function shownDetails(
	state: PointDetails,
	points: readonly ValuePoint[],
): { point: ValuePoint; pinned: boolean } | null {
	const pinned = points.find((p) => pointKey(p) === state.pinned);
	const point = state.hovered ?? pinned;
	return point ? { point, pinned: pointKey(point) === state.pinned } : null;
}

export function usePointDetails(points: readonly ValuePoint[]) {
	const [state, dispatch] = useReducer(updatePointDetails, NO_DETAILS);
	const [prunedFor, setPrunedFor] = useState(points);
	if (prunedFor !== points) {
		// Forget points that left the chart before this render commits.
		setPrunedFor(points);
		dispatch({ type: "prune", points });
	}
	return [shownDetails(state, points), dispatch] as const;
}
