import type { ScaleLinear } from "d3-scale";
import type { ValuePoint } from "#/domain/value";
import { formatIntelligence, formatUsd } from "#/lib/format";
import {
	type AxisReadout,
	type AxisReadouts,
	axisReadouts,
	type ChartLayout,
	px,
	type XScale,
} from "./geometry";

/** A point's effective cost and score on the axes, in the tick formats. */
export function pointReadouts(
	point: ValuePoint,
	scales: { x: XScale; y: ScaleLinear<number, number> },
	layout: ChartLayout,
	chartWidth: number,
): AxisReadouts {
	return axisReadouts(
		{ x: scales.x(point.costPerTaskUsd), y: scales.y(point.intelligence) },
		{
			x: formatUsd(point.costPerTaskUsd),
			y: formatIntelligence(point.intelligence),
		},
		layout,
		chartWidth,
	);
}

/**
 * Dashed guides from a point to both axes, where pills show its value; the
 * axes hide the tick labels the pills cover.
 */
export function Crosshair({
	readouts,
	layout,
	color,
}: {
	readouts: AxisReadouts;
	layout: ChartLayout;
	color: string;
}) {
	const { margin, height } = layout;
	const cx = px(readouts.at.x);
	const cy = px(readouts.at.y);
	return (
		// biome-ignore lint/a11y/noAriaHiddenOnFocusable: an SVG group is not focusable; the point's own label already reads these values
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
				strokeDasharray="4 4"
			/>
			<line
				x1={cx}
				x2={cx}
				y1={cy}
				y2={height - margin.bottom}
				stroke="currentColor"
				strokeDasharray="4 4"
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
				fill="currentColor"
				className="font-medium"
			>
				{text}
			</text>
		</g>
	);
}
