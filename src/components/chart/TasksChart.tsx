import type { PlanTasks, TaskRow } from "#/domain/ranges";
import type { WeeklyAllowance } from "#/domain/value";
import { familyName } from "#/lib/families";
import {
	formatCapShare,
	formatCount,
	formatFasterFill,
	formatUsd,
} from "#/lib/format";
import {
	modelRow,
	RangeChart,
	type RangeGroup,
	type RangeRow,
	type RangeUnits,
} from "./RangeChart";

const TASK_UNITS: RangeUnits = {
	format: formatCount,
	axisLabel: "Tasks a week (log scale)",
	spoken: "tasks a week",
};

/** Where a cap comes from, shown under the plan's heading. */
function capSource(allowance: WeeklyAllowance): string {
	switch (allowance.basis) {
		case "estimated":
			return `${allowance.source}. Not measured by us yet.`;
		case "published":
			return `${allowance.source}, averaged over the weeks of a month`;
		case "measured":
			return "Measured from our own usage samples";
	}
}

/**
 * The plan's whole weekly cap, or how its per-model allowance reads. A model
 * that fills the cap faster has a smaller one of its own, so the heading
 * gives the largest: the model it is compared with.
 */
function capText({ capApiUsd, basis, fillsFaster }: WeeklyAllowance): string {
	if (basis === "published") return "each model's monthly allowance, per week";
	const fullest = capApiUsd * (fillsFaster?.times ?? 1);
	return `${formatUsd(fullest)} a week at API prices`;
}

/** A sentence per model that fills the plan's cap faster than its fullest
 * model, such as "Fable 5.2 fills it 2.4× faster than Opus 5.5." */
function fasterFillNotes(rows: readonly TaskRow[]): string[] {
	return rows.flatMap(({ family, allowance: { fillsFaster } }) =>
		fillsFaster
			? [
					`${familyName(family)} fills it ${formatFasterFill(fillsFaster.times, familyName(fillsFaster.than))}.`,
				]
			: [],
	);
}

function PlanHeading({ plan, rows }: PlanTasks) {
	const { allowance } = rows[0];
	return (
		<>
			<p className="flex flex-wrap items-baseline gap-x-2">
				<span className="font-medium">{plan.label}</span>
				<span className="text-muted">{capText(allowance)}</span>
				<span className="rounded-sm border border-line px-1 text-[11px] text-subtle">
					{`${allowance.basis} cap`}
				</span>
			</p>
			<p className="mt-0.5 text-[12px] text-subtle [overflow-wrap:anywhere]">
				{[capSource(allowance), ...fasterFillNotes(rows)].join(" ")}
			</p>
		</>
	);
}

function taskRow(row: TaskRow): RangeRow {
	const { allowance } = row;
	return modelRow(row, {
		note: formatCapShare(allowance.share),
		hollow: allowance.basis === "estimated",
	});
}

function planGroup({ plan, rows }: PlanTasks): RangeGroup {
	return {
		id: plan.id,
		heading: <PlanHeading plan={plan} rows={rows} />,
		rows: rows.map(taskRow),
	};
}

/** Tasks each selected plan's weekly cap pays for, a group per plan. */
export function TasksChart({ plans }: { plans: readonly PlanTasks[] }) {
	return <RangeChart groups={plans.map(planGroup)} units={TASK_UNITS} />;
}

/** Tells hollow dots, which rest on estimated caps, from solid ones. */
export function CapBasisKey({
	solidLabel = "Published or measured cap",
	className = "",
}: {
	/** What a solid dot rests on. */
	solidLabel?: string;
	className?: string;
}) {
	return (
		<div
			className={`flex flex-wrap items-center gap-x-4 text-[12px] text-muted ${className}`}
		>
			<KeyDot hollow={false} label={solidLabel} />
			<KeyDot hollow label="Estimated cap" />
		</div>
	);
}

function KeyDot({ hollow, label }: { hollow: boolean; label: string }) {
	return (
		<span className="flex items-center gap-1.5">
			<svg aria-hidden="true" width={10} height={10} className="text-muted">
				<circle
					cx={5}
					cy={5}
					r={4}
					fill={hollow ? "var(--bg)" : "currentColor"}
					stroke="currentColor"
					strokeWidth={1.5}
				/>
			</svg>
			{label}
		</span>
	);
}
