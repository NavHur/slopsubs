import {
	type BenchmarkPoint,
	EFFORTS,
	type Effort,
	type FamilyId,
	type LimitSample,
	type Plan,
	type PublishedAllowance,
	type ReportedCap,
	type UsageProfile,
} from "./model";

const WEEKS_PER_MONTH = 52 / 12;
const FULL_GAUGE_PERCENT = 100;

export type PlanCapacity =
	| { kind: "unmeasured" }
	| { kind: "reported"; weeklyCapApiUsd: number; report: ReportedCap }
	| { kind: "published"; allowance: PublishedAllowance }
	| {
			kind: "measured";
			/** API-equivalent spend that fills the weekly cap once. */
			weeklyCapApiUsd: number;
			sampleCount: number;
			gaugePercentObserved: number;
	  };

/**
 * Extrapolates the weekly cap from every sample recorded for the plan. Without
 * samples, falls back to the vendor's published allowance, then to a figure
 * someone else reported.
 */
export function planCapacity(
	plan: Plan,
	samples: readonly LimitSample[],
): PlanCapacity {
	const own = samples.filter((s) => s.plan === plan.id);
	if (own.length === 0) return unsampledCapacity(plan);
	const apiUsd = own.reduce((sum, s) => sum + s.apiUsd, 0);
	const gauge = own.reduce(
		(sum, s) => sum + (s.endUsedPercent - s.startUsedPercent),
		0,
	);
	return {
		kind: "measured",
		weeklyCapApiUsd: (apiUsd / gauge) * FULL_GAUGE_PERCENT,
		sampleCount: own.length,
		gaugePercentObserved: gauge,
	};
}

function unsampledCapacity(plan: Plan): PlanCapacity {
	if (plan.publishedAllowance) {
		return { kind: "published", allowance: plan.publishedAllowance };
	}
	const report = plan.reportedCap;
	return report
		? { kind: "reported", weeklyCapApiUsd: report.weeklyCapApiUsd, report }
		: { kind: "unmeasured" };
}

/**
 * API-priced usage a plan allows per month when spent on one family, or null
 * when the plan's capacity is unknown or doesn't cover the family.
 */
export function apiUsdPerMonth(
	capacity: PlanCapacity,
	family: FamilyId,
): number | null {
	switch (capacity.kind) {
		case "unmeasured":
			return null;
		case "published":
			return capacity.allowance.apiUsdPerMonthByFamily[family] ?? null;
		default:
			return capacity.weeklyCapApiUsd * WEEKS_PER_MONTH;
	}
}

/**
 * API-equivalent dollars a subscriber gets per dollar of subscription, given
 * how much of what the plan offers (monthly usage plus bundled API credit)
 * they use. Below 1, paying per token is cheaper.
 */
export function valueMultiple({
	plan,
	apiUsdPerMonth,
	profile,
}: {
	plan: Plan;
	apiUsdPerMonth: number;
	profile: UsageProfile;
}): number {
	const availableApiUsdPerMonth = apiUsdPerMonth + plan.includedApiCreditUsd;
	return (
		(availableApiUsdPerMonth * profile.weeklyCapShare) / plan.monthlyPriceUsd
	);
}

export type Pricing =
	| { kind: "api" }
	| { kind: "plan"; plan: Plan; valueMultiple: number };

/** A benchmark with both measures, so it can be plotted. */
export type PlottableBenchmark = BenchmarkPoint & {
	intelligence: number;
	/** At API prices. */
	costPerTaskUsd: number;
};

export type ValuePoint = {
	/** Stable key for one line on the chart: a family under one pricing. */
	seriesId: string;
	benchmark: PlottableBenchmark;
	intelligence: number;
	costPerTaskUsd: number;
	pricing: Pricing;
};

function isPlottable(point: BenchmarkPoint): point is PlottableBenchmark {
	return point.intelligence !== null && point.costPerTaskUsd !== null;
}

/** Drops efforts above the highest one the plan serves for the family. */
function servedBy(plan: Plan, family: FamilyId) {
	const max = plan.maxEffortByFamily[family];
	if (!max) return () => true;
	return (point: BenchmarkPoint) =>
		EFFORTS.indexOf(point.effort) <= EFFORTS.indexOf(max);
}

function seriesFor(
	points: readonly PlottableBenchmark[],
	family: FamilyId,
	pricing: Pricing,
): ValuePoint[] {
	const divisor = pricing.kind === "plan" ? pricing.valueMultiple : 1;
	const seriesId =
		pricing.kind === "plan" ? `${family}@${pricing.plan.id}` : `${family}@api`;
	return points
		.filter((p) => p.family === family)
		.sort((a, b) => a.effortOrder - b.effortOrder)
		.map((benchmark) => ({
			seriesId,
			benchmark,
			intelligence: benchmark.intelligence,
			costPerTaskUsd: benchmark.costPerTaskUsd / divisor,
			pricing,
		}));
}

/**
 * Every plotted point: each selected family at API prices, and again under
 * each selected plan with a known cap that covers it at that plan's effective
 * cost, leaving out the hidden reasoning efforts.
 */
export function valuePoints({
	benchmarks,
	families,
	plans,
	samples,
	profile,
	showApi,
	hiddenEfforts,
}: {
	benchmarks: readonly BenchmarkPoint[];
	families: readonly FamilyId[];
	plans: readonly Plan[];
	samples: readonly LimitSample[];
	profile: UsageProfile;
	showApi: boolean;
	hiddenEfforts: readonly Effort[];
}): ValuePoint[] {
	const plottable = benchmarks
		.filter(isPlottable)
		.filter((p) => !hiddenEfforts.includes(p.effort));
	const api = showApi
		? families.flatMap((f) => seriesFor(plottable, f, { kind: "api" }))
		: [];
	const subscribed = plans.flatMap((plan) => {
		const capacity = planCapacity(plan, samples);
		return plan.families
			.filter((f) => families.includes(f))
			.flatMap((family) => {
				const usd = apiUsdPerMonth(capacity, family);
				if (usd === null) return [];
				const served = plottable.filter(servedBy(plan, family));
				return seriesFor(served, family, {
					kind: "plan",
					plan,
					valueMultiple: valueMultiple({ plan, apiUsdPerMonth: usd, profile }),
				});
			});
	});
	return [...api, ...subscribed];
}
