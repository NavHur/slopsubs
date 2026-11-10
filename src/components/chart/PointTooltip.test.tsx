import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import type { FamilyId, Plan, PlanId } from "#/domain/model";
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

const plan: Plan = {
	id: "claude-max-20x" as PlanId,
	vendor: "Anthropic",
	lab: "anthropic",
	label: "Max 20x",
	monthlyPriceUsd: 200,
	harnesses: ["Claude Code"],
	families: [opus],
	limits: "weekly cap",
	includedApiCreditUsd: 0,
	thirdPartyHarnessAllowed: false,
	confidence: "primary",
	sourceUrl: "https://example.com/pricing",
	reportedCap: null,
	publishedAllowance: null,
	weeklyShareByFamily: {},
	maxEffortByFamily: {},
	promotionByFamily: {},
};

function tooltipHtml(
	view: BenchmarkView,
	shown: ValuePoint = point,
	selected: ValuePoint | null = null,
) {
	return renderToStaticMarkup(
		<PointTooltip
			point={shown}
			selected={selected}
			anchor={{ x: 0, y: 0 }}
			bounds={{ width: 800, height: 600 }}
			pinned={false}
			onClose={() => {}}
			view={view}
		/>,
	);
}

function tooltipText(
	view: BenchmarkView,
	shown: ValuePoint = point,
	selected: ValuePoint | null = null,
) {
	return tooltipHtml(view, shown, selected).replace(/<[^>]+>/g, " ");
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

	describe("compared with a selected point", () => {
		const cheaper: ValuePoint = {
			...point,
			score: 36.36,
			costPerTaskUsd: 3.2052,
			benchmark: {
				...point.benchmark,
				id: `${opus}-low`,
				effortLabel: "low",
				tokensPerTask: null,
				secondsPerTask: 355.7,
			},
		};
		const text = () =>
			tooltipText(BENCHMARK_VIEWS.intelligence, point, cheaper).replace(
				/\s+/g,
				" ",
			);

		it("names the selected point", () => {
			expect(text()).toContain("vs Opus 5.5 · low");
		});

		it("gives a score's change in points", () => {
			expect(text()).toMatch(/Intelligence index 36\.4 45\.5 \+9\.1 pts/);
		});

		it("says which way a cost or time moved instead of a bare ratio", () => {
			expect(text()).toMatch(/Cost per task \$3\.21 \$12\.82 4\.0× pricier/);
			expect(text()).toMatch(/Time per task 5m 56s 11m 51s 2\.0× slower/);
		});

		it("marks a figure only one point has instead of dividing by it", () => {
			expect(text()).toMatch(/tokens per task — 202k — /i);
		});

		it("calls figures that round to the same multiple the same", () => {
			const twin = { ...cheaper, costPerTaskUsd: 3.25 };
			const html = tooltipText(BENCHMARK_VIEWS.intelligence, twin, cheaper);
			expect(html.replace(/\s+/g, " ")).toMatch(/\$3\.21 \$3\.25 Same/);
		});
	});
});
