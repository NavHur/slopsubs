import { EFFORTS } from "./enums";
import type { BenchmarkPoint, Effort, FamilyId, Plan } from "./model";
import { type FamilyNeed, planFit, type PlanFitOutcome } from "./planFit";
import {
	type PlanCapacity,
	WEEKS_PER_MONTH,
	type WeeklyAllowance,
	weeklyAllowance,
} from "./value";

/** How much the week uses, in one unit or the other, never both. */
export type Usage =
	| { unit: "tasks"; tasksPerWeek: number; effort: Effort }
	| { unit: "apiUsd"; apiUsdPerWeek: number };

/** One family's part of the week: its weight over the weights' sum. */
export type FamilyWeight = { family: FamilyId; weight: number };

/**
 * The models the week runs on: the chosen ones, split by weight, or any one of
 * `families`, whichever each plan serves best.
 */
export type ModelChoice =
	| { kind: "chosen"; weights: readonly FamilyWeight[] }
	| { kind: "any"; families: readonly FamilyId[] };

export type Workload = {
	models: ModelChoice;
	usage: Usage;
	/** Plans priced above it are set aside; null for no budget. */
	monthlyBudgetUsd: number | null;
};

export type SizedPlan = { plan: Plan; capacity: PlanCapacity };

/** How the least certain of a plan's caps for the week is known. */
export type CapBasis = WeeklyAllowance["basis"];

/** What a plan's verdict was reached with: the families it ran and their caps. */
type Basis = { plan: Plan; families: FamilyId[]; basis: CapBasis };

export type PlanFit = Basis & Extract<PlanFitOutcome, { kind: "fits" }>;
export type PlanShort = Basis & Extract<PlanFitOutcome, { kind: "short" }>;

/** A chosen family the plan doesn't include, or doesn't serve at the effort. */
export type PlanGap = { plan: Plan; family: FamilyId; gap: "model" | "effort" };

export type Recommendation =
	/** The benchmark has no cost per task for these families at the effort. */
	| { kind: "unpriced"; families: FamilyId[] }
	| {
			kind: "ranked";
			/** The week at API prices, over a month: the per-token baseline. */
			apiUsdPerMonth: number;
			/** Whether paying per token costs less than the cheapest plan that fits. */
			apiCheaper: boolean;
			/**
			 * The multiple of this week's usage where the side now cheaper changes:
			 * the next above 1 where a plan starts to pay off, or the one below where
			 * paying per token wins. Null when no plan fits or no such multiple exists.
			 */
			breakEvenScale: number | null;
			/** Cheapest first. */
			fits: PlanFit[];
			/** The budget plans were held to, or null for none. */
			monthlyBudgetUsd: number | null;
			/**
			 * The cheapest plan above the budget that still fits, with the budget it
			 * breaks; null with no budget or when none fits.
			 */
			cheapestOverBudget: { budgetUsd: number; fit: PlanFit } | null;
			/** Closest to covering the week first. */
			short: PlanShort[];
			/** Plans with no known cap for a chosen family. */
			unsized: Plan[];
			gaps: PlanGap[];
			overBudget: Plan[];
	  };

/** One way to run the week: an API-priced need per family. */
type Demand = { family: FamilyId; apiUsdPerWeek: number }[];

type Verdict =
	| (Basis & PlanFitOutcome)
	| { kind: "unsized"; plan: Plan }
	| ({ kind: "gap" } & PlanGap);

/**
 * The plans that cover a visitor's week, cheapest first, beside what the week
 * costs at API prices, and why each other plan can't be recommended.
 */
export function recommendPlans({
	plans,
	points,
	workload,
}: {
	plans: readonly SizedPlan[];
	points: readonly BenchmarkPoint[];
	workload: Workload;
}): Recommendation {
	const priced = demands(workload, points);
	if (priced.kind === "unpriced") return priced;
	const { options } = priced;
	const effort = workload.usage.unit === "tasks" ? workload.usage.effort : null;
	const budget = workload.monthlyBudgetUsd ?? Infinity;
	const inBudget = plans.filter((p) => p.plan.monthlyPriceUsd <= budget);
	const overBudget = plans.filter((p) => p.plan.monthlyPriceUsd > budget);
	const verdictsOf = (sized: readonly SizedPlan[]) =>
		sized.map((p) => bestVerdict(p, options, effort, 1));
	const verdicts = verdictsOf(inBudget);
	const fits = cheapestFirst(verdicts);
	const [overBudgetFit] = cheapestFirst(verdictsOf(overBudget));
	const apiUsdPerMonth =
		Math.min(...options.map(weeklyTotal)) * WEEKS_PER_MONTH;
	const apiCheaper =
		fits.length > 0 && apiUsdPerMonth < fits[0].plan.monthlyPriceUsd;
	const fitsAt = (p: SizedPlan, scale: number) =>
		bestVerdict(p, options, effort, scale).kind === "fits";
	return {
		kind: "ranked",
		apiUsdPerMonth,
		apiCheaper,
		breakEvenScale: breakEvenScale({
			ranges:
				fits.length > 0 ? payOffRanges(inBudget, fitsAt, apiUsdPerMonth) : [],
			apiCheaper,
		}),
		fits,
		monthlyBudgetUsd: workload.monthlyBudgetUsd,
		cheapestOverBudget: overBudgetFit
			? { budgetUsd: budget, fit: overBudgetFit }
			: null,
		short: verdicts
			.filter((v) => v.kind === "short")
			.sort((a, b) => b.coverage - a.coverage),
		unsized: verdicts.filter((v) => v.kind === "unsized").map((v) => v.plan),
		gaps: verdicts
			.filter((v) => v.kind === "gap")
			.map(({ plan, family, gap }) => ({ plan, family, gap })),
		overBudget: overBudget.map((p) => p.plan),
	};
}

