import {
	type ScaleLinear,
	type ScaleLogarithmic,
	scaleLinear,
	scaleLog,
} from "d3-scale";
import type { ValuePoint } from "#/domain/value";
import { formatUsd } from "#/lib/format";
import type { Size } from "#/lib/useElementSize";
import type { PointMarker } from "./series";

export const LABEL_GAP = 22;
/** Below this width series labels leave the plot for a legend underneath. */
const COMPACT_WIDTH = 640;
/** Narrowest clear space between neighbouring x-axis tick labels. */
export const MIN_TICK_LABEL_GAP_PX = 12;

export type ChartLayout = {
	height: number;
	margin: { top: number; right: number; bottom: number; left: number };
	/** Series labels sit in a legend below the plot instead of beside it. */
	compact: boolean;
	/** Model labels sit in a column right of the plot. */
	endLabels: boolean;
};

/** Shortest plot worth drawing when the chart fills its container. */
const MIN_FILL_HEIGHT = 420;
export const DEFAULT_HEIGHT = 620;
/** Compact plots are roughly square, kept within these heights (px). */
const COMPACT_MIN_HEIGHT = 360;
const COMPACT_MAX_HEIGHT = 480;
const COMPACT_HEIGHT_RATIO = 1.15;
/** Right margin holding the model labels beside a wide plot. */
const LABEL_COLUMN_PX = 180;
/** Right margin without labels: room for half the last x-axis tick label. */
const PLOT_EDGE_PX = 24;

/**
 * Sizes the plot to its container: narrow screens get a squarer plot with
 * the legend below; wide ones fill the available height (the app shell) or
 * fall back to a fixed height when the page flows, and give the label column
 * back to the plot when `labels` is off.
 */
export function chartLayout(
	{ width, height }: Size,
	{ labels }: { labels: boolean },
): ChartLayout {
	if (width < COMPACT_WIDTH) {
		return {
			height: Math.round(
				Math.min(
					COMPACT_MAX_HEIGHT,
					Math.max(COMPACT_MIN_HEIGHT, width * COMPACT_HEIGHT_RATIO),
				),
			),
			margin: { top: 28, right: 12, bottom: 48, left: 36 },
			compact: true,
			endLabels: false,
		};
	}
	return {
		height: height >= MIN_FILL_HEIGHT ? Math.floor(height) : DEFAULT_HEIGHT,
		margin: {
			top: 28,
			right: labels ? LABEL_COLUMN_PX : PLOT_EDGE_PX,
			bottom: 52,
			left: 56,
		},
		compact: false,
		endLabels: labels,
	};
}

export type XScale =
	| ScaleLogarithmic<number, number>
	| ScaleLinear<number, number>;

export type AxisScale = "log" | "linear";

export function makeScales(
	points: readonly ValuePoint[],
	scale: AxisScale,
	width: number,
	{ height, margin }: ChartLayout,
) {
	const costs = points.map((p) => p.costPerTaskUsd);
	const scores = points.map((p) => p.score);
	const right = Math.max(margin.left + 100, width - margin.right);
	const x: XScale =
		scale === "log"
			? scaleLog().domain([Math.min(...costs) * 0.7, Math.max(...costs) * 1.4])
			: scaleLinear().domain([0, Math.max(...costs) * 1.05]);
	x.range([margin.left, right]);
	const y = scaleLinear()
		.domain([
			Math.floor(Math.min(...scores) / 10) * 10,
			Math.ceil(Math.max(...scores) / 10) * 10,
		])
		.range([height - margin.bottom, margin.top]);
	return { x, y, right };
}

/**
 * Mantissas of the log ticks within each decade, densest first: 1-2-5, then
 * the near-even 1-3, then decades alone.
 */
const LOG_TICK_MANTISSAS = [[1, 2, 5], [1, 3], [1]] as const;
/** Linear tick counts tried, most first; d3 treats each as a hint. */
const LINEAR_TICK_COUNTS = [6, 5, 4, 3, 2, 1] as const;

/**
 * The densest ticks whose labels, at their estimated widths, keep at least
 * MIN_TICK_LABEL_GAP_PX apart: on a log axis 1-2-5 per decade, then 1-3,
 * then every decade, then every second or third decade and so on.
 */
export function xTicks(x: XScale, scale: AxisScale): number[] {
	const candidates =
		scale === "linear" ? linearCandidates(x) : logCandidates(x.domain());
	const fitting = candidates.find((ticks) => labelsFit(ticks, x));
	// The last candidate is a single tick or none, which always fits.
	return fitting ?? candidates[candidates.length - 1];
}

