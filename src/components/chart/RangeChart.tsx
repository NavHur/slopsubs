import { type ReactNode, useState } from "react";
import type { FamilyId } from "#/domain/model";
import type { EffortValue } from "#/domain/ranges";
import { familyColor, familyName } from "#/lib/families";
import { useElementSize } from "#/lib/useElementSize";
import {
	COLUMN_GAP_PX,
	type RangeLayout,
	type RangeScale,
	rangeLayout,
	rangeScale,
	rangeTicks,
} from "./rangeGeometry";

/** One effort's figure on a row. */
export type RangeDot = { id: string; label: string; value: number };

/** One row: a model, or a model on a plan, with a dot per effort. */
export type RangeRow = {
	id: string;
	label: string;
	/** Muted text after the label, such as the plan or a cap share. */
	note?: string;
	color: string;
	/** Drawn hollow when its figure rests on an estimate. */
	hollow: boolean;
	/** Lowest effort first. */
	dots: RangeDot[];
};

/** A model's row, from its efforts; the caller sets what differs by chart. */
export function modelRow(
	{
		seriesId,
		family,
		efforts,
	}: { seriesId: string; family: FamilyId; efforts: EffortValue[] },
	{ note, hollow }: Pick<RangeRow, "note" | "hollow">,
): RangeRow {
	return {
		id: seriesId,
		label: familyName(family),
		note,
		color: familyColor(family),
		hollow,
		dots: efforts.map(({ benchmark, value }) => ({
			id: benchmark.id,
			label: benchmark.effortLabel,
			value,
		})),
	};
}

export type RangeGroup = { id: string; heading?: ReactNode; rows: RangeRow[] };

/** How the chart reads its figures: "tasks a week", "per task". */
export type RangeUnits = {
	format: (value: number) => string;
	/** Names the axis, with its scale. */
	axisLabel: string;
	/** Follows a value read aloud: "410 tasks a week". */
	spoken: string;
};

const ROW_TRACK_PX = 24;
const DOT_RADIUS = 4.5;
/** Touch-sized target around each dot. */
const DOT_HIT_RADIUS = 11;

type ActiveDot = { rowId: string; dotId: string } | null;

/**
 * Rows of dots on a shared log axis, one per effort from lowest to highest,
 * joined by a line. Hovering, focusing or tapping a dot reads its effort and
 * figure in place of the row's range.
 */
export function RangeChart({
	groups,
	units,
}: {
	groups: readonly RangeGroup[];
	units: RangeUnits;
}) {
	const [ref, { width }] = useElementSize<HTMLDivElement>();
	const [active, setActive] = useState<ActiveDot>(null);
	const layout = rangeLayout(width);
	const values = groups.flatMap((g) => g.rows.flatMap((r) => r.dots));
	const x = rangeScale(
		values.map((d) => d.value),
		layout.trackWidth,
	);
	const ticks = rangeTicks(x);
	const rowProps = { layout, x, ticks, units, active, onActive: setActive };
	return (
		<div ref={ref} data-chart-width={width} className="flex flex-col">
			<Axis layout={layout} x={x} ticks={ticks} units={units} />
			{groups.map((group) => (
				<div key={group.id} className="flex flex-col">
					{group.heading && (
						<div className="pt-4 pb-1 text-[13px]">{group.heading}</div>
					)}
					{group.rows.map((row) => (
						<Row key={row.id} row={row} {...rowProps} />
					))}
				</div>
			))}
		</div>
	);
}

function Axis({
	layout,
	x,
	ticks,
	units,
}: {
	layout: RangeLayout;
	x: RangeScale;
	ticks: number[];
	units: RangeUnits;
}) {
	return (
		<div
			className="grid items-end border-b border-line pb-1 text-[11px] text-subtle"
			style={{ gridTemplateColumns: layout.columns, columnGap: COLUMN_GAP_PX }}
		>
			<span className={layout.compact ? "col-span-2" : ""}>
				{units.axisLabel}
			</span>
			<svg
				width={layout.trackWidth}
				height={16}
				aria-hidden="true"
				className={`block overflow-visible ${layout.compact ? "col-span-2" : ""}`}
			>
				{ticks.map((tick) => (
					<text
						key={tick}
						x={x(tick)}
						y={12}
						textAnchor="middle"
						className="fill-subtle text-[11px] tabular-nums"
					>
						{units.format(tick)}
					</text>
				))}
			</svg>
		</div>
	);
}

