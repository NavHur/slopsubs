// Pins a point, hovers another, and checks the comparison table fits, against
// the prerendered build: no figure or change chip breaks over two lines, and
// the table never spills out of its card. Phones from 360px wide are covered.

import { Effect, Schema } from "effect";
import { type Browser, type Page } from "playwright-core";
import {
	browserOperation,
	browserRead,
	openBrowserPage,
	BrowserCheckError,
	launchBrowser,
	siteOrigin,
} from "./effects/browser.ts";

const VIEWPORTS = [
	{ width: 360, height: 800 },
	{ width: 390, height: 844 },
	{ width: 1440, height: 900 },
];

const POINTS =
	'svg[aria-label^="Effective cost per task"] g[role="button"][aria-label*="cost per task"]';
/** Long enough for the tooltip to measure itself and settle in place. */
const SETTLE_MS = 250;

/** The cost a point's label states: "…, effective cost per task $1.42, …". */
const costOf = Effect.fnUntraced(function* (label: string) {
	const cost = label.match(/cost per task \$([\d.]+)/)?.[1];
	if (cost === undefined)
		return yield* new BrowserCheckError({ message: `no cost in "${label}"` });
	return yield* Schema.decodeUnknownEffect(
		Schema.NumberFromString.pipe(Schema.check(Schema.isFinite())),
	)(cost);
});

/**
 * Point pairs to compare, as [pinned, hovered] indexes: the cheapest against
 * the priciest both ways, which shows the widest chip, then a spread of others.
 */
const pairsToCompare = Effect.fnUntraced(function* (labels: readonly string[]) {
	const costs = yield* Effect.forEach(labels, costOf);
	const byCost = labels.map((_, i) => i).sort((a, b) => costs[a] - costs[b]);
	const cheapest = byCost[0];
	const priciest = byCost[byCost.length - 1];
	const spread: [number, number][] = [0.1, 0.3, 0.5, 0.7, 0.9].map((share) => {
		const at = Math.floor(labels.length * share);
		return [at, (at + Math.floor(labels.length / 3)) % labels.length];
	});
	return [[cheapest, priciest], [priciest, cheapest], ...spread] satisfies [
		number,
		number,
	][];
});

/**
 * What breaks the table's fit in the shown comparison, if anything. It runs
 * in the page, so it calls no helper of its own.
 */
function fitProblems(): string[] {
	const table = document.querySelector("div.absolute.z-10 table");
	if (!table) return ["no comparison table is shown"];
	const card = table.parentElement as HTMLElement;
	const problems =
		table.scrollWidth > card.clientWidth
			? [`table is ${table.scrollWidth}px in a ${card.clientWidth}px card`]
			: [];
	// A row is as tall as its wrapped label, so count each text's own lines.
	const texts = document.evaluate(
		"./tbody//td//text()",
		table,
		null,
		XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
		null,
	);
	for (let i = 0; i < texts.snapshotLength; i++) {
		const text = document.createRange();
		text.selectNodeContents(texts.snapshotItem(i) as Node);
		if (text.getClientRects().length > 1) {
			problems.push(`"${text.toString()}" breaks over two lines`);
		}
	}
	return problems;
}

/** Pins one point, hovers another, and reports whether their table fits. */
const comparisonFits = Effect.fnUntraced(function* (
	page: Page,
	labels: readonly string[],
	[pinned, hovered]: [number, number],
) {
	const points = page.locator(POINTS);
	yield* browserOperation("dispatchEvent", () =>
		points.nth(pinned).dispatchEvent("click"),
	);
	yield* browserOperation("dispatchEvent", () =>
		points.nth(hovered).dispatchEvent("mouseover"),
	);
	yield* browserOperation("waitForTimeout", () =>
		page.waitForTimeout(SETTLE_MS),
	);
	const problems = yield* browserRead(
		Schema.Array(Schema.String),
		"Read fit problems",
		() => page.evaluate(fitProblems),
	);
	const width = page.viewportSize()?.width;
	const verdict = problems.length === 0 ? "ok  " : "FAIL";
	console.log(`${verdict} ${width}px ${labels[pinned]} → ${labels[hovered]}`);
	for (const problem of problems) console.log(`     ${problem}`);
	yield* browserOperation("dispatchEvent", () =>
		points.nth(hovered).dispatchEvent("mouseout"),
	);
	yield* browserOperation("press", () => page.keyboard.press("Escape"));
	return problems.length === 0;
});

const checkViewport = Effect.fnUntraced(function* (
	browser: Browser,
	origin: string,
	viewport: (typeof VIEWPORTS)[number],
) {
	const page = yield* openBrowserPage(browser, { viewport });
	yield* browserOperation("goto", () =>
		page.goto(origin, { waitUntil: "networkidle" }),
	);
	const labels = yield* browserRead(
		Schema.NonEmptyArray(Schema.String),
		"Read point labels",
		() =>
			page
				.locator(POINTS)
				.evaluateAll((els) =>
					els.map((el) => el.getAttribute("aria-label") ?? ""),
				),
	);
	let failures = 0;
	for (const pair of yield* pairsToCompare(labels)) {
		if (!(yield* comparisonFits(page, labels, pair))) failures++;
	}

	return failures;
}, Effect.scoped);

const main = Effect.gen(function* () {
	const origin = yield* siteOrigin();
	const browser = yield* launchBrowser();
	let failures = 0;
	for (const viewport of VIEWPORTS) {
		failures += yield* checkViewport(browser, origin, viewport);
	}

	if (failures > 0)
		return yield* new BrowserCheckError({
			message: `${failures} comparisons did not fit`,
		});
});

await Effect.runPromise(Effect.scoped(main));
