import type { RefObject } from "react";
import type { FamilyId } from "#/domain/model";
import { type Dismissable, useChartEscape } from "./chartEscape";

type EscapeState = {
	detailsOpen: boolean;
	pinnedModel: FamilyId | null;
	closeDetails: () => void;
	clearHighlight: () => void;
};

/** The 3D chart's layers in the order Escape peels them: details, then pin. */
export function tradeoffEscapeLayers(state: EscapeState): Dismissable[] {
	return [
		{ open: state.detailsOpen, close: state.closeDetails },
		{ open: state.pinnedModel !== null, close: state.clearHighlight },
	];
}

/** Escape closes the 3D chart's details, then its pinned model highlight. */
export function useTradeoffEscape(
	chart: RefObject<HTMLElement | null>,
	state: EscapeState,
) {
	useChartEscape(chart, tradeoffEscapeLayers(state));
}
