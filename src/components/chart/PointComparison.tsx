import type { ValuePoint } from "#/domain/value";
import type { BenchmarkView } from "#/lib/benchmarks";
import { familyColor, familyName } from "#/lib/families";
import {
	formatDuration,
	formatTokens,
	formatUsd,
	ratioFactor,
} from "#/lib/format";
import { ColorDot } from "./ColorDot";

const MISSING = "—";

/** How the hovered figure moved from the selected one, for the hovered model. */
type Change = { text: string; tone: "better" | "worse" | "same" };

const SAME: Change = { text: "Same", tone: "same" };
const UNKNOWN: Change = { text: MISSING, tone: "same" };

const TONE_CLASS = {
	better: "text-better",
	worse: "text-worse",
	same: "text-muted",
} as const;

type Row = {
	label: string;
	value: (point: ValuePoint) => number | null;
	format: (value: number) => string;
	change: (hovered: number, selected: number) => Change;
};

/** A score as the figure cells show it, to the tenth. */
function shownScore(score: number): number {
	return Number(score.toFixed(1));
}

/**
 * A score's change in points, where higher is better: "+3.8 pts". Taken from
 * the scores as shown, so the chip agrees with the two figures beside it.
 */
function scoreChange(hovered: number, selected: number): Change {
	const points = shownScore(hovered) - shownScore(selected);
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
function multipleChange(
	words: { fewer: string; more: string },
	hovered: number,
	selected: number,
): Change {
	if (hovered <= 0 || selected <= 0) return UNKNOWN;
	const { factor, same } = ratioFactor(hovered / selected);
	if (same) return SAME;
	return hovered < selected
		? { text: `${factor} ${words.fewer}`, tone: "better" }
		: { text: `${factor} ${words.more}`, tone: "worse" };
}

const COST_WORDS = { fewer: "cheaper", more: "pricier" };
const TOKEN_WORDS = { fewer: "fewer", more: "more" };
const TIME_WORDS = { fewer: "faster", more: "slower" };

/**
 * The widest figure the formatters produce over the shipped data is a
 * sub-cent plan cost, "$0.0000066"; a test recomputes it from the data.
 */
export const WIDEST_FIGURE_CHARS = 10;

/**
 * Width budget for the narrowest supported table, 286px (a 360px viewport):
 * each figure column holds WIDEST_FIGURE_CHARS at ~7.2px plus 4px of padding,
 * ~76px, so label and change together stay under 134px. Labels, chips and
 * model names wrap on a narrow card; figures never do. Each column's longest
 * word must fit: "Effective" in the label, "cheaper" in the chip. From a
 * 21rem table the change column is 7rem, which holds the widest shipped chip
 * (15 characters, about 93px of text) on one line; a test recomputes it.
 */
export const LABEL_COLUMN = "w-[4.25rem]";
export const CHANGE_COLUMN = "w-[4rem] @[21rem]:w-[7rem]";

/** The table's head says "Per task", so the labels need not. */
const PER_TASK = / per task$/;

/** Plan points cost a share of the subscription, not the API bill. */
function costLabel(points: readonly ValuePoint[]) {
	return points.some((p) => p.pricing.kind === "plan")
		? "Effective cost"
		: "Cost";
}

function comparisonRows(
	points: readonly ValuePoint[],
	view: BenchmarkView,
): Row[] {
	return [
		{
			label: "Score",
			value: (p) => p.score,
			format: view.formatScore,
			change: scoreChange,
		},
		{
			label: costLabel(points),
			value: (p) => p.costPerTaskUsd,
			format: formatUsd,
			change: (h, s) => multipleChange(COST_WORDS, h, s),
		},
		{
			label: view.tokensLabel.replace(PER_TASK, ""),
			value: (p) => p.benchmark.tokensPerTask,
			format: formatTokens,
			change: (h, s) => multipleChange(TOKEN_WORDS, h, s),
		},
		{
			label: "Time",
			value: (p) => p.benchmark.secondsPerTask,
			format: formatDuration,
			change: (h, s) => multipleChange(TIME_WORDS, h, s),
		},
	];
}

function changeOf(row: Row, hovered: number | null, selected: number | null) {
	if (hovered === null || selected === null) return UNKNOWN;
	return row.change(hovered, selected);
}

/**
 * The selected (pinned) point's figures beside the hovered point's, each
 * column headed by its model, and a chip with how the hovered one compares,
 * coloured by whether that is better or worse. Rows neither point has a
 * figure for are left out.
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
		<div className="@container mt-2">
			<table className="w-full table-fixed tabular-nums">
				<colgroup>
					<col className={LABEL_COLUMN} />
					<col />
					<col />
					<col className={CHANGE_COLUMN} />
				</colgroup>
				<thead>
					<tr className="border-b border-line align-bottom">
						<th
							scope="col"
							className="pb-1 text-left text-[11px] font-normal text-subtle"
						>
							Per task
						</th>
						<ModelHead point={selected} side="Selected" />
						<ModelHead point={hovered} side="Hovered" />
						<th scope="col" className="pb-1 text-right">
							<span className="sr-only">Change</span>
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
									className="pt-1 text-left font-normal break-words text-muted"
								>
									{row.label}
								</th>
								<td className="pt-1 pl-1 text-right whitespace-nowrap text-fg">
									{shown(a, row)}
								</td>
								<td className="pt-1 pl-1 text-right whitespace-nowrap text-fg">
									{shown(b, row)}
								</td>
								<td className="pt-1 pl-1 text-right">
									<ChangeChip change={change} />
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}

/** The tint's opacity is read by the contrast test in styles.test.ts. */
export const CHIP_BACKGROUND = {
	better: "bg-better/12",
	worse: "bg-worse/12",
	same: "",
} as const;

function ChangeChip({ change }: { change: Change }) {
	const { text, tone } = change;
	return (
		<span
			className={`rounded px-1 py-px text-[11px] leading-tight font-medium ${TONE_CLASS[tone]} ${CHIP_BACKGROUND[tone]}`}
		>
			{text}
		</span>
	);
}

/**
 * A point's column head: its model with the chart's colour dot, and its
 * effort and pricing beneath. Screen readers hear which side it is first.
 */
function ModelHead({ point, side }: { point: ValuePoint; side: string }) {
	const { benchmark, pricing } = point;
	const detail = `${benchmark.effortLabel} · ${pricing.kind === "api" ? "API" : pricing.plan.label}`;
	return (
		<th scope="col" className="pb-1 text-right font-normal">
			<span className="sr-only">{side}: </span>
			<span className="flex items-start justify-end gap-1 text-[12px] leading-snug font-semibold text-fg">
				<span className="mt-[0.3rem] shrink-0">
					<ColorDot color={familyColor(benchmark.family)} />
				</span>
				<span className="min-w-0 break-words">
					{familyName(benchmark.family)}
				</span>
			</span>
			<span className="block text-[11px] text-muted">{detail}</span>
		</th>
	);
}
