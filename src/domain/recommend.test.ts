import { describe, expect, it } from "vite-plus/test";
import type { BenchmarkPoint, Effort, FamilyId, Plan, PlanId } from "./model";
import { recommendPlans, type Workload } from "./recommend";
import { planCapacity } from "./value";

const opus = "claude-opus-5-5" as FamilyId;
const fable = "claude-fable-5-2" as FamilyId;
const sonnet = "claude-sonnet-5-5" as FamilyId;

function plan(id: string, overrides: Partial<Plan>): Plan {
	return {
		id: id as PlanId,
		vendor: "Anthropic",
		lab: "anthropic",
		label: id,
		monthlyPriceUsd: 20,
		harnesses: ["Claude Code"],
		families: [opus],
		limits: "weekly cap",
		allowanceKind: "rate-window",
		includedApiCreditUsd: 0,
		thirdPartyHarnessAllowed: false,
		confidence: "primary",
		sourceUrl: `https://example.com/${id}`,
		reportedCap: null,
		publishedAllowance: null,
		weeklyShareByFamily: {},
		maxEffortByFamily: {},
		promotionByFamily: {},
		...overrides,
	};
}

function reported(caps: Record<string, number>) {
	return {
		weeklyCapApiUsdByFamily: caps,
		by: "Theo",
		url: "https://example.com/theo",
		basis: "Theo's measurement",
	};
}

/** $20 a month, $300 a week of Opus or Sonnet. */
const pro = plan("pro", {
	families: [opus, sonnet],
	reportedCap: reported({ [opus]: 300, [sonnet]: 300 }),
});

/**
 * $100 a month, $1,500 a week of Opus and $600 of Fable, which may use half
 * the weekly limit, and $100 of API credit a month.
 */
const max = plan("max", {
	monthlyPriceUsd: 100,
	families: [opus, sonnet, fable],
	includedApiCreditUsd: 100,
	reportedCap: reported({ [opus]: 1500, [sonnet]: 1500, [fable]: 600 }),
	weeklyShareByFamily: { [fable]: 0.5 },
});

function point(family: FamilyId, costPerTaskUsd: number): BenchmarkPoint {
	return {
		id: `${family}-high`,
		family,
		name: family,
		lab: "anthropic",
		labName: "Anthropic",
		deprecated: false,
		effort: "high",
		effortLabel: "High",
		effortOrder: 5,
		score: 50,
		costPerTaskUsd,
		tokensPerTask: null,
		secondsPerTask: null,
		inputPricePerMTokUsd: null,
		outputPricePerMTokUsd: null,
	};
}

const POINTS = [point(opus, 2), point(sonnet, 1), point(fable, 5)];

function recommend(plans: readonly Plan[], workload: Workload) {
	return recommendPlans({
		plans: plans.map((p) => ({ plan: p, capacity: planCapacity(p, []) })),
		points: POINTS,
		workload,
	});
}

function apiUsd(apiUsdPerWeek: number, families: FamilyId[]): Workload {
	return {
		models: {
			kind: "chosen",
			weights: families.map((family) => ({ family, weight: 1 })),
		},
		usage: { unit: "apiUsd", apiUsdPerWeek },
		monthlyBudgetUsd: null,
	};
}

function weighted(
	apiUsdPerWeek: number,
	weights: [FamilyId, number][],
): Workload {
	return {
		models: {
			kind: "chosen",
			weights: weights.map(([family, weight]) => ({ family, weight })),
		},
		usage: { unit: "apiUsd", apiUsdPerWeek },
		monthlyBudgetUsd: null,
	};
}

function tasks(
	tasksPerWeek: number,
	families: FamilyId[],
	effort: Effort = "high",
): Workload {
	return {
		models: {
			kind: "chosen",
			weights: families.map((family) => ({ family, weight: 1 })),
		},
		usage: { unit: "tasks", tasksPerWeek, effort },
		monthlyBudgetUsd: null,
	};
}

function ranked(result: ReturnType<typeof recommend>) {
	if (result.kind !== "ranked") throw new Error(`unexpected ${result.kind}`);
	return result;
}

