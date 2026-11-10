import type { ScaleLinear } from "d3-scale";
import type { ValuePoint } from "#/domain/value";
import type { BenchmarkView } from "#/lib/benchmarks";
import { formatUsd } from "#/lib/format";
import {
	type AxisReadout,
	type AxisReadouts,
	axisReadouts,
	type Box,
	type ChartLayout,
	px,
	separateReadouts,
	type XScale,
} from "./geometry";
import type { ShownDetails } from "./pointDetails";

/** A point's effective cost and score on the axes, in the tick formats. */
export function pointReadouts(
	point: ValuePoint,
	scales: { x: XScale; y: ScaleLinear<number, number> },
	layout: ChartLayout,
	chartWidth: number,
	benchmark: BenchmarkView,
): AxisReadouts {
	return axisReadouts(
		{ x: scales.x(point.costPerTaskUsd), y: scales.y(point.score) },
		{
			x: formatUsd(point.costPerTaskUsd),
			y: benchmark.formatScore(point.score),
		},
		layout,
		chartWidth,
	);
}

/** A shown point with its pills; the selected point's guides draw solid. */
export type ShownCrosshair = {
	point: ValuePoint;
	readouts: AxisReadouts;
	solid: boolean;
};

/**
 * The shown points' crosshairs, the selected one first. The hovered point's
 * pills move off the selected one's where they would cover them.
 */
export function shownCrosshairs(
	details: ShownDetails | null,
	project: (point: ValuePoint) => AxisReadouts,
	bounds: Box,
): ShownCrosshair[] {
	if (!details) return [];
	const readouts = project(details.point);
	const hovered = { point: details.point, readouts, solid: false };
	if (!details.selected) return [hovered];
	const selected = project(details.selected);
	return [
		{ point: details.selected, readouts: selected, solid: true },
		{ ...hovered, readouts: separateReadouts(selected, readouts, bounds) },
	];
}

const DASHED = "4 4";

/**
 * Guides from a point to both axes, where pills show its value; the axes hide
 * the tick labels the pills cover. A compared point's guides are dashed and
 * the selected point's solid.
 */
export function Crosshair({
	readouts,
	layout,
	color,
	solid = false,
}: {
	readouts: AxisReadouts;
	layout: ChartLayout;
	color: string;
	/** Draw the guides unbroken, for the selected point under a comparison. */
	solid?: boolean;
}) {
	const dash = solid ? undefined : DASHED;
	const { margin, height } = layout;
	const cx = px(readouts.at.x);
	const cy = px(readouts.at.y);
	return (
		// oxlint-disable-next-line jsx-a11y/no-aria-hidden-on-focusable -- an SVG group is not focusable; the point's own label already reads these values
		<g
			aria-hidden="true"
			className="pointer-events-none text-[12px] tabular-nums"
			style={{ color }}
		>
			<line
				x1={margin.left}
				x2={cx}
				y1={cy}
				y2={cy}
				stroke="currentColor"
				strokeDasharray={dash}
			/>
			<line
				x1={cx}
				x2={cx}
				y1={cy}
				y2={height - margin.bottom}
				stroke="currentColor"
				strokeDasharray={dash}
			/>
			<Readout readout={readouts.y} />
			<Readout readout={readouts.x} />
		</g>
	);
}

function Readout({ readout }: { readout: AxisReadout }) {
	const { text, left, top, width, height } = readout;
	return (
		<g>
			<rect
				x={px(left)}
				y={px(top)}
				width={width}
				height={height}
				rx={4}
				className="fill-panel"
				stroke="currentColor"
			/>
			<text
				x={px(left + width / 2)}
				y={px(top + height / 2)}
				dy="0.32em"
				textAnchor="middle"
				className="fill-fg font-medium"
			>
				{text}
			</text>
		</g>
	);
}
