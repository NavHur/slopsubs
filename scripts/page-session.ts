// Opens the built home page for the profiler and waits for it to settle.

import { Effect } from "effect";
import type { Browser, Page } from "playwright-core";
import { browserOperation, openBrowserPage } from "./effects/browser.ts";
import type { ProbeScript } from "./page-probe.ts";

export const VIEWPORTS = {
	desktop: { width: 1440, height: 900 },
	phone: { width: 390, height: 844 },
	/** So tall the last section's top never reaches the reading line: only
	 * reaching the scroller's end marks it. */
	tall: { width: 1440, height: 1800 },
} as const;
export type ViewportName = keyof typeof VIEWPORTS;

/** Two frames and `ms` more, so React commits and the URL catches up. */
export const settle = Effect.fnUntraced(function* (page: Page, ms = 40) {
	yield* browserOperation("evaluate", () =>
		page.evaluate(
			() =>
				new Promise((done) =>
					requestAnimationFrame(() => requestAnimationFrame(done)),
				),
		),
	);
	yield* browserOperation("waitForTimeout", () => page.waitForTimeout(ms));
});

/** The page at `viewport`, hydrated, with `probe` installed before it loads. */
export const openPage = Effect.fnUntraced(function* (
	browser: Browser,
	origin: string,
	viewport: ViewportName,
	probe: ProbeScript,
) {
	const page = yield* openBrowserPage(browser, {
		viewport: VIEWPORTS[viewport],
	});
	yield* browserOperation("addInitScript", () => page.addInitScript(probe));
	yield* browserOperation("goto", () =>
		page.goto(origin, { waitUntil: "networkidle" }),
	);
	yield* browserOperation("waitFor", () =>
		page.locator('[aria-current="location"]').waitFor(),
	);
	yield* settle(page, 500);
	return page;
});

/** The left gutter: over the page, never over a chart point. */
export const pointAtGutter = Effect.fnUntraced(function* (
	page: Page,
	viewport: ViewportName,
) {
	return yield* browserOperation("pointAtGutter", () =>
		page.mouse.move(6, VIEWPORTS[viewport].height * 0.6),
	);
});
