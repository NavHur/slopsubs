import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { leaderboards, plans, samples } from "#/data";
import type { BenchmarkId } from "#/domain/model";
import { tradeoffFrontier, timedPoints } from "#/domain/tradeoffs";
import { valuePoints } from "#/domain/value";
import { BENCHMARK_VIEWS } from "#/lib/benchmarks";
import { selectedFamilies, selectedPlans, ViewSearch } from "#/lib/view";
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
	it("plots each timed option at API prices and counts those worth weighing", () => {
		const api = timedPoints(pagePoints("intelligence")).filter(
			(p) => p.pricing.kind === "api",
		);
		const html = markup("intelligence");
		const buttons = html.match(/<g role="button"/g) ?? [];
		expect(api.length).toBeGreaterThan(0);
		expect(buttons).toHaveLength(api.length);
		const worth = tradeoffFrontier(api).size;
		expect(html).toContain(`API prices: ${worth} of ${api.length} options`);
	});

	it("explains an empty chart on a benchmark that never times its tasks", () => {
		const html = markup("frontiercode");
		expect(html).not.toContain('aria-roledescription="3D chart"');
		expect(html).toContain("No plotted model has a time per task");
	});
});
