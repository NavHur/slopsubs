import type {
	BenchmarkPoint,
	FamilyId,
	LimitSample,
	Plan,
	PlanId,
	UsageProfile,
} from "./model";

const WEEKS_PER_MONTH = 52 / 12;
const FULL_GAUGE_PERCENT = 100;

export type PlanCapacity =
	| { kind: "unmeasured" }
	| {
			kind: "measured";
			/** API-equivalent spend that fills the weekly cap once. */
			weeklyCapApiUsd: number;
			sampleCount: number;
			gaugePercentObserved: number;
	  };

/** Extrapolates the weekly cap from every sample recorded for the plan. */
export function planCapacity(
	plan: PlanId,
	samples: readonly LimitSample[],
): PlanCapacity {
	const own = samples.filter((s) => s.plan === plan);
	if (own.length === 0) return { kind: "unmeasured" };
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

/**
 * API-equivalent dollars a subscriber gets per dollar of subscription, given
 * how much of the weekly cap they use. Below 1, paying per token is cheaper.
 */
export function valueMultiple({
	plan,
	weeklyCapApiUsd,
	profile,
}: {
	plan: Plan;
	weeklyCapApiUsd: number;
	profile: UsageProfile;
}): number {
	const usedApiUsdPerMonth =
		weeklyCapApiUsd * WEEKS_PER_MONTH * profile.weeklyCapShare;
	return usedApiUsdPerMonth / plan.monthlyPriceUsd;
}

export type Pricing =
	| { kind: "api" }
	| { kind: "plan"; plan: Plan; valueMultiple: number };

export type ValuePoint = {
	/** Stable key for one line on the chart: a family under one pricing. */
	seriesId: string;
	benchmark: BenchmarkPoint;
	intelligence: number;
	costPerTaskUsd: number;
	pricing: Pricing;
};

type PlottableBenchmark = BenchmarkPoint & {
	intelligence: number;
	costPerTaskUsd: number;
};

function isPlottable(point: BenchmarkPoint): point is PlottableBenchmark {
	return point.intelligence !== null && point.costPerTaskUsd !== null;
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
 * each selected, measured plan that covers it at that plan's effective cost.
 */
export function valuePoints({
	benchmarks,
	families,
	plans,
	samples,
	profile,
	showApi,
}: {
	benchmarks: readonly BenchmarkPoint[];
	families: readonly FamilyId[];
	plans: readonly Plan[];
	samples: readonly LimitSample[];
	profile: UsageProfile;
	showApi: boolean;
}): ValuePoint[] {
	const plottable = benchmarks.filter(isPlottable);
	const api = showApi
		? families.flatMap((f) => seriesFor(plottable, f, { kind: "api" }))
		: [];
	const subscribed = plans.flatMap((plan) => {
		const capacity = planCapacity(plan.id, samples);
		if (capacity.kind === "unmeasured") return [];
		const multiple = valueMultiple({
			plan,
			weeklyCapApiUsd: capacity.weeklyCapApiUsd,
			profile,
		});
		return plan.families
			.filter((f) => families.includes(f))
			.flatMap((f) =>
				seriesFor(plottable, f, {
					kind: "plan",
					plan,
					valueMultiple: multiple,
				}),
			);
	});
	return [...api, ...subscribed];
}
