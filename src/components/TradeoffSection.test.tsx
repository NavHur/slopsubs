import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { VIEW_PRESETS } from "#/components/chart/projection";
import {
	buildSeries,
	pricingIdOf,
	pricingStyles,
} from "#/components/chart/series";
import { leaderboards, plans, samples } from "#/data";
import type { BenchmarkId } from "#/domain/enums";
import {
	type TimedPoint,
	tradeoffFrontier,
	timedPoints,
} from "#/domain/tradeoffs";
import { type ValuePoint, valuePoints } from "#/domain/value";
import { BENCHMARK_VIEWS } from "#/lib/benchmarks";
import { familyName } from "#/lib/families";
import { formatUsd } from "#/lib/format";
import { selectedFamilies, selectedPlans, parseViewSearch } from "#/lib/view";
import { tradeoffPng } from "./TradeoffKey";
import { TradeoffSection } from "./TradeoffSection";

/** The page's default selection on one benchmark tab. */
function pagePoints(benchmark: BenchmarkId) {
	const view = parseViewSearch({ benchmark });
	const planIds = selectedPlans(view);
	return valuePoints({
		benchmarks: leaderboards[benchmark].models,
		families: selectedFamilies(view),
		plans: plans.filter((p) => planIds.includes(p.id)),
		samples,
		showApi: true,
		hiddenEfforts: [],
	});
}

/** The section as the page renders it: styles built over every point. */
function markupOf(
	points: readonly ValuePoint[],
	benchmark: BenchmarkId,
	plansChecked = true,
) {
	return renderToStaticMarkup(
		<TradeoffSection
			points={points}
			pricings={pricingStyles(buildSeries(points))}
			view={BENCHMARK_VIEWS[benchmark]}
			plansChecked={plansChecked}
		/>,
	);
}

function markup(benchmark: BenchmarkId) {
	return markupOf(pagePoints(benchmark), benchmark);
}

const HTML_ENTITIES: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#x27;": "'",
};

function unescapeHtml(text: string): string {
	return text.replace(/&(?:amp|lt|gt|quot|#x27);/g, (e) => HTML_ENTITIES[e]);
}

const POINT_OPENING = '<g role="button" tabindex="0" aria-label="';

/** The accessible names of the chart's point buttons, in markup order. */
function pointLabels(html: string): string[] {
	return drawnPoints(html).map((p) => p.label);
}

/** Each chart point's accessible name and the path of its marker. */
function drawnPoints(html: string): { label: string; marker: string }[] {
	return html
		.split(POINT_OPENING)
		.slice(1)
		.map((chunk) => ({
			label: unescapeHtml(chunk.slice(0, chunk.indexOf('"'))),
			marker: /<path d="([^"]*)"/.exec(chunk)?.[1] ?? "",
		}));
}

/** Which marker a path draws, told apart by its corners. */
function markerShape(path: string): "circle" | "square" | "diamond" | "other" {
	if (path.includes("a")) return "circle";
	const corners = [...path.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)];
	if (corners.length !== 4) return "other";
	// A square's first two corners share a height; a diamond's do not.
	return corners[0][2] === corners[1][2] ? "square" : "diamond";
}

function pricingName({ pricing }: TimedPoint): string {
	return pricing.kind === "api" ? "API" : pricing.plan.label;
}

function sameEffort(a: TimedPoint, b: TimedPoint): boolean {
	return (
		a.benchmark.family === b.benchmark.family &&
		a.benchmark.effortLabel === b.benchmark.effortLabel
	);
}

/** How a point's accessible name starts: model, effort, pricing, cost. */
function labelPrefix(point: TimedPoint): string {
	const { family, effortLabel } = point.benchmark;
	return `${familyName(family)}, ${effortLabel}, ${pricingName(point)}, ${formatUsd(point.costPerTaskUsd)} per task`;
}

/** The label whose text starts as the point's accessible name does. */
function labelOf(labels: readonly string[], point: TimedPoint) {
	return labels.find((l) => l.startsWith(labelPrefix(point)));
}

/** Two points of one model and effort, priced under different pricings. */
function pricedTwoWays(timed: readonly TimedPoint[]): [TimedPoint, TimedPoint] {
	for (const a of timed) {
		const b = timed.find(
			(p) => sameEffort(a, p) && pricingName(a) !== pricingName(p),
		);
		if (b) return [a, b];
	}
	throw new Error("no effort priced two ways");
}

/** A point of the default page that another option beats. */
function beatenPoint(): TimedPoint {
	const timed = timedPoints(pagePoints("intelligence"));
	const worth = tradeoffFrontier(timed);
	const beaten = timed.find((p) => !worth.has(p));
	if (!beaten) throw new Error("no beaten point on the page");
	return beaten;
}

/** The points with the first plan's time per task unknown, as a benchmark
 * that never timed that plan's runs would leave them. */
function untimedFirstPlan(points: readonly ValuePoint[]): ValuePoint[] {
	const firstPlan = points.find((p) => p.pricing.kind === "plan");
	if (!firstPlan) throw new Error("no plan on the page");
	const id = pricingIdOf(firstPlan.pricing);
	return points.map((p) =>
		pricingIdOf(p.pricing) === id
			? { ...p, benchmark: { ...p.benchmark, secondsPerTask: null } }
			: p,
	);
}

