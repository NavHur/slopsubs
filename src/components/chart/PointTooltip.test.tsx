import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { plans } from "#/data";
import type { FamilyId } from "#/domain/model";
import type { ValuePoint } from "#/domain/value";
import { BENCHMARK_VIEWS, type BenchmarkView } from "#/lib/benchmarks";
import { familyColor } from "#/lib/families";
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
		secondsPerTask: 711.4,
		inputPricePerMTokUsd: 5,
		outputPricePerMTokUsd: 25,
	},
	score: 45.45,
	costPerTaskUsd: 12.821,
	pricing: { kind: "api" },
};

function tooltipHtml(view: BenchmarkView, shown: ValuePoint = point) {
	return renderToStaticMarkup(
		<PointTooltip
			point={shown}
			anchor={{ x: 0, y: 0 }}
			bounds={{ width: 800, height: 600 }}
			pinned={false}
			onClose={() => {}}
			view={view}
		/>,
	);
}

function tooltipText(view: BenchmarkView, shown: ValuePoint = point) {
	return tooltipHtml(view, shown).replace(/<[^>]+>/g, " ");
}

describe("point tooltip", () => {
	it("names FrontierCode's token count as output tokens", () => {
		expect(tooltipText(BENCHMARK_VIEWS.frontiercode)).toContain(
			"Output tokens per task",
		);
	});

	it("shows how long the task took where the benchmark timed it", () => {
		expect(tooltipText(BENCHMARK_VIEWS.intelligence)).toMatch(
			/Time per task\s+11m 51s/,
		);
	});

	it("leaves out the time where the benchmark did not time the task", () => {
		const untimed = {
			...point,
			benchmark: { ...point.benchmark, secondsPerTask: null },
		};
		expect(tooltipText(BENCHMARK_VIEWS.intelligence, untimed)).not.toContain(
			"Time per task",
		);
	});

	function onUltra(share: number): ValuePoint {
		const plan = plans.find((p) => p.id === "claude-max-20x");
		if (!plan) throw new Error("claude-max-20x is missing from plans.json");
		const allowance = {
			apiUsd: 100 * share,
			capApiUsd: 100,
			basis: "estimated",
			source: "estimate",
			share,
		} as const;
		return {
			...point,
			pricing: { kind: "plan", plan, allowance, valueMultiple: 3 },
		};
	}

	it("says when the plan holds the model to part of its weekly cap", () => {
		expect(tooltipText(BENCHMARK_VIEWS.intelligence, onUltra(0.5))).toMatch(
			/Up to half the weekly cap/,
		);
	});

	it("leaves out the cap note when the model may use the whole cap", () => {
		expect(tooltipText(BENCHMARK_VIEWS.intelligence, onUltra(1))).not.toMatch(
			/weekly cap/,
		);
	});

	it("uses the brand colour only for the model's dot, never its name", () => {
		const html = tooltipHtml(BENCHMARK_VIEWS.intelligence);
		const brand = familyColor(opus);
		const dot = html.match(
			/<svg aria-hidden="true"[^>]*><circle[^>]*fill="([^"]*)"/,
		);
		expect(dot?.[1]).toBe(brand);
		expect(html.split(brand)).toHaveLength(2);
	});
});
