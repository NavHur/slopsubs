import {
	type BenchmarkPoint,
	EFFORTS,
	type Effort,
	type FamilyId,
	type LimitSample,
	type Plan,
	type PublishedAllowance,
	type ReportedCap,
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

/** How a plan's weekly cap is known. */
export type CapSource =
	| { basis: "measured" }
	/** `source` is the vendor's own description of the allowance. */
	| { basis: "published"; source: string }
	/** `source` is how the reported figure was reached. */
	| { basis: "estimated"; source: string };

/** API-priced usage one family may spend in a sustained week on a plan. */
export type WeeklyAllowance = CapSource & {
	apiUsd: number;
	/** Below 1 when the family only gets part of the cap. */
	share: number;
};

/**
 * The family's weekly allowance on the plan, or null when the plan's capacity
 * is unknown or doesn't cover the family. A monthly allowance becomes its
 * weekly average: a week may burst higher, but not every week.
 */
export function weeklyAllowance(
	plan: Plan,
	capacity: PlanCapacity,
	family: FamilyId,
): WeeklyAllowance | null {
	const share = plan.weeklyShareByFamily[family] ?? 1;
	const whole = wholeWeeklyAllowance(capacity, family);
	return whole && { ...whole, apiUsd: whole.apiUsd * share, share };
}

function wholeWeeklyAllowance(
	capacity: PlanCapacity,
	family: FamilyId,
): (CapSource & { apiUsd: number }) | null {
	switch (capacity.kind) {
		case "unmeasured":
			return null;
		case "published": {
			const monthly = capacity.allowance.apiUsdPerMonthByFamily[family];
			return monthly === undefined
				? null
				: {
						apiUsd: monthly / WEEKS_PER_MONTH,
						basis: "published",
						source: capacity.allowance.basis,
					};
		}
		case "reported":
			return {
				apiUsd: capacity.weeklyCapApiUsd,
				basis: "estimated",
				source: capacity.report.basis,
			};
		case "measured":
			return { apiUsd: capacity.weeklyCapApiUsd, basis: "measured" };
	}
}

/**
 * API-equivalent dollars a subscriber gets per dollar of subscription when
 * they use everything the plan offers: the family's usage every week of the
 * month plus bundled API credit. Below 1, paying per token is cheaper.
 */
export function valueMultiple({
	plan,
	allowance,
}: {
	plan: Plan;
	allowance: WeeklyAllowance;
}): number {
	return (
		(allowance.apiUsd * WEEKS_PER_MONTH + plan.includedApiCreditUsd) /
		plan.monthlyPriceUsd
	);
}

export type Pricing =
	| { kind: "api" }
	| {
			kind: "plan";
			plan: Plan;
			allowance: WeeklyAllowance;
			valueMultiple: number;
	  };

/** A benchmark with both measures, so it can be plotted. */
export type PlottableBenchmark = BenchmarkPoint & {
	score: number;
	/** At API prices. */
	costPerTaskUsd: number;
};

export type ValuePoint = {
	/** Stable key for one line on the chart: a family under one pricing. */
	seriesId: string;
	benchmark: PlottableBenchmark;
	score: number;
	costPerTaskUsd: number;
	pricing: Pricing;
};

function isPlottable(point: BenchmarkPoint): point is PlottableBenchmark {
	return point.score !== null && point.costPerTaskUsd !== null;
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
			score: benchmark.score,
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
	showApi,
	hiddenEfforts,
}: {
	benchmarks: readonly BenchmarkPoint[];
	families: readonly FamilyId[];
	plans: readonly Plan[];
	samples: readonly LimitSample[];
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
				const allowance = weeklyAllowance(plan, capacity, family);
				if (allowance === null) return [];
				const served = plottable.filter(servedBy(plan, family));
				return seriesFor(served, family, {
					kind: "plan",
					plan,
					allowance,
					valueMultiple: valueMultiple({ plan, allowance }),
				});
			});
	});
	return [...api, ...subscribed];
}
