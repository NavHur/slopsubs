import type { ValuePoint } from "#/domain/value";
import type { BenchmarkView } from "#/lib/benchmarks";
import { familyColor, familyLabId, familyName } from "#/lib/families";
import {
	formatDuration,
	formatMultiple,
	formatTokens,
	formatUsd,
} from "#/lib/format";
import { ProviderLogo } from "../ProviderLogo";
import { ColorDot } from "./ColorDot";
import { PrototypeComparison } from "./PointComparison.prototype";

export const MISSING = "—";

/** How the hovered figure moved from the selected one, for the hovered model. */
export type Change = { text: string; tone: "better" | "worse" | "same" };

const SAME: Change = { text: "Same", tone: "same" };
const UNKNOWN: Change = { text: MISSING, tone: "same" };

export const TONE_CLASS = {
	better: "text-better",
	worse: "text-worse",
	same: "text-muted",
} as const;

export type Row = {
	label: string;
	value: (point: ValuePoint) => number | null;
	format: (value: number) => string;
	change: (hovered: number, selected: number) => Change;
};

/** A score's change in points, where higher is better: "+3.8 pts". */
function scoreChange(hovered: number, selected: number): Change {
	const points = hovered - selected;
	const size = Math.abs(points).toFixed(1);
	if (Number(size) === 0) return SAME;
	return points > 0
		? { text: `+${size} pts`, tone: "better" }
		: { text: `−${size} pts`, tone: "worse" };
}

/**
 * A change by a multiple, where less is better, in the words of the figure:
 * "151× cheaper", "2.4× slower". Matches the plan note's "21× cheaper than API".
 */
function lessIsBetter(fewer: string, more: string) {
	return (hovered: number, selected: number): Change => {
		if (hovered <= 0 || selected <= 0) return UNKNOWN;
		const factor = formatMultiple(
			Math.max(hovered / selected, selected / hovered),
		);
		if (factor === formatMultiple(1)) return SAME;
		return hovered < selected
			? { text: `${factor} ${fewer}`, tone: "better" }
			: { text: `${factor} ${more}`, tone: "worse" };
	};
}

/** Plan points cost a share of the subscription, not the API bill. */
function costLabel(points: readonly ValuePoint[]) {
	return points.some((p) => p.pricing.kind === "plan")
		? "Effective cost per task"
		: "Cost per task";
}

export function comparisonRows(
	points: readonly ValuePoint[],
	view: BenchmarkView,
): Row[] {
	return [
		{
			label: view.scoreLabel,
			value: (p) => p.score,
			format: view.formatScore,
			change: scoreChange,
		},
		{
			label: costLabel(points),
			value: (p) => p.costPerTaskUsd,
			format: formatUsd,
			change: lessIsBetter("cheaper", "pricier"),
		},
		{
			label: view.tokensLabel,
			value: (p) => p.benchmark.tokensPerTask,
			format: formatTokens,
			change: lessIsBetter("fewer", "more"),
		},
		{
			label: "Time per task",
			value: (p) => p.benchmark.secondsPerTask,
			format: formatDuration,
			change: lessIsBetter("faster", "slower"),
		},
	];
}

export function changeOf(
	row: Row,
	hovered: number | null,
	selected: number | null,
) {
	if (hovered === null || selected === null) return UNKNOWN;
	return row.change(hovered, selected);
}

/**
 * Which point is which: the selected one, then the hovered one, in the
 * table's column order. The arrow reads as the Change column does: what
 * moving from the selected point to the hovered one gains or loses.
 */
function ComparisonHeader({
	selected,
	hovered,
}: {
	selected: ValuePoint;
	hovered: ValuePoint;
}) {
	return (
		<div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-x-3">
			<PointIdentity point={selected} />
			<span className="text-[15px] leading-7 text-muted">
				<span aria-hidden="true">→</span>
				<span className="sr-only">versus</span>
			</span>
			<PointIdentity point={hovered} />
		</div>
	);
}

/** A point's model on one line, its effort and pricing on the next. */
export function PointIdentity({ point }: { point: ValuePoint }) {
	const { benchmark, pricing } = point;
	return (
		<div className="min-w-0">
			<div className="flex min-h-7 items-center gap-1.5 text-[13px] font-semibold text-fg">
				<ColorDot color={familyColor(benchmark.family)} />
				<ProviderLogo lab={familyLabId(benchmark.family)} size={16} />
				<span className="truncate">{familyName(benchmark.family)}</span>
			</div>
			<p className="truncate text-muted">
				{benchmark.effortLabel} ·{" "}
				{pricing.kind === "api" ? "API" : pricing.plan.label}
			</p>
		</div>
	);
}

/**
 * The selected (pinned) point beside the hovered one: who each is, then
 * their figures and how the hovered one compares, coloured by whether that
 * is better or worse. Rows neither point has a figure for are left out.
 */
/** PROTOTYPE: picks the comparison variant from `?variant=`. */
export function PointComparison(props: {
	selected: ValuePoint;
	hovered: ValuePoint;
	view: BenchmarkView;
}) {
	return <PrototypeComparison {...props} Current={CurrentComparison} />;
}

function CurrentComparison({
	selected,
	hovered,
	view,
}: {
	selected: ValuePoint;
	hovered: ValuePoint;
	view: BenchmarkView;
}) {
	const rows = comparisonRows([selected, hovered], view).filter(
		(row) => row.value(selected) !== null || row.value(hovered) !== null,
	);
	const shown = (value: number | null, row: Row) =>
		value === null ? MISSING : row.format(value);
	return (
		<>
			<ComparisonHeader selected={selected} hovered={hovered} />
			<table className="mt-2 w-full tabular-nums">
				<thead className="text-[11px] text-subtle">
					<tr className="border-b border-line">
						<th scope="col" className="sr-only">
							Figure
						</th>
						<ColumnHead point={selected}>Selected</ColumnHead>
						<ColumnHead point={hovered}>Hovered</ColumnHead>
						<th scope="col" className="pb-0.5 pl-3 text-right font-normal">
							Change
						</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((row) => {
						const a = row.value(selected);
						const b = row.value(hovered);
						const change = changeOf(row, b, a);
						return (
							<tr key={row.label}>
								<th
									scope="row"
									className="pt-0.5 text-left font-normal text-muted"
								>
									{row.label}
								</th>
								<td className="pt-0.5 pl-3 text-right text-fg">
									{shown(a, row)}
								</td>
								<td className="pt-0.5 pl-3 text-right text-fg">
									{shown(b, row)}
								</td>
								<td
									className={`pt-0.5 pl-3 text-right font-medium whitespace-nowrap ${TONE_CLASS[change.tone]}`}
								>
									{change.text}
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</>
	);
}

/** A point's column, marked with its model's colour as on the chart. */
export function ColumnHead({
	point,
	children,
}: {
	point: ValuePoint;
	children: string;
}) {
	return (
		<th scope="col" className="pb-0.5 pl-3 text-right font-normal">
			<span className="inline-flex items-center gap-1">
				<ColorDot color={familyColor(point.benchmark.family)} />
				{children}
			</span>
		</th>
	);
}
