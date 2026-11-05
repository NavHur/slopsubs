// Opens shared links against the prerendered build; fails on a hydration error,
// a view left hidden, or one shown before slow scripts run. See README.md.

import type { AddressInfo } from "node:net";
import { type Browser, chromium } from "playwright-core";
import { serveSite } from "./serve-site.ts";

/** Each link and the benchmark tab it must end on. */
const LINKS: { search: string; benchmark: string }[] = [
	{ search: "", benchmark: "Intelligence Index" },
	{ search: "?benchmark=omniscience", benchmark: "Omniscience" },
	{ search: "?scale=linear&pareto=true", benchmark: "Intelligence Index" },
	{ search: "?api=false&labels=false", benchmark: "Intelligence Index" },
	{ search: "?chart=ranked-cost", benchmark: "Intelligence Index" },
	{
		search: '?plans=["claude-pro"]&families=["gpt-5-5"]&chart=tasks-per-week',
		benchmark: "Intelligence Index",
	},
	{ search: "?benchmark=retired&scale=nope", benchmark: "Intelligence Index" },
];

const VIEWPORTS = [
	{ width: 1440, height: 900 },
	{ width: 390, height: 844 },
];

/** Long enough for the view to show and a linked section's jump to settle. */
const SETTLE_MS = 1500;

/** Collects the layout shift a page records, as Cumulative Layout Shift does. */
function recordLayoutShift() {
	const page = window as unknown as { layoutShift: number };
	page.layoutShift = 0;
	new PerformanceObserver((list) => {
		for (const entry of list.getEntries() as unknown as {
			value: number;
			hadRecentInput: boolean;
		}[]) {
			if (!entry.hadRecentInput) page.layoutShift += entry.value;
		}
	}).observe({ type: "layout-shift", buffered: true });
}

/** Opens one link; returns what went wrong on it, if anything. */
async function checkLink(
	browser: Browser,
	url: string,
	viewport: (typeof VIEWPORTS)[number],
	benchmark: string,
): Promise<{ problems: string[]; layoutShift: number }> {
	const page = await browser.newPage({ viewport });
	const problems: string[] = [];
	page.on("console", (message) => {
		if (message.type() === "error") problems.push(message.text());
	});
	page.on("pageerror", (error) => problems.push(String(error)));
	await page.addInitScript(recordLayoutShift);
	await page.goto(url, { waitUntil: "networkidle" });
	await page.waitForTimeout(SETTLE_MS);
	const state = await page.evaluate(() => ({
		pending: "viewPending" in document.documentElement.dataset,
		pressed: document
			.querySelector('[aria-label="Benchmark that defines a task"]')
			?.querySelector("[aria-pressed=true]")?.textContent,
		layoutShift: (window as unknown as { layoutShift: number }).layoutShift,
	}));
	await page.close();
	if (state.pending) problems.push("the view is still hidden");
	if (state.pressed !== benchmark)
		problems.push(`benchmark is ${state.pressed}, not ${benchmark}`);
	return { problems, layoutShift: state.layoutShift };
}

/** Longer than the 2 s the CSS fallback once waited, shorter than its 10 s. */
const SLOW_BUNDLE_MS = 3000;

/** Holds the app's scripts back; whether the view stayed hidden meanwhile. */
async function staysHiddenWhileSlow(
	browser: Browser,
	url: string,
): Promise<boolean> {
	const page = await browser.newPage({ viewport: VIEWPORTS[1] });
	await page.route("**/*.js", async (route) => {
		await new Promise((resolve) => setTimeout(resolve, SLOW_BUNDLE_MS));
		await route.continue();
	});
	await page.goto(url, { waitUntil: "commit" });
	await page.waitForTimeout(SLOW_BUNDLE_MS - 500);
	const visibility = await page.evaluate(
		() =>
			getComputedStyle(document.querySelector("[data-view-dependent]")!)
				.visibility,
	);
	await page.close();
	return visibility === "hidden";
}

const server = await serveSite();
const { port } = server.address() as AddressInfo;
const origin = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch();
let failures = 0;
try {
	for (const viewport of VIEWPORTS) {
		for (const { search, benchmark } of LINKS) {
			const url = new URL(search, origin).href;
			const result = await checkLink(browser, url, viewport, benchmark);
			const ok = result.problems.length === 0;
			if (!ok) failures++;
			const shift = result.layoutShift.toFixed(4);
			console.log(
				`${ok ? "ok  " : "FAIL"} ${viewport.width}px ${search || "/"} (layout shift ${shift})`,
			);
			for (const problem of result.problems) console.log(`     ${problem}`);
		}
	}
	const slowUrl = new URL("?benchmark=omniscience", origin).href;
	const hidden = await staysHiddenWhileSlow(browser, slowUrl);
	if (!hidden) failures++;
	console.log(
		`${hidden ? "ok  " : "FAIL"} slow scripts: the view ${hidden ? "stays hidden" : "showed the default early"}`,
	);
} finally {
	await browser.close();
	server.close();
}
if (failures > 0) {
	console.error(`${failures} shared link checks failed`);
	process.exit(1);
}