function cheapestFirst(verdicts: readonly Verdict[]): PlanFit[] {
	return verdicts
		.filter((v) => v.kind === "fits")
		.sort((a, b) => a.plan.monthlyPriceUsd - b.plan.monthlyPriceUsd);
}

function weeklyTotal(demand: Demand): number {
	return demand.reduce((sum, d) => sum + d.apiUsdPerWeek, 0);
}

type Priced =
	| { kind: "priced"; options: Demand[] }
	| { kind: "unpriced"; families: FamilyId[] };

/** The week's demand per way of running it, or the families left unpriced. */
function demands(
	{ models, usage }: Workload,
	points: readonly BenchmarkPoint[],
): Priced {
	const weekly = (family: FamilyId, part: number) => {
		const price = apiUsdPerUnit(usage, family, points);
		return price === null
			? null
			: { family, apiUsdPerWeek: price * amount(usage) * part };
	};
	return models.kind === "any"
		? anyDemands(models.families, weekly)
		: chosenDemands(models.weights, weekly);
}

type WeeklyNeed = (family: FamilyId, part: number) => Demand[number] | null;

/** Each priced family alone carries the whole week. */
function anyDemands(families: readonly FamilyId[], weekly: WeeklyNeed): Priced {
	const options = families.flatMap((family) => {
		const need = weekly(family, 1);
		return need ? [[need]] : [];
	});
	return options.length > 0
		? { kind: "priced", options }
		: { kind: "unpriced", families: [...families] };
}

/** The chosen families split the week by weight; all must be priced. */
function chosenDemands(
	weights: readonly FamilyWeight[],
	weekly: WeeklyNeed,
): Priced {
	const total = weights.reduce((sum, w) => sum + w.weight, 0);
	const demand: Demand = [];
	const unpriced: FamilyId[] = [];
	for (const { family, weight } of weights) {
		const need = weekly(family, weight / total);
		if (need) demand.push(need);
		else unpriced.push(family);
	}
	return unpriced.length > 0
		? { kind: "unpriced", families: unpriced }
		: { kind: "priced", options: [demand] };
}

function amount(usage: Usage): number {
	return usage.unit === "tasks" ? usage.tasksPerWeek : usage.apiUsdPerWeek;
}

/** API-priced dollars per unit of usage: per task at the effort, or 1. */
function apiUsdPerUnit(
	usage: Usage,
	family: FamilyId,
	points: readonly BenchmarkPoint[],
): number | null {
	if (usage.unit === "apiUsd") return 1;
	const match = points.find(
		(p) => p.family === family && p.effort === usage.effort,
	);
	return match?.costPerTaskUsd ?? null;
}

/** The plan's verdict on the way of running the week it serves best. */
function bestVerdict(
	sized: SizedPlan,
	options: readonly Demand[],
	effort: Effort | null,
	scale: number,
): Verdict {
	return options
		.map((demand) => verdictFor(sized, demand, effort, scale))
		.reduce((best, next) =>
			verdictRank(next) < verdictRank(best) ? next : best,
		);
}

/** Lower is better: any fit beats any shortfall, which beats an unknown. */
function verdictRank(verdict: Verdict): number {
	switch (verdict.kind) {
		case "fits":
			return verdict.capUse;
		case "short":
			return 2 - verdict.coverage;
		case "unsized":
			return 3;
		case "gap":
			return 4;
	}
}

const BASIS_CERTAINTY: readonly CapBasis[] = [
	"estimated",
	"published",
	"measured",
];