/** The PNG key's text lines when every timed point of the page is exported. */
function exportLegend() {
	const all = timedPoints(pagePoints("intelligence"));
	const [first, ...rest] = all;
	if (!first) throw new Error("no points to export");
	const pricings = pricingStyles(buildSeries(all));
	const { legend } = tradeoffPng(
		{ pricings, shown: [first, ...rest] },
		VIEW_PRESETS.perspective,
		BENCHMARK_VIEWS.intelligence,
	);
	// The exporter draws each text node as one unwrapped line.
	const lines = renderToStaticMarkup(legend)
		.split(/<[^>]*>/)
		.map((text) => text.trim())
		.filter(Boolean);
	return { all, pricings, lines };
}

describe("TradeoffSection", () => {
	it("plots each timed option under every pricing, names each model and counts those worth weighing", () => {
		const timed = timedPoints(pagePoints("intelligence"));
		const html = markup("intelligence");
		// Model labels are buttons too, but pressed or not.
		const points = html.match(/<g role="button" tabindex="0" aria-label=/g);
		const labels = html.match(/aria-label="Highlight /g);
		const families = new Set(timed.map((p) => p.benchmark.family));
		const kinds = new Set(timed.map((p) => p.pricing.kind));
		expect(kinds).toEqual(new Set(["api", "plan"]));
		expect(points).toHaveLength(timed.length);
		expect(labels).toHaveLength(families.size);
		const worth = tradeoffFrontier(timed).size;
		expect(html).toContain(
			`${worth} of ${timed.length} options worth weighing`,
		);
	});

	it("leaves choosing pricings to the side panel", () => {
		expect(markup("intelligence")).not.toContain('aria-label="Prices to plot"');
	});

	it("hands the PNG export a key of short one-line text nodes with the counts, meanings and every plotted pricing", () => {
		const { all, pricings, lines } = exportLegend();
		const worth = tradeoffFrontier(all).size;
		expect(pricings.size).toBeGreaterThan(1);
		expect(lines.length).toBeGreaterThan(1);
		expect(lines.filter((line) => line.length > 60)).toEqual([]);
		expect(lines).toContain(`${worth} of ${all.length} options worth weighing`);
		expect(lines.join(" ")).toMatch(/Filled/);
		expect(lines.join(" ")).toMatch(/Hollow/);
		const names = [...pricings.values()].map((p) => p.label);
		expect(lines).toEqual(expect.arrayContaining(names));
	});

	it("names each point's pricing in its accessible name", () => {
		const timed = timedPoints(pagePoints("intelligence"));
		const labels = pointLabels(markup("intelligence"));
		expect(labels).toHaveLength(timed.length);
		expect(timed.filter((p) => labelOf(labels, p) === undefined)).toEqual([]);
		const [twin, other] = pricedTwoWays(timed);
		expect(labelOf(labels, twin)).not.toBe(labelOf(labels, other));
		expect(labelOf(labels, twin)).toContain(`, ${pricingName(twin)}, `);
		expect(labelOf(labels, other)).toContain(`, ${pricingName(other)}, `);
	});

	it("says a hollow point has another option no worse on every measure and better on one", () => {
		const label = labelOf(pointLabels(markup("intelligence")), beatenPoint());
		expect(label).toContain("beaten by another option");
		expect(label).not.toContain("beaten on cost, time and score");
		const stale = /all three|cost, time and score by another/;
		const wording = "no worse on cost, time and score, and better on one";
		const html = markup("intelligence");
		expect(html).toContain(`Hollow ones have another option ${wording}.`);
		expect(html).not.toMatch(stale);
		const { lines } = exportLegend();
		expect(lines).toContain(
			"Hollow: another is no worse on all, better on one",
		);
		expect(lines.join(" ")).not.toMatch(stale);
	});

	it("draws a plan's marker as the side panel does when the plans before it have no time per task", () => {
		const points = untimedFirstPlan(pagePoints("intelligence"));
		const planStyles = [...pricingStyles(buildSeries(points)).values()].filter(
			(style) => !style.isApi,
		);
		const later = planStyles[1];
		if (!later) throw new Error("fewer than two plans on the page");
		const timedOnly = pricingStyles(buildSeries(timedPoints(points)));
		expect(later.marker).toBe("diamond");
		// Styles built from timed points alone would hand the later plan a square.
		expect(timedOnly.get(later.id)?.marker).toBe("square");
		const drawn = drawnPoints(markupOf(points, "intelligence"));
		const laterPoints = timedPoints(points).filter(
			(p) => pricingIdOf(p.pricing) === later.id,
		);
		expect(laterPoints.length).toBeGreaterThan(0);
		const shapes = laterPoints.map((p) => {
			const found = drawn.find((d) => d.label.startsWith(labelPrefix(p)));
			return markerShape(found?.marker ?? "");
		});
		expect(shapes).toEqual(laterPoints.map(() => "diamond"));
	});

	it("explains an empty chart on a benchmark that never times its tasks", () => {
		const html = markup("frontiercode");
		expect(html).not.toContain('aria-roledescription="3D chart"');
		expect(html).toContain("No plotted model has a time per task");
	});

	it("tells the visitor to check a plan when nothing is plotted and none is checked", () => {
		const html = markupOf([], "intelligence", false);
		expect(html).toContain(
			"Nothing to plot. Check a plan to compare it with API prices.",
		);
	});

	it("keeps the pick-a-model message when plans are checked", () => {
		const html = markupOf([], "intelligence");
		expect(html).toContain("Nothing to plot. Pick a model, or measure a plan.");
	});
});
