import type { Plan } from "#/domain/model";
import type { PlanTasks, TaskRow } from "#/domain/ranges";
import type { WeeklyAllowance } from "#/domain/value";
import { familyColor, familyName } from "#/lib/families";
import { formatCount, formatUsd } from "#/lib/format";
import { RangeChart, type RangeGroup, type RangeUnits } from "./RangeChart";

const TASK_UNITS: RangeUnits = {
	format: formatCount,
	axisLabel: "Tasks a week (log scale)",
	spoken: "tasks a week",
};

/** Where a cap comes from, shown under the plan's heading. */
function capSource(allowance: WeeklyAllowance): string {
	switch (allowance.basis) {
		case "estimated":
			return `${allowance.source}. Not measured yet.`;
		case "published":
			return `${allowance.source}, averaged over the weeks of a month`;
		case "measured":
			return "Measured from our own usage samples";
	}
}

/** The plan's whole weekly cap, or how its per-model allowance reads. */
function capText({ apiUsd, share, basis }: WeeklyAllowance): string {
	if (basis === "published") return "each model's monthly allowance, per week";
	return `${formatUsd(apiUsd / share)} a week at API prices`;
}

function PlanHeading({
	plan,
	allowance,
}: {
	plan: Plan;
	allowance: WeeklyAllowance;
}) {
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
				{capSource(allowance)}
			</p>
		</>
	);
}

function shareNote(share: number): string | undefined {
	if (share === 1) return undefined;
	return share === 0.5
		? "half the cap"
		: `${Math.round(share * 100)}% of the cap`;
}

function taskRow({ seriesId, family, allowance, efforts }: TaskRow) {
	return {
		id: seriesId,
		label: familyName(family),
		note: shareNote(allowance.share),
		color: familyColor(family),
		hollow: allowance.basis === "estimated",
		dots: efforts.map(({ benchmark, value }) => ({
			id: benchmark.id,
			label: benchmark.effortLabel,
			value,
		})),
	};
}

function planGroup({ plan, rows }: PlanTasks): RangeGroup {
	return {
		id: plan.id,
		heading: <PlanHeading plan={plan} allowance={rows[0].allowance} />,
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
