import type { ScaleLinear } from "d3-scale";
import type { ValuePoint } from "#/domain/value";
import { formatIntelligence, formatUsd } from "#/lib/format";
import { type ChartLayout, clampSpan, px, type XScale } from "./geometry";

/**
 * Width of a readout pill: an estimate for short tabular labels at the axis
 * font size.
 * ceiling: estimated, not measured; measure the text if labels grow longer
 * than a price or a score, or the axis font changes.
 */
const READOUT_CHAR_PX = 7;
const READOUT_PAD_PX = 10;
const READOUT_HEIGHT_PX = 18;
/** Gap between a y-axis readout and the plot, matching the tick labels. */
const Y_READOUT_GAP_PX = 4;
/** Centre of the x-axis tick labels below the plot. */
const X_READOUT_DROP_PX = 18;

const readoutWidth = (text: string) =>
	text.length * READOUT_CHAR_PX + READOUT_PAD_PX;

/**
 * Dashed guides from a point to both axes, each axis showing the point's
 * value in the axis format, over the tick labels it lands on.
 */
export function Crosshair({
	point,
	color,
	x,
	y,
	layout,
	width,
}: {
	point: ValuePoint;
	color: string;
	x: XScale;
	y: ScaleLinear<number, number>;
	layout: ChartLayout;
	/** The chart's width; readouts stay inside it. */
	width: number;
}) {
	const { margin, height } = layout;
	const bottom = height - margin.bottom;
	const cx = px(x(point.costPerTaskUsd));
	const cy = px(y(point.intelligence));
	const score = formatIntelligence(point.intelligence);
	const cost = formatUsd(point.costPerTaskUsd);
	const scoreWidth = readoutWidth(score);
	const costWidth = readoutWidth(cost);
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
				y2={bottom}
				stroke="currentColor"
				strokeDasharray="4 4"
			/>
			<Readout
				text={score}
				left={clampSpan(
					margin.left - Y_READOUT_GAP_PX - scoreWidth,
					scoreWidth,
					0,
					width,
				)}
				centerY={cy}
				width={scoreWidth}
			/>
			<Readout
				text={cost}
				left={clampSpan(cx - costWidth / 2, costWidth, 0, width)}
				centerY={bottom + X_READOUT_DROP_PX}
				width={costWidth}
			/>
		</g>
	);
}

function Readout({
	text,
	left,
	centerY,
	width,
}: {
	text: string;
	left: number;
	centerY: number;
	width: number;
}) {
	return (
		<g>
			<rect
				x={px(left)}
				y={px(centerY - READOUT_HEIGHT_PX / 2)}
				width={width}
				height={READOUT_HEIGHT_PX}
				rx={4}
				className="fill-panel"
				stroke="currentColor"
			/>
			<text
				x={px(left + width / 2)}
				y={centerY}
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