function rangeText(dots: readonly RangeDot[], units: RangeUnits): string {
	const values = dots.map((d) => d.value);
	const low = units.format(Math.min(...values));
	const high = units.format(Math.max(...values));
	return low === high ? low : `${low}–${high}`;
}

function Row({
	row,
	layout,
	x,
	ticks,
	units,
	active,
	onActive,
}: {
	row: RangeRow;
	layout: RangeLayout;
	x: RangeScale;
	ticks: number[];
	units: RangeUnits;
	active: ActiveDot;
	onActive: (dot: ActiveDot) => void;
}) {
	const shown =
		active?.rowId === row.id
			? row.dots.find((d) => d.id === active.dotId)
			: null;
	const value = shown
		? `${shown.label} ${units.format(shown.value)}`
		: rangeText(row.dots, units);
	return (
		<div
			className="grid items-center border-b border-line py-1.5 text-[13px]"
			style={{ gridTemplateColumns: layout.columns, columnGap: COLUMN_GAP_PX }}
		>
			<span className="whitespace-nowrap">
				<span style={{ color: row.color }}>{row.label}</span>
				{row.note && <span className="ml-1 text-muted">{`· ${row.note}`}</span>}
			</span>
			<Track
				row={row}
				layout={layout}
				x={x}
				ticks={ticks}
				units={units}
				onActive={onActive}
			/>
			<span
				className={`whitespace-nowrap text-right tabular-nums ${shown ? "text-fg" : "text-muted"} ${layout.compact ? "col-start-2 row-start-1" : ""}`}
			>
				{value}
			</span>
		</div>
	);
}

function Track({
	row,
	layout,
	x,
	ticks,
	units,
	onActive,
}: {
	row: RangeRow;
	layout: RangeLayout;
	x: RangeScale;
	ticks: number[];
	units: RangeUnits;
	onActive: (dot: ActiveDot) => void;
}) {
	const xs = row.dots.map((d) => x(d.value));
	const mid = ROW_TRACK_PX / 2;
	const show = (dot: RangeDot) => () =>
		onActive({ rowId: row.id, dotId: dot.id });
	const hide = () => onActive(null);
	return (
		<svg
			width={layout.trackWidth}
			height={ROW_TRACK_PX}
			// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- an SVG root cannot be a fieldset; role=img would hide the dots inside
			role="group"
			aria-label={`${row.label}${row.note ? `, ${row.note}` : ""}`}
			className={`block overflow-visible ${layout.compact ? "col-span-full" : ""}`}
		>
			{ticks.map((tick) => (
				<line
					key={tick}
					x1={x(tick)}
					x2={x(tick)}
					y1={0}
					y2={ROW_TRACK_PX}
					className="stroke-grid"
					strokeDasharray="2 3"
				/>
			))}
			<line
				x1={Math.min(...xs)}
				x2={Math.max(...xs)}
				y1={mid}
				y2={mid}
				stroke={row.color}
				strokeWidth={2}
				opacity={0.45}
			/>
			{row.dots.map((dot) => (
				<g
					key={dot.id}
					// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- SVG has no native button; the dot takes focus to read its figure
					role="button"
					tabIndex={0}
					aria-label={`${dot.label}: ${units.format(dot.value)} ${units.spoken}`}
					className="group cursor-pointer outline-none"
					onMouseEnter={show(dot)}
					onMouseLeave={hide}
					onFocus={show(dot)}
					onBlur={hide}
					onClick={show(dot)}
				>
					<circle
						cx={x(dot.value)}
						cy={mid}
						r={DOT_HIT_RADIUS}
						fill="transparent"
					/>
					<circle
						cx={x(dot.value)}
						cy={mid}
						r={DOT_RADIUS}
						fill={row.hollow ? "var(--bg)" : row.color}
						stroke={row.color}
						strokeWidth={1.5}
						className="group-focus-visible:stroke-fg"
					/>
				</g>
			))}
		</svg>
	);
}