function verdictFor(
	{ plan, capacity }: SizedPlan,
	demand: Demand,
	effort: Effort | null,
	scale: number,
): Verdict {
	const gap = demand.map((d) => gapIn(plan, d.family, effort)).find(Boolean);
	if (gap) return { kind: "gap", ...gap };
	const needs: FamilyNeed[] = [];
	for (const { family, apiUsdPerWeek } of demand) {
		const allowance = weeklyAllowance(plan, capacity, family);
		if (allowance === null) return { kind: "unsized", plan };
		needs.push({ family, apiUsdPerWeek: apiUsdPerWeek * scale, allowance });
	}
	return {
		plan,
		families: demand.map((d) => d.family),
		basis: leastCertainBasis(plan, needs),
		...planFit(plan, needs),
	};
}

function leastCertainBasis(plan: Plan, needs: readonly FamilyNeed[]): CapBasis {
	const basis = BASIS_CERTAINTY.find((b) =>
		needs.some((n) => n.allowance.basis === b),
	);
	if (!basis) throw new Error(`${plan.id}: no cap basis for an empty week`);
	return basis;
}

function gapIn(
	plan: Plan,
	family: FamilyId,
	effort: Effort | null,
): PlanGap | null {
	if (!plan.families.includes(family)) return { plan, family, gap: "model" };
	const max = plan.maxEffortByFamily[family];
	const aboveMax =
		effort !== null &&
		max !== undefined &&
		EFFORTS.indexOf(effort) > EFFORTS.indexOf(max);
	return aboveMax ? { plan, family, gap: "effort" } : null;
}

/** The usage multiples at which a plan costs no more than paying per token. */
type PayOffRange = { from: number; to: number };

/** A plan whose cap ends at its price's worth of usage ties; it never saves. */
const TIE_MARGIN = 1e-9;

/** Each plan's range: from its price's worth of API usage to where its cap runs out. */
function payOffRanges(
	plans: readonly SizedPlan[],
	fitsAt: (plan: SizedPlan, scale: number) => boolean,
	apiUsdPerMonth: number,
): PayOffRange[] {
	return plans.flatMap((p) => {
		const from = p.plan.monthlyPriceUsd / apiUsdPerMonth;
		if (!Number.isFinite(from)) return [];
		const to = largestFittingScale(
			(scale) => fitsAt(p, scale),
			Math.max(MAX_SCALE, 2 * from),
		);
		return to > from * (1 + TIE_MARGIN) ? [{ from, to }] : [];
	});
}

const MAX_SCALE = 2 ** 40;
const BISECTIONS = 60;

/**
 * The most the week can grow and still fit: a plan fits up to some multiple of
 * it. Infinity once a probe that fits reaches `limit`; -Infinity if it never fits.
 */
function largestFittingScale(
	fitsAt: (scale: number) => boolean,
	limit: number,
): number {
	if (!fitsAt(0)) return -Infinity;
	let lo = 0;
	let hi = 1;
	while (fitsAt(hi)) {
		if (hi >= limit) return Infinity;
		lo = hi;
		hi *= 2;
	}
	return bisectFit(fitsAt, lo, hi);
}

/** The edge between a scale that fits and one that doesn't, from above. */
function bisectFit(
	fitsAt: (scale: number) => boolean,
	fits: number,
	short: number,
): number {
	const [, edge] = Array.from({ length: BISECTIONS }).reduce<
		readonly [number, number]
	>(
		([lo, hi]) => {
			const mid = (lo + hi) / 2;
			return fitsAt(mid) ? [mid, hi] : [lo, mid];
		},
		[fits, short],
	);
	return edge;
}

/**
 * The edge of the run of usage around this week's (scale 1) that the cheaper
 * side holds: the next scale where a plan starts to pay off if paying per
 * token is cheaper now, else the scale below which paying per token wins.
 */
function breakEvenScale({
	ranges,
	apiCheaper,
}: {
	ranges: readonly PayOffRange[];
	apiCheaper: boolean;
}): number | null {
	if (ranges.length === 0) return null;
	return apiCheaper ? nextPayOff(ranges) : payOffStart(ranges);
}

function nextPayOff(ranges: readonly PayOffRange[]): number | null {
	const starts = ranges.map((r) => r.from).filter((from) => from > 1);
	return starts.length > 0 ? Math.min(...starts) : null;
}

/** Where the unbroken run of plans paying off that holds scale 1 begins. */
function payOffStart(ranges: readonly PayOffRange[]): number | null {
	let start = 1;
	for (let next = lowestReaching(ranges, 1); next < start;) {
		start = next;
		next = lowestReaching(ranges, start);
	}
	return start > 0 ? start : null;
}

function lowestReaching(ranges: readonly PayOffRange[], at: number): number {
	return Math.min(at, ...ranges.filter((r) => r.to >= at).map((r) => r.from));
}
