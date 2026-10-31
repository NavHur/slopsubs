import type { FamilyId, Plan } from "./model";
import type {
	PlottableBenchmark,
	Pricing,
	ValuePoint,
	WeeklyAllowance,
} from "./value";

/** One model at one effort, and the figure a range chart plots for it. */
export type EffortValue = { benchmark: PlottableBenchmark; value: number };

/** A model's efforts on one plan, as tasks its weekly allowance pays for. */
export type TaskRow = {
	seriesId: string;
	family: FamilyId;
	allowance: WeeklyAllowance;
	/** Lowest effort first; `value` is tasks per week. */
	efforts: EffortValue[];
};

export type PlanTasks = { plan: Plan; rows: TaskRow[] };

/**
 * How many benchmark tasks each plan's weekly allowance pays for, per model
 * and effort: the allowance over the task's API price. Each figure assumes
 * the whole allowance goes to that one model at that one effort, so a plan's
 * rows are alternatives, not a sum. Bundled API credit is left out: it is a
 * monthly balance that does not refill with the weekly cap.
 */
export function tasksPerWeek(points: readonly ValuePoint[]): PlanTasks[] {
	const byPlan = new Map<Plan["id"], PlanTasks>();
	for (const [seriesId, members] of Map.groupBy(points, (p) => p.seriesId)) {
		const { pricing, benchmark } = members[0];
		if (pricing.kind !== "plan") continue;
		const { plan, allowance } = pricing;
		const group = byPlan.get(plan.id) ?? { plan, rows: [] };
		byPlan.set(plan.id, group);
		group.rows.push({
			seriesId,
			family: benchmark.family,
			allowance,
			efforts: members.map((p) => ({
				benchmark: p.benchmark,
				value: allowance.apiUsd / p.benchmark.costPerTaskUsd,
			})),
		});
	}
	return [...byPlan.values()];
}

/** A model under one pricing, at the effective cost per task of each effort. */
export type CostRow = {
	seriesId: string;
	family: FamilyId;
	pricing: Pricing;
	/** Lowest effort first; `value` is effective USD per task. */
	efforts: EffortValue[];
};

/**
 * Every model under every selected pricing, API included, cheapest first:
 * rows sort by their cheapest effort, so a row's place says what its
 * thriftiest setting costs.
 */
export function rankedCost(points: readonly ValuePoint[]): CostRow[] {
	const rows = [...Map.groupBy(points, (p) => p.seriesId)].map(
		([seriesId, members]): CostRow => ({
			seriesId,
			family: members[0].benchmark.family,
			pricing: members[0].pricing,
			efforts: members.map((p) => ({
				benchmark: p.benchmark,
				value: p.costPerTaskUsd,
			})),
		}),
	);
	const cheapest = (row: CostRow) =>
		Math.min(...row.efforts.map((e) => e.value));
	return rows.sort(
		(a, b) => cheapest(a) - cheapest(b) || a.seriesId.localeCompare(b.seriesId),
	);
}