describe("recommendPlans", () => {
	it("says paying per token is cheaper for a light week", () => {
		const result = ranked(recommend([pro, max], apiUsd(3, [opus])));
		expect(result.apiUsdPerMonth).toBeCloseTo(13);
		expect(result.fits.map((f) => f.plan.id)).toEqual(["pro", "max"]);
		expect(result.apiCheaper).toBe(true);
	});

	it("puts paying per token's break-even at the cheapest plan's price", () => {
		const result = ranked(recommend([pro, max], apiUsd(3, [opus])));
		// $20 a month buys $4.62 a week at API prices, which Pro still covers.
		expect((result.breakEvenScale ?? 0) * 3).toBeCloseTo(4.615, 2);
	});

	it("quotes the last usage at which paying per token still wins", () => {
		// $5 a month covers only $2 a week, so Pro is the plan for $3 a week.
		const small = plan("small", {
			monthlyPriceUsd: 5,
			reportedCap: reported({ [opus]: 2 }),
		});
		const result = ranked(recommend([small, pro], apiUsd(3, [opus])));
		// $13 a month of API beats Pro's $20, and still does up to Pro's $4.62.
		expect(result.apiCheaper).toBe(true);
		expect((result.breakEvenScale ?? 0) * 3).toBeCloseTo(4.615, 2);
	});

	it("holds Fable to half of Max's weekly limit while Opus fits", () => {
		const heavyFable = ranked(recommend([max], apiUsd(500, [fable])));
		expect(heavyFable.fits).toEqual([]);
		expect(heavyFable.short).toMatchObject([{ binding: fable }]);
		const sameOpus = ranked(recommend([max], apiUsd(500, [opus])));
		expect(sameOpus.fits).toMatchObject([{ plan: { id: "max" } }]);
		expect(sameOpus.fits[0].capUse).toBeCloseTo(1 / 3);
	});

	it("sums each family's gauge use on a shared cap", () => {
		// $900 of Opus fills 60% of the gauge, $150 of Fable 25%.
		const result = ranked(
			recommend(
				[max],
				weighted(1050, [
					[opus, 6],
					[fable, 1],
				]),
			),
		);
		expect(result.fits[0].capUse).toBeCloseTo(0.85);
	});

	it("reports how much of the week a plan covers when the gauge overflows", () => {
		// $1,000 of Opus (67% of the gauge) and $250 of Fable (42%) overflow it;
		// moving $50 of Fable out costs $217 a month, $117 more than the credit.
		const result = ranked(
			recommend(
				[max],
				weighted(1250, [
					[opus, 4],
					[fable, 1],
				]),
			),
		);
		expect(result.short).toHaveLength(1);
		expect(result.short[0].binding).toBe(opus);
		expect(result.short[0].shortUsdPerMonth).toBeCloseTo(116.67, 1);
		expect(result.short[0].coverage).toBeCloseTo(0.9785, 3);
	});

	it("spends included API credit on a small overflow", () => {
		const result = ranked(recommend([max], apiUsd(1510, [opus])));
		expect(result.fits).toHaveLength(1);
		expect(result.fits[0].capUse).toBe(1);
		expect(result.fits[0].creditUsdPerMonth).toBeCloseTo(43.33, 1);
	});

	it("sets aside plans it can't size and plans missing a model", () => {
		const unknown = plan("unknown", { families: [opus, fable] });
		const result = ranked(
			recommend([pro, unknown, max], apiUsd(100, [opus, fable])),
		);
		expect(result.fits.map((f) => f.plan.id)).toEqual(["max"]);
		expect(result.unsized.map((p) => p.id)).toEqual(["unknown"]);
		expect(result.gaps).toMatchObject([
			{ plan: { id: "pro" }, family: fable, gap: "model" },
		]);
	});

	it("says when a plan doesn't serve a model at the effort", () => {
		const capped = plan("capped", {
			reportedCap: reported({ [opus]: 300 }),
			maxEffortByFamily: { [opus]: "medium" },
		});
		const result = ranked(recommend([capped], tasks(10, [opus])));
		expect(result.gaps).toMatchObject([{ family: opus, gap: "effort" }]);
	});

	it("gives the same answer for tasks and their API-priced dollars", () => {
		// 100 Opus tasks at $2 and 100 Sonnet tasks at $1.
		const byTasks = recommend([pro, max], tasks(200, [opus, sonnet]));
		expect(byTasks).toEqual(recommend([pro, max], apiUsd(300, [opus, sonnet])));
	});

	it("won't guess a cost for a model the benchmark didn't run at the effort", () => {
		expect(recommend([pro], tasks(10, [opus], "max"))).toEqual({
			kind: "unpriced",
			families: [opus],
		});
	});

	it("sets aside plans above the budget", () => {
		const result = ranked(
			recommend([pro, max], { ...apiUsd(100, [opus]), monthlyBudgetUsd: 50 }),
		);
		expect(result.fits.map((f) => f.plan.id)).toEqual(["pro"]);
		expect(result.overBudget.map((p) => p.id)).toEqual(["max"]);
	});

	it("offers the cheapest over-budget plan that still fits", () => {
		const result = ranked(
			recommend([pro, max], { ...apiUsd(500, [opus]), monthlyBudgetUsd: 10 }),
		);
		expect(result.fits).toEqual([]);
		expect(result.cheapestOverBudget).toMatchObject({
			budgetUsd: 10,
			fit: { plan: { id: "max" } },
		});
	});

	it("offers no over-budget plan without a budget", () => {
		expect(
			ranked(recommend([pro], apiUsd(5000, [opus]))).cheapestOverBudget,
		).toBeNull();
	});

	it("runs an any-model week on whichever model each plan serves best", () => {
		const any: Workload = {
			models: { kind: "any", families: [fable, opus] },
			usage: { unit: "apiUsd", apiUsdPerWeek: 500 },
			monthlyBudgetUsd: null,
		};
		const result = ranked(recommend([max], any));
		expect(result.fits).toMatchObject([{ families: [opus] }]);
	});
});
