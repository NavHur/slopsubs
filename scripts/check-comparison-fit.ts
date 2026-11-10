// Pins a point, hovers another, and checks the comparison table fits, against
// the prerendered build: no figure or change chip breaks over two lines, and
// the table never spills out of its card. Phones from 360px wide are covered.

import { type Browser, chromium, type Page } from "playwright-core";
import { originOf, serveSite } from "./serve-site.ts";

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
function costOf(label: string): number {
	const cost = label.match(/cost per task \$([\d.]+)/)?.[1];
	if (cost === undefined) throw new Error(`no cost in "${label}"`);
	return Number(cost);
}

/**
 * Point pairs to compare, as [pinned, hovered] indexes: the cheapest against
 * the priciest both ways, which shows the widest chip, then a spread of others.
 */
function pairsToCompare(labels: string[]): [number, number][] {
	const byCost = labels
		.map((_, i) => i)
		.sort((a, b) => costOf(labels[a]) - costOf(labels[b]));
	const cheapest = byCost[0];
	const priciest = byCost[byCost.length - 1];
	const spread: [number, number][] = [0.1, 0.3, 0.5, 0.7, 0.9].map((share) => {
		const at = Math.floor(labels.length * share);
		return [at, (at + Math.floor(labels.length / 3)) % labels.length];
	});
	return [[cheapest, priciest], [priciest, cheapest], ...spread];
}

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
async function comparisonFits(
	page: Page,
	labels: string[],
	[pinned, hovered]: [number, number],
): Promise<boolean> {
	const points = page.locator(POINTS);
	await points.nth(pinned).dispatchEvent("click");
	await points.nth(hovered).dispatchEvent("mouseover");
	await page.waitForTimeout(SETTLE_MS);
	const problems = await page.evaluate(fitProblems);
	const width = page.viewportSize()?.width;
	const verdict = problems.length === 0 ? "ok  " : "FAIL";
	console.log(`${verdict} ${width}px ${labels[pinned]} → ${labels[hovered]}`);
	for (const problem of problems) console.log(`     ${problem}`);
	await points.nth(hovered).dispatchEvent("mouseout");
	await page.keyboard.press("Escape");
	return problems.length === 0;
}

async function checkViewport(
	browser: Browser,
	origin: string,
	viewport: (typeof VIEWPORTS)[number],
): Promise<number> {
	const page = await browser.newPage({ viewport });
	await page.goto(origin, { waitUntil: "networkidle" });
	const labels = await page
		.locator(POINTS)
		.evaluateAll((els) => els.map((el) => el.getAttribute("aria-label") ?? ""));
	let failures = 0;
	for (const pair of pairsToCompare(labels)) {
		if (!(await comparisonFits(page, labels, pair))) failures++;
	}
	await page.close();
	return failures;
}

const server = await serveSite();
const browser = await chromium.launch();
let failures = 0;
try {
	for (const viewport of VIEWPORTS) {
		failures += await checkViewport(browser, originOf(server), viewport);
	}
} finally {
	await browser.close();
	server.close();
}
if (failures > 0) {
	console.error(`${failures} comparisons did not fit`);
	process.exit(1);
}
