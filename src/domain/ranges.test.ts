import { describe, expect, it } from "vite-plus/test";
import type { BenchmarkPoint, FamilyId, Plan, PlanId } from "./model";
import { rankedCost, tasksPerWeek } from "./ranges";
import { valuePoints } from "./value";

const opus = "claude-opus-5-5" as FamilyId;
const fable = "claude-fable-5-1" as FamilyId;

const ultra: Plan = {
	id: "claude-max-20x" as PlanId,
	vendor: "Claude Code",
	lab: "anthropic",
	label: "Claude Ultra",
	monthlyPriceUsd: 200,
	harnesses: ["Claude Code"],
	families: [opus, fable],
	limits: "weekly cap",
	includedApiCreditUsd: 200,
	thirdPartyHarnessAllowed: false,
	confidence: "primary",
	sourceUrl: "https://example.com/pricing",
	reportedCap: {
		weeklyCapApiUsd: 100,
		by: "Theo",
		url: "https://example.com/video",
		basis: "estimate",
	},
	publishedAllowance: null,
	weeklyShareByFamily: { [fable]: 0.5 },
	maxEffortByFamily: {},
	promotionByFamily: {},
};

const go: Plan = {
	...ultra,
	id: "opencode-go" as PlanId,
	label: "OpenCode Go",
	monthlyPriceUsd: 10,
	families: [opus],
	includedApiCreditUsd: 0,
	reportedCap: null,
	publishedAllowance: {
		apiUsdPerMonthByFamily: { [opus]: 52 },
		url: "https://example.com/limits",
		basis: "monthly usage by model",
	},
	weeklyShareByFamily: {},
};

function benchmark(
	family: FamilyId,
	effort: "low" | "max",
	costPerTaskUsd: number,
): BenchmarkPoint {
	return {
		id: `${family}-${effort}`,
		family,
		name: family,
		lab: "anthropic",
		labName: "Anthropic",
		deprecated: false,
		effort,
		effortLabel: effort,
		effortOrder: effort === "low" ? 2 : 8,
		score: 40,
		costPerTaskUsd,
		tokensPerTask: 1000,
		secondsPerTask: null,
		inputPricePerMTokUsd: 5,
		outputPricePerMTokUsd: 25,
	};
}

const benchmarks = [
	benchmark(opus, "max", 4),
	benchmark(opus, "low", 2),
	benchmark(fable, "low", 2),
];

function pointsOf(plans: Plan[], showApi: boolean) {
	return valuePoints({
		benchmarks,
		families: [opus, fable],
		plans,
		samples: [],
		showApi,
		hiddenEfforts: [],
	});
}

function tasksOf(plans: Plan[], showApi = false) {
	return tasksPerWeek(pointsOf(plans, showApi)).map(({ plan, rows }) => ({
		plan: plan.id,
		rows: rows.map((row) => ({
			family: row.family,
			tasks: row.efforts.map((e) => [e.benchmark.effort, e.value]),
		})),
	}));
}

describe("tasksPerWeek", () => {
	it("divides the weekly cap by each effort's API price per task", () => {
		expect(tasksOf([ultra])[0].rows[0]).toEqual({
			family: opus,
			tasks: [
				["low", 50],
				["max", 25],
			],
		});
	});

	it("gives a family with half the cap half the tasks", () => {
		expect(tasksOf([ultra])[0].rows[1]).toEqual({
			family: fable,
			tasks: [["low", 25]],
		});
	});

	it("spreads a published monthly allowance evenly over its weeks", () => {
		// $52 a month is $12 a week: six $2 tasks, three $4 ones.
		expect(tasksOf([go])[0].rows[0].tasks).toEqual([
			["low", 6],
			["max", 3],
		]);
	});

	it("groups rows by plan, in the order the plans were chosen", () => {
		expect(tasksOf([go, ultra], true).map((p) => p.plan)).toEqual([
			"opencode-go",
			"claude-max-20x",
		]);
	});

	it("leaves out API pricing, which has no weekly cap", () => {
		expect(tasksOf([], true)).toEqual([]);
	});
});

describe("rankedCost", () => {
	function ranked(plans: Plan[], showApi: boolean) {
		return rankedCost(pointsOf(plans, showApi)).map((row) => ({
			id: row.seriesId,
			costs: row.efforts.map((e) => [e.benchmark.effort, e.value]),
		}));
	}

	it("ranks rows by their cheapest effort, plan and API alike", () => {
		// Ultra's $100 weekly cap is $433 a month; with $200 of credit on a
		// $200 plan that is 3.17x for Opus, and 2.08x on Fable's half cap.
		const rows = ranked([ultra], true);
		expect(rows.map((r) => r.id)).toEqual([
			"claude-opus-5-5@claude-max-20x",
			"claude-fable-5-1@claude-max-20x",
			"claude-fable-5-1@api",
			"claude-opus-5-5@api",
		]);
	});

	it("keeps each row's efforts lowest first at their effective cost", () => {
		const apiOpus = ranked([], true).find((r) => r.id.startsWith(opus));
		expect(apiOpus?.costs).toEqual([
			["low", 2],
			["max", 4],
		]);
	});

	it("breaks ties by series so the order is stable", () => {
		const ids = ranked([], true).map((r) => r.id);
		expect(ids).toEqual([...ids].sort());
	});
});
