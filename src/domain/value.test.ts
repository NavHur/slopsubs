import { describe, expect, it } from "vite-plus/test";
import type {
	BenchmarkPoint,
	FamilyId,
	LimitSample,
	Plan,
	PlanId,
} from "./model";
import {
	planCapacity,
	valueMultiple,
	valuePoints,
	weeklyAllowance,
} from "./value";

const opus = "claude-opus-5-5" as FamilyId;
const maxPlan = "claude-max-20x" as PlanId;

const plan: Plan = {
	id: maxPlan,
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

function sample(start: number, end: number, apiUsd: number): LimitSample {
	return {
		plan: maxPlan,
		from: "2026-10-12T00:00:00Z",
		to: "2026-10-12T06:00:00Z",
		startUsedPercent: start,
		endUsedPercent: end,
		apiUsd,
		apiUsdByFamily: { [opus]: apiUsd },
		host: "mac",
	};
}

function benchmark(
	effort: "none" | "low" | "max",
	order: number,
): BenchmarkPoint {
	return {
		id: `${opus}-${effort}`,
		family: opus,
		name: "Claude Opus 5.5",
		lab: "anthropic",
		labName: "Anthropic",
		deprecated: false,
		effort,
		effortLabel: effort,
		effortOrder: order,
		score: 40 + order,
		costPerTaskUsd: order,
		tokensPerTask: 1000,
		secondsPerTask: 120,
		inputPricePerMTokUsd: 5,
		outputPricePerMTokUsd: 25,
	};
}

describe("planCapacity", () => {
	const reportedCap = {
		weeklyCapApiUsd: 1800,
		by: "Theo",
		url: "https://example.com/video",
		basis: "$8,000 a month",
	};

	it("is unmeasured without samples", () => {
		expect(planCapacity(plan, [])).toEqual({ kind: "unmeasured" });
	});

	it("falls back to a reported cap without samples", () => {
		expect(planCapacity({ ...plan, reportedCap }, [])).toEqual({
			kind: "reported",
			weeklyCapApiUsd: 1800,
			report: reportedCap,
		});
	});

	it("prefers a vendor's published allowance over a reported cap", () => {
		const publishedAllowance = {
			apiUsdPerMonthByFamily: { [opus]: 60 },
			url: "https://example.com/limits",
			basis: "monthly usage by model",
		};
		expect(
			planCapacity({ ...plan, reportedCap, publishedAllowance }, []),
		).toEqual({ kind: "published", allowance: publishedAllowance });
	});

	it("prefers samples over a reported cap", () => {
		expect(
			planCapacity({ ...plan, reportedCap }, [sample(10, 20, 100)]),
		).toMatchObject({ kind: "measured", weeklyCapApiUsd: 1000 });
	});

	it("extrapolates pooled samples to a full weekly gauge", () => {
		const capacity = planCapacity(plan, [
			sample(10, 20, 150),
			sample(40, 50, 50),
		]);
		expect(capacity).toMatchObject({
			kind: "measured",
			weeklyCapApiUsd: 1000,
			sampleCount: 2,
		});
	});
});

describe("weeklyAllowance", () => {
	const fable = "claude-fable-5-1" as FamilyId;
	const reported = {
		kind: "reported",
		weeklyCapApiUsd: 1000,
		report: {
			weeklyCapApiUsd: 1000,
			by: "Theo",
			url: "https://example.com/video",
			basis: "estimate",
		},
	} as const;

	it("gives a family the whole reported cap, as an estimate", () => {
		expect(weeklyAllowance(plan, reported, opus)).toEqual({
			apiUsd: 1000,
			basis: "estimated",
			share: 1,
		});
	});

	it("gives a capped family only its share of the weekly cap", () => {
		const capped = { ...plan, weeklyShareByFamily: { [fable]: 0.5 } };
		expect(weeklyAllowance(capped, reported, fable)).toEqual({
			apiUsd: 500,
			basis: "estimated",
			share: 0.5,
		});
	});

	it("averages a published monthly allowance over the weeks of a month", () => {
		const published = {
			kind: "published",
			allowance: {
				apiUsdPerMonthByFamily: { [opus]: 52 },
				url: "https://example.com/limits",
				basis: "monthly usage by model",
			},
		} as const;
		expect(weeklyAllowance(plan, published, opus)).toEqual({
			apiUsd: 12,
			basis: "published",
			share: 1,
		});
		expect(weeklyAllowance(plan, published, fable)).toBeNull();
	});

	it("is unknown for an unmeasured plan", () => {
		expect(weeklyAllowance(plan, { kind: "unmeasured" }, opus)).toBeNull();
	});
});

describe("valueMultiple", () => {
	const allowance = { apiUsd: 1200, basis: "measured", share: 1 } as const;

	it("divides a month of weekly usage by the subscription price", () => {
		expect(valueMultiple({ plan, allowance })).toBeCloseTo(5200 / 200);
	});

	it("counts bundled API credit as usage", () => {
		const withCredit = { ...plan, includedApiCreditUsd: 200 };
		expect(valueMultiple({ plan: withCredit, allowance })).toBeCloseTo(
			(5200 + 200) / 200,
		);
	});
});

describe("valuePoints", () => {
	const benchmarks = [benchmark("max", 8), benchmark("low", 2)];

	it("divides API cost per task by the plan's value multiple", () => {
		const points = valuePoints({
			benchmarks,
			families: [opus],
			plans: [plan],
			samples: [sample(0, 10, 120)],
			showApi: true,
			hiddenEfforts: [],
		});
		const multiple = (1200 * 52) / 12 / 200;
		expect(
			points.map((p) => [p.seriesId, p.benchmark.effort, p.costPerTaskUsd]),
		).toEqual([
			[`${opus}@api`, "low", 2],
			[`${opus}@api`, "max", 8],
			[`${opus}@${maxPlan}`, "low", 2 / multiple],
			[`${opus}@${maxPlan}`, "max", 8 / multiple],
		]);
	});

	it("leaves out hidden reasoning efforts", () => {
		const points = valuePoints({
			benchmarks: [benchmark("none", 0), ...benchmarks],
			families: [opus],
			plans: [],
			samples: [],
			showApi: true,
			hiddenEfforts: ["none", "max"],
		});
		expect(points.map((p) => p.benchmark.effort)).toEqual(["low"]);
	});

	it("plots the non-reasoning variant first when shown", () => {
		const points = valuePoints({
			benchmarks: [...benchmarks, benchmark("none", 0)],
			families: [opus],
			plans: [],
			samples: [],
			showApi: true,
			hiddenEfforts: [],
		});
		expect(points.map((p) => p.benchmark.effort)).toEqual([
			"none",
			"low",
			"max",
		]);
	});

	it("omits plans that have not been measured", () => {
		const points = valuePoints({
			benchmarks,
			families: [opus],
			plans: [plan],
			samples: [],
			showApi: false,
			hiddenEfforts: [],
		});
		expect(points).toEqual([]);
	});

	it("plots only the efforts a plan serves", () => {
		const points = valuePoints({
			benchmarks,
			families: [opus],
			plans: [{ ...plan, maxEffortByFamily: { [opus]: "low" } }],
			samples: [sample(0, 10, 120)],
			showApi: true,
			hiddenEfforts: [],
		});
		expect(points.map((p) => [p.seriesId, p.benchmark.effort])).toEqual([
			[`${opus}@api`, "low"],
			[`${opus}@api`, "max"],
			[`${opus}@${maxPlan}`, "low"],
		]);
	});

	it("values each family by its own published allowance", () => {
		const haiku = "claude-haiku-5-5" as FamilyId;
		const goPlan: Plan = {
			...plan,
			monthlyPriceUsd: 10,
			families: [opus, haiku],
			publishedAllowance: {
				apiUsdPerMonthByFamily: { [opus]: 15, [haiku]: 60 },
				url: "https://example.com/limits",
				basis: "monthly usage by model",
			},
		};
		const points = valuePoints({
			benchmarks: [
				...benchmarks,
				{ ...benchmark("max", 8), family: haiku, id: "haiku-max" },
			],
			families: [opus, haiku],
			plans: [goPlan],
			samples: [],
			showApi: false,
			hiddenEfforts: [],
		});
		expect(
			points.map((p) => [
				p.benchmark.family,
				p.benchmark.effort,
				p.costPerTaskUsd,
			]),
		).toEqual([
			[opus, "low", 2 / 1.5],
			[opus, "max", 8 / 1.5],
			[haiku, "max", 8 / 6],
		]);
	});
});
