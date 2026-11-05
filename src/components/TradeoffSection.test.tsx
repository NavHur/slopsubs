import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { VIEW_PRESETS } from "#/components/chart/projection";
import { buildSeries, pricingStyles } from "#/components/chart/series";
import { leaderboards, plans, samples } from "#/data";
import type { BenchmarkId } from "#/domain/enums";
import { tradeoffFrontier, timedPoints } from "#/domain/tradeoffs";
import { valuePoints } from "#/domain/value";
import { BENCHMARK_VIEWS } from "#/lib/benchmarks";
import { selectedFamilies, selectedPlans, ViewSearch } from "#/lib/view";
import { tradeoffPng } from "./TradeoffKey";
import { TradeoffSection } from "./TradeoffSection";

/** The page's default selection on one benchmark tab. */
function pagePoints(benchmark: BenchmarkId) {
	const view = ViewSearch.parse({ benchmark });
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

function markup(benchmark: BenchmarkId) {
	return renderToStaticMarkup(
		<TradeoffSection
			points={pagePoints(benchmark)}
			view={BENCHMARK_VIEWS[benchmark]}
		/>,
	);
}

describe("TradeoffSection", () => {
	it("plots each timed option at API prices, names each model and counts those worth weighing", () => {
		const api = timedPoints(pagePoints("intelligence")).filter(
			(p) => p.pricing.kind === "api",
		);
		const html = markup("intelligence");
		// Model labels are buttons too, but pressed or not.
		const points = html.match(/<g role="button" tabindex="0" aria-label=/g);
		const labels = html.match(/aria-label="Highlight /g);
		const families = new Set(api.map((p) => p.benchmark.family));
		expect(api.length).toBeGreaterThan(0);
		expect(points).toHaveLength(api.length);
		expect(labels).toHaveLength(families.size);
		const worth = tradeoffFrontier(api).size;
		expect(html).toContain(`API prices: ${worth} of ${api.length} options`);
	});

	it("hands the PNG export a key of short one-line text nodes with the counts and meanings", () => {
		const api = timedPoints(pagePoints("intelligence")).filter(
			(p) => p.pricing.kind === "api",
		);
		const [first, ...rest] = api;
		const pricing = pricingStyles(buildSeries(api)).values().next().value;
		if (!first || !pricing) throw new Error("no API points to export");
		const { legend } = tradeoffPng(
			{ pricing, shown: [first, ...rest] },
			VIEW_PRESETS.perspective,
			BENCHMARK_VIEWS.intelligence,
		);
		// The exporter draws each text node as one unwrapped line.
		const lines = renderToStaticMarkup(legend)
			.split(/<[^>]*>/)
			.map((text) => text.trim())
			.filter(Boolean);
		const worth = tradeoffFrontier(api).size;
		expect(lines.length).toBeGreaterThan(1);
		for (const line of lines) expect(line.length).toBeLessThanOrEqual(60);
		expect(lines).toContain(`${worth} of ${api.length} options worth weighing`);
		expect(lines.join(" ")).toMatch(/Filled/);
		expect(lines.join(" ")).toMatch(/Hollow/);
	});

	it("explains an empty chart on a benchmark that never times its tasks", () => {
		const html = markup("frontiercode");
		expect(html).not.toContain('aria-roledescription="3D chart"');
		expect(html).toContain("No plotted model has a time per task");
	});
});