function linearCandidates(x: XScale): number[][] {
	return LINEAR_TICK_COUNTS.map((count) => x.ticks(count));
}

function logCandidates([lo, hi]: number[]): number[][] {
	const sub = LOG_TICK_MANTISSAS.map((mantissas) =>
		logTicks(lo, hi, mantissas),
	);
	const decades = sub[sub.length - 1];
	const strided = decades
		.slice(1)
		.map((_, i) => decades.filter((__, j) => j % (i + 2) === 0));
	return [...sub, ...strided];
}

function logTicks(
	lo: number,
	hi: number,
	mantissas: readonly number[],
): number[] {
	const ticks: number[] = [];
	for (
		let e = Math.floor(Math.log10(lo));
		e <= Math.ceil(Math.log10(hi));
		e++
	) {
		for (const m of mantissas) {
			// toPrecision drops float noise such as 3 * 10 ** -3 = 0.0030000000000000005.
			const tick = Number((m * 10 ** e).toPrecision(12));
			if (tick >= lo && tick <= hi) ticks.push(tick);
		}
	}
	return ticks;
}

/** Whether each tick label clears the next by MIN_TICK_LABEL_GAP_PX. */
export function labelsFit(ticks: readonly number[], x: XScale): boolean {
	return ticks.slice(1).every((tick, i) => {
		const prev = ticks[i];
		const clear =
			x(tick) -
			textWidth(formatUsd(tick)) / 2 -
			(x(prev) + textWidth(formatUsd(prev)) / 2);
		return clear >= MIN_TICK_LABEL_GAP_PX;
	});
}

/** Tenth-pixel precision; also keeps SSR and client floats identical. */
export const px = (value: number) => Math.round(value * 10) / 10;

export function pathOf(
	points: readonly ValuePoint[],
	x: XScale,
	y: (v: number) => number,
): string {
	return points
		.map(
			(p, i) => `${i ? "L" : "M"}${px(x(p.costPerTaskUsd))},${px(y(p.score))}`,
		)
		.join("");
}

/**
 * SVG path for a point marker of radius `r` centred on (cx, cy). Shapes are
 * scaled to look about as heavy as the circle.
 */
export function markerPath(
	marker: PointMarker,
	cx: number,
	cy: number,
	r: number,
): string {
	const at = (dx: number, dy: number) => `${px(cx + dx)},${px(cy + dy)}`;
	switch (marker) {
		case "circle":
			return `M${at(-r, 0)}a${r},${r} 0 1,0 ${2 * r},0a${r},${r} 0 1,0 ${-2 * r},0Z`;
		case "square": {
			const h = r * 0.9;
			return `M${at(-h, -h)}L${at(h, -h)}L${at(h, h)}L${at(-h, h)}Z`;
		}
		case "diamond": {
			const h = r * 1.25;
			return `M${at(0, -h)}L${at(h, 0)}L${at(0, h)}L${at(-h, 0)}Z`;
		}
		case "triangle": {
			const h = r * 1.3;
			return `M${at(0, -h)}L${at(h * 0.87, h / 2)}L${at(-h * 0.87, h / 2)}Z`;
		}
		case "triangle-down": {
			const h = r * 1.3;
			return `M${at(0, h)}L${at(h * 0.87, -h / 2)}L${at(-h * 0.87, -h / 2)}Z`;
		}
	}
}

export type Box = { width: number; height: number };

/** A span of `size` placed as near `start` as fits between `min` and `max`. */
export function clampSpan(
	start: number,
	size: number,
	min: number,
	max: number,
): number {
	return Math.max(min, Math.min(start, max - size));
}

/** Space between a point and its tooltip. */
const TOOLTIP_GAP_PX = 14;
/** Closest a tooltip comes to the chart's edge. */
const TOOLTIP_EDGE_PX = 8;

type Placement = { left: number; top: number };

/**
 * Where a tooltip sits so it never covers its point: centred above it, else
 * below, else beside it. When none of those fit inside `bounds` it takes the
 * roomier of above and below and spills out of the chart.
 */
export function tooltipPlacement(
	anchor: { x: number; y: number },
	tooltip: Box,
	bounds: Box,
): Placement {
	const left = clampSpan(
		anchor.x - tooltip.width / 2,
		tooltip.width,
		TOOLTIP_EDGE_PX,
		bounds.width - TOOLTIP_EDGE_PX,
	);
	const above = anchor.y - TOOLTIP_GAP_PX - tooltip.height;
	const below = anchor.y + TOOLTIP_GAP_PX;
	if (above >= TOOLTIP_EDGE_PX) return { left, top: above };
	if (below + tooltip.height <= bounds.height - TOOLTIP_EDGE_PX) {
		return { left, top: below };
	}
	const roomier = anchor.y > bounds.height / 2 ? above : below;
	return besidePlacement(anchor, tooltip, bounds) ?? { left, top: roomier };
}

