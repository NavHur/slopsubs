import {
	type ScaleLinear,
	type ScaleLogarithmic,
	scaleLinear,
	scaleLog,
} from "d3-scale";
import type { ValuePoint } from "#/domain/value";
import type { Size } from "#/lib/useElementSize";
import type { PointMarker } from "./series";

export const LABEL_GAP = 22;
export const LOG_TICKS = [
	0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50,
];
/** Below this width series labels leave the plot for a legend underneath. */
const COMPACT_WIDTH = 640;
/** Narrowest gap between x-axis tick centres before labels collide. */
const MIN_TICK_SPACING_PX = 44;

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
	const iq = points.map((p) => p.intelligence);
	const right = Math.max(margin.left + 100, width - margin.right);
	const x: XScale =
		scale === "log"
			? scaleLog().domain([Math.min(...costs) * 0.7, Math.max(...costs) * 1.4])
			: scaleLinear().domain([0, Math.max(...costs) * 1.05]);
	x.range([margin.left, right]);
	const y = scaleLinear()
		.domain([
			Math.floor(Math.min(...iq) / 10) * 10,
			Math.ceil(Math.max(...iq) / 10) * 10,
		])
		.range([height - margin.bottom, margin.top]);
	return { x, y, right };
}

/** Ticks spaced far enough apart that their labels never overlap. */
export function xTicks(x: XScale, scale: AxisScale): number[] {
	const [left, right] = x.range();
	const fit = Math.max(2, Math.floor((right - left) / MIN_TICK_SPACING_PX));
	if (scale === "linear") return x.ticks(Math.min(6, fit));
	const [lo, hi] = x.domain();
	const inRange = LOG_TICKS.filter((t) => t >= lo && t <= hi);
	if (inRange.length <= fit) return inRange;
	const decades = inRange.filter(isPowerOfTen);
	const stride = Math.ceil(decades.length / fit);
	return decades.filter((_, i) => i % stride === 0);
}

const isPowerOfTen = (value: number) =>
	Math.abs(Math.log10(value) - Math.round(Math.log10(value))) < 1e-9;

/** Tenth-pixel precision; also keeps SSR and client floats identical. */
export const px = (value: number) => Math.round(value * 10) / 10;

export function pathOf(
	points: readonly ValuePoint[],
	x: XScale,
	y: (v: number) => number,
): string {
	return points
		.map(
			(p, i) =>
				`${i ? "L" : "M"}${px(x(p.costPerTaskUsd))},${px(y(p.intelligence))}`,
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
