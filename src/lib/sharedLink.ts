import { useHydrated } from "@tanstack/react-router";
import { useEffect } from "react";
import {
	DEFAULT_VIEW,
	type DrawnView,
	SCROLL_ONLY_PARAMS,
	ViewSearch,
} from "#/lib/view";

/**
 * The params that change what the page draws. The scroll-only ones are left
 * out: the prerendered page is right for them.
 */
const DRAWN_PARAMS = Object.keys(ViewSearch.shape).filter(
	(key) => !(SCROLL_ONLY_PARAMS as readonly string[]).includes(key),
);

/**
 * Runs in <head> before first paint. A link that sets a drawn param gets
 * `data-view-pending` on <html>, which hides the prerendered default view
 * (laid out, not shown) until the link's own view renders; see styles.css.
 */
export const PENDING_VIEW_SCRIPT = `var p=new URLSearchParams(location.search);if(${JSON.stringify(DRAWN_PARAMS)}.some(function(k){return p.has(k)}))document.documentElement.dataset.viewPending=""`;

/**
 * Shows the page two frames after the link's view renders. Chrome counts an
 * element that moves in the frame it is shown as a layout shift, so the new
 * layout is painted once while still hidden, then shown where it settled.
 */
function useShowLinkedView(rendered: boolean) {
	useEffect(() => {
		if (!rendered) return;
		let frame = requestAnimationFrame(() => {
			frame = requestAnimationFrame(() => {
				delete document.documentElement.dataset.viewPending;
			});
		});
		return () => cancelAnimationFrame(frame);
	}, [rendered]);
}

/**
 * The view to render. The page is prerendered once, with the default view, so
 * hydration must render that view too; the link's own view follows straight
 * after, and the page shows once it has.
 */
export function useRenderedView(linked: DrawnView): DrawnView {
	const hydrated = useHydrated();
	useShowLinkedView(hydrated);
	return hydrated ? linked : DEFAULT_VIEW;
}
