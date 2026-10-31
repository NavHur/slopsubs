import type { FamilyId, Plan } from "./model";
import type { PlottableBenchmark, ValuePoint, WeeklyAllowance } from "./value";

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
