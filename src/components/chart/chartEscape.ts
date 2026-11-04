import { type RefObject, useEffect, useEffectEvent } from "react";
import { isTextEntryTarget } from "#/lib/textEntry";

/**
 * Escape meant for the chart, not for a text field or for the sheet that made
 * the chart inert.
 */
export function isChartEscape(
	event: Pick<KeyboardEvent, "key" | "target">,
	chart: HTMLElement | null,
) {
	return (
		event.key === "Escape" &&
		!isTextEntryTarget(event.target) &&
		!chart?.closest("[inert]")
	);
}

/** Something Escape closes while it is `open`. */
export type Dismissable = { open: boolean; close: () => void };

/** Closes the first open layer, so the layers peel off in order. */
export function closeFirstOpen(layers: readonly Dismissable[]) {
	layers.find((l) => l.open)?.close();
}

/**
 * While any layer is open, Escape meant for the chart closes the first open
 * one, so the layers peel off in order.
 */
export function useChartEscape(
	chart: RefObject<HTMLElement | null>,
	layers: readonly Dismissable[],
) {
	const closeFirst = useEffectEvent(() => closeFirstOpen(layers));
	const enabled = layers.some((l) => l.open);
	useEffect(() => {
		if (!enabled) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (isChartEscape(event, chart.current)) closeFirst();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [enabled, chart]);
}
