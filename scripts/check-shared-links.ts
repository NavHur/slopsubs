// Opens shared links against the prerendered build; fails on a hydration error,
// a view left hidden, or one shown before slow scripts run. See README.md.

import { Effect, Schema } from "effect";
import { type Browser } from "playwright-core";
import {
	browserOperation,
	browserRead,
	openBrowserPage,
	BrowserCheckError,
	launchBrowser,
	siteOrigin,
} from "./effects/browser.ts";

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
	{
		search: '?fit={"models":["claude-fable-5-2"],"unit":"tasks","amount":40}',
		benchmark: "Intelligence Index",
	},
	{
		search: '?fit={"amount":"lots"}&chart=plan-fit',
		benchmark: "Intelligence Index",
	},
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

const LinkState = Schema.Struct({
	pending: Schema.Boolean,
	pressed: Schema.UndefinedOr(Schema.NullOr(Schema.String)),
	layoutShift: Schema.Finite,
});

/** Opens one link; returns what went wrong on it, if anything. */
const checkLink = Effect.fnUntraced(function* (
	browser: Browser,
	url: string,
	viewport: (typeof VIEWPORTS)[number],
	benchmark: string,
) {
	const page = yield* openBrowserPage(browser, { viewport });
	const problems: string[] = [];
	page.on("console", (message) => {
		if (message.type() === "error") problems.push(message.text());
	});
	page.on("pageerror", (error) => problems.push(String(error)));
	yield* browserOperation("addInitScript", () =>
		page.addInitScript(recordLayoutShift),
	);
	yield* browserOperation("goto", () =>
		page.goto(url, { waitUntil: "networkidle" }),
	);
	yield* browserOperation("waitForTimeout", () =>
		page.waitForTimeout(SETTLE_MS),
	);
	const state = yield* browserRead(LinkState, "Read link state", () =>
		page.evaluate(() => ({
			pending: "viewPending" in document.documentElement.dataset,
			pressed: document
				.querySelector('[aria-label="Benchmark that defines a task"]')
				?.querySelector("[aria-pressed=true]")?.textContent,
			layoutShift: (window as unknown as { layoutShift: number }).layoutShift,
		})),
	);

	if (state.pending) problems.push("the view is still hidden");
	if (state.pressed !== benchmark)
		problems.push(`benchmark is ${state.pressed}, not ${benchmark}`);
	return { problems, layoutShift: state.layoutShift };
}, Effect.scoped);

/** Longer than the 2 s the CSS fallback once waited, shorter than its 10 s. */
const SLOW_BUNDLE_MS = 3000;

/** Holds the app's scripts back; whether the view stayed hidden meanwhile. */
const staysHiddenWhileSlow = Effect.fnUntraced(function* (
	browser: Browser,
	url: string,
) {
	const page = yield* openBrowserPage(browser, { viewport: VIEWPORTS[1] });
	yield* browserOperation("route", () =>
		page.route("**/*.js", async (route) => {
			await new Promise((resolve) => setTimeout(resolve, SLOW_BUNDLE_MS));
			await route.continue();
		}),
	);
	yield* browserOperation("goto", () =>
		page.goto(url, { waitUntil: "commit" }),
	);
	yield* browserOperation("waitForTimeout", () =>
		page.waitForTimeout(SLOW_BUNDLE_MS - 500),
	);
	const visibility = yield* browserRead(
		Schema.String,
		"Read view visibility",
		() =>
			page.evaluate(
				() =>
					getComputedStyle(document.querySelector("[data-view-dependent]")!)
						.visibility,
			),
	);

	return visibility === "hidden";
}, Effect.scoped);

function reportLink(
	width: number,
	search: string,
	result: { problems: string[]; layoutShift: number },
) {
	const ok = result.problems.length === 0;
	const shift = result.layoutShift.toFixed(4);
	console.log(
		`${ok ? "ok  " : "FAIL"} ${width}px ${search || "/"} (layout shift ${shift})`,
	);
	for (const problem of result.problems) console.log(`     ${problem}`);
	return ok;
}

const checkViewport = Effect.fnUntraced(function* (
	browser: Browser,
	origin: string,
	viewport: (typeof VIEWPORTS)[number],
) {
	let failures = 0;
	for (const { search, benchmark } of LINKS) {
		const result = yield* checkLink(
			browser,
			new URL(search, origin).href,
			viewport,
			benchmark,
		);
		if (!reportLink(viewport.width, search, result)) failures++;
	}
	return failures;
});

const main = Effect.gen(function* () {
	const origin = yield* siteOrigin();
	const browser = yield* launchBrowser();
	let failures = 0;
	for (const viewport of VIEWPORTS)
		failures += yield* checkViewport(browser, origin, viewport);
	const slowUrl = new URL("?benchmark=omniscience", origin).href;
	const hidden = yield* staysHiddenWhileSlow(browser, slowUrl);
	if (!hidden) failures++;
	console.log(
		`${hidden ? "ok  " : "FAIL"} slow scripts: the view ${hidden ? "stays hidden" : "showed the default early"}`,
	);

	if (failures > 0)
		return yield* new BrowserCheckError({
			message: `${failures} shared link checks failed`,
		});
});

await Effect.runPromise(Effect.scoped(main));
