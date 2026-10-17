import { describe, expect, it } from "vitest";
import {
	type BenchmarkPoint,
	type FamilyId,
	type LimitSample,
	type Plan,
	type PlanId,
	USAGE_PROFILES,
} from "./model";
import { planCapacity, valueMultiple, valuePoints } from "./value";

const [maxed, , light] = USAGE_PROFILES;
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
		intelligence: 40 + order,
		costPerTaskUsd: order,
		tokensPerTask: 1000,
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

describe("valueMultiple", () => {
	it("scales with the share of the weekly cap used", () => {
		const weeklyCapApiUsd = 1200;
		const full = valueMultiple({ plan, weeklyCapApiUsd, profile: maxed });
		expect(full).toBeCloseTo((1200 * 52) / 12 / 200);
		expect(
			valueMultiple({ plan, weeklyCapApiUsd, profile: light }),
		).toBeCloseTo(full * 0.2);
	});

	it("counts bundled API credit at the same usage share", () => {
		const withCredit = { ...plan, includedApiCreditUsd: 200 };
		expect(
			valueMultiple({
				plan: withCredit,
				weeklyCapApiUsd: 1200,
				profile: light,
			}),
		).toBeCloseTo((((1200 * 52) / 12 + 200) * 0.2) / 200);
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
			profile: maxed,
			showApi: true,
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

	it("drops the non-reasoning variant when reasoning efforts exist", () => {
		const points = valuePoints({
			benchmarks: [benchmark("none", 0), ...benchmarks],
			families: [opus],
			plans: [],
			samples: [],
			profile: maxed,
			showApi: true,
		});
		expect(points.map((p) => p.benchmark.effort)).toEqual(["low", "max"]);
	});

	it("omits plans that have not been measured", () => {
		const points = valuePoints({
			benchmarks,
			families: [opus],
			plans: [plan],
			samples: [],
			profile: maxed,
			showApi: false,
		});
		expect(points).toEqual([]);
	});
});
