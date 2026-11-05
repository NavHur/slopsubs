// Opens the built home page for the profiler and waits for it to settle.

import type { Browser, Page } from "playwright-core";
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
export async function settle(page: Page, ms = 40) {
	await page.evaluate(
		() =>
			new Promise((done) =>
				requestAnimationFrame(() => requestAnimationFrame(done)),
			),
	);
	await page.waitForTimeout(ms);
}

/** The page at `viewport`, hydrated, with `probe` installed before it loads. */
export async function openPage(
	browser: Browser,
	origin: string,
	viewport: ViewportName,
	probe: ProbeScript,
): Promise<Page> {
	const page = await browser.newPage({ viewport: VIEWPORTS[viewport] });
	await page.addInitScript(probe);
	await page.goto(origin, { waitUntil: "networkidle" });
	await page.locator('[aria-current="location"]').waitFor();
	await settle(page, 500);
	return page;
}

/** The left gutter: over the page, never over a chart point. */
export function pointAtGutter(page: Page, viewport: ViewportName) {
	return page.mouse.move(6, VIEWPORTS[viewport].height * 0.6);
}
