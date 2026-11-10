import type { ValuePoint } from "#/domain/value";
import type { BenchmarkView } from "#/lib/benchmarks";
import {
	formatDuration,
	formatRatio,
	formatTokens,
	formatUsd,
} from "#/lib/format";

const MISSING = "—";

type Row = {
	label: string;
	value: (point: ValuePoint) => number | null;
	format: (value: number) => string;
};

/** Plan points cost a share of the subscription, not the API bill. */
function costLabel(points: readonly ValuePoint[]) {
	return points.some((p) => p.pricing.kind === "plan")
		? "Effective cost per task"
		: "Cost per task";
}

function comparisonRows(
	points: readonly ValuePoint[],
	view: BenchmarkView,
): Row[] {
	return [
		{
			label: view.scoreLabel,
			value: (p) => p.score,
			format: view.formatScore,
		},
		{
			label: costLabel(points),
			value: (p) => p.costPerTaskUsd,
			format: formatUsd,
		},
		{
			label: view.tokensLabel,
			value: (p) => p.benchmark.tokensPerTask,
			format: formatTokens,
		},
		{
			label: "Time per task",
			value: (p) => p.benchmark.secondsPerTask,
			format: formatDuration,
		},
	];
}

/** How many times the selected figure the hovered one is, when both exist. */
function ratio(hovered: number | null, selected: number | null) {
	if (hovered === null || selected === null || selected === 0) return MISSING;
	return formatRatio(hovered / selected);
}

/**
 * The hovered point's figures beside the selected (pinned) point's, with how
 * many times the selected figure each hovered one is. Rows neither point has
 * a figure for are left out.
 */
export function PointComparison({
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
		<table className="mt-2 w-full tabular-nums">
			<thead className="text-[11px] text-subtle">
				<tr className="border-b border-line">
					<th scope="col" className="sr-only">
						Figure
					</th>
					<th scope="col" className="pb-0.5 text-right font-normal">
						Selected
					</th>
					<th scope="col" className="pb-0.5 pl-3 text-right font-normal">
						Hovered
					</th>
					<th scope="col" className="pb-0.5 pl-3 text-right font-normal">
						Multiplier
					</th>
				</tr>
			</thead>
			<tbody>
				{rows.map((row) => {
					const a = row.value(selected);
					const b = row.value(hovered);
					return (
						<tr key={row.label}>
							<th
								scope="row"
								className="pt-0.5 text-left font-normal text-muted"
							>
								{row.label}
							</th>
							<td className="pt-0.5 text-right text-fg">{shown(a, row)}</td>
							<td className="pt-0.5 pl-3 text-right text-fg">
								{shown(b, row)}
							</td>
							<td className="pt-0.5 pl-3 text-right text-fg">{ratio(b, a)}</td>
						</tr>
					);
				})}
			</tbody>
		</table>
	);
}