function besidePlacement(
	anchor: { x: number; y: number },
	tooltip: Box,
	bounds: Box,
): Placement | null {
	const top = clampSpan(
		anchor.y - tooltip.height / 2,
		tooltip.height,
		TOOLTIP_EDGE_PX,
		bounds.height - TOOLTIP_EDGE_PX,
	);
	const right = anchor.x + TOOLTIP_GAP_PX;
	if (right + tooltip.width <= bounds.width - TOOLTIP_EDGE_PX) {
		return { left: right, top };
	}
	const left = anchor.x - TOOLTIP_GAP_PX - tooltip.width;
	return left >= TOOLTIP_EDGE_PX ? { left, top } : null;
}

export type Rect = { left: number; top: number; width: number; height: number };

/** Whether two boxes come within `gap` px of each other. */
export function overlaps(a: Rect, b: Rect, gap = 2): boolean {
	return (
		a.left < b.left + b.width + gap &&
		b.left < a.left + a.width + gap &&
		a.top < b.top + b.height + gap &&
		b.top < a.top + a.height + gap
	);
}

/**
 * Width of a short tabular label at the axis font size.
 * ceiling: estimated, not measured; measure the text if labels grow longer
 * than a price or a score, or the axis font changes.
 */
const textWidth = (text: string) => text.length * 7;
const TICK_LABEL_HEIGHT_PX = 16;
/** Height of the axis text above its baseline; tracks the 12px axis font. */
const TICK_LABEL_ASCENT_PX = 12;
/** Baseline of the x-axis tick labels below the plot. */
export const X_TICK_LABEL_DROP_PX = 22;
/** Gap between the y-axis tick labels and the plot. */
export const Y_TICK_LABEL_GAP_PX = 12;

export function xTickLabelBox(
	label: string,
	centerX: number,
	{ height, margin }: ChartLayout,
): Rect {
	const width = textWidth(label);
	return {
		left: centerX - width / 2,
		top: height - margin.bottom + X_TICK_LABEL_DROP_PX - TICK_LABEL_ASCENT_PX,
		width,
		height: TICK_LABEL_HEIGHT_PX,
	};
}

export function yTickLabelBox(
	label: string,
	centerY: number,
	{ margin }: ChartLayout,
): Rect {
	const width = textWidth(label);
	return {
		left: margin.left - Y_TICK_LABEL_GAP_PX - width,
		top: centerY - TICK_LABEL_HEIGHT_PX / 2,
		width,
		height: TICK_LABEL_HEIGHT_PX,
	};
}

/** A point's value shown on an axis, in a pill over the tick labels. */
export type AxisReadout = Rect & { text: string };
export type AxisReadouts = {
	x: AxisReadout;
	y: AxisReadout;
	/** The point's position in the chart, which the pills sit level with. */
	at: { x: number; y: number };
};

const READOUT_PAD_PX = 10;
const READOUT_HEIGHT_PX = 18;
/** Gap between a y-axis readout and the plot. */
const Y_READOUT_GAP_PX = 4;

/**
 * Pills for a point's value on each axis: the y one beside the plot level
 * with the point, the x one in the tick row under it, both inside the chart.
 */
export function axisReadouts(
	at: { x: number; y: number },
	text: { x: string; y: string },
	layout: ChartLayout,
	chartWidth: number,
): AxisReadouts {
	const xWidth = textWidth(text.x) + READOUT_PAD_PX;
	const yWidth = textWidth(text.y) + READOUT_PAD_PX;
	const xRow = xTickLabelBox(text.x, at.x, layout);
	return {
		at,
		x: {
			text: text.x,
			left: clampSpan(at.x - xWidth / 2, xWidth, 0, chartWidth),
			top: xRow.top + (xRow.height - READOUT_HEIGHT_PX) / 2,
			width: xWidth,
			height: READOUT_HEIGHT_PX,
		},
		y: {
			text: text.y,
			left: clampSpan(
				layout.margin.left - Y_READOUT_GAP_PX - yWidth,
				yWidth,
				0,
				chartWidth,
			),
			top: at.y - READOUT_HEIGHT_PX / 2,
			width: yWidth,
			height: READOUT_HEIGHT_PX,
		},
	};
}
