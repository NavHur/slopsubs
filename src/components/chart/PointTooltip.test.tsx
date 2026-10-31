import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import type { FamilyId } from "#/domain/model";
import type { ValuePoint } from "#/domain/value";
import { BENCHMARK_VIEWS, type BenchmarkView } from "#/lib/benchmarks";
import { PointTooltip } from "./PointTooltip";

const opus = "claude-opus-5-5" as FamilyId;

const point: ValuePoint = {
	seriesId: `${opus}@api`,
	benchmark: {
		id: `${opus}-max`,
		family: opus,
		name: "Claude Opus 5.5",
		lab: "anthropic",
		labName: "Anthropic",
		deprecated: false,
		effort: "max",
		effortLabel: "max",
		effortOrder: 0,
		score: 45.45,
		costPerTaskUsd: 12.821,
		tokensPerTask: 201919,
		inputPricePerMTokUsd: 5,
		outputPricePerMTokUsd: 25,
	},
	score: 45.45,
	costPerTaskUsd: 12.821,
	pricing: { kind: "api" },
};

function tooltipText(view: BenchmarkView) {
	const html = renderToStaticMarkup(
		<PointTooltip
			point={point}
			anchor={{ x: 0, y: 0 }}
			bounds={{ width: 800, height: 600 }}
			pinned={false}
			onClose={() => {}}
			view={view}
		/>,
	);
	return html.replace(/<[^>]+>/g, " ");
}

describe("point tooltip", () => {
	it("names FrontierCode's token count as output tokens", () => {
		expect(tooltipText(BENCHMARK_VIEWS.frontiercode)).toContain(
			"Output tokens per task",
		);
	});
});
