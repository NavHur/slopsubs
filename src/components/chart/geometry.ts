import {
	type ScaleLinear,
	type ScaleLogarithmic,
	scaleLinear,
	scaleLog,
} from "d3-scale";
import type { ValuePoint } from "#/domain/value";
import type { Size } from "#/lib/useElementSize";

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
};

/** Shortest plot worth drawing when the chart fills its container. */
const MIN_FILL_HEIGHT = 420;
const DEFAULT_HEIGHT = 620;

/**
 * Sizes the plot to its container: narrow screens get a squarer plot with
 * the legend below; wide ones fill the available height (the app shell) or
 * fall back to a fixed height when the page flows.
 */
export function chartLayout({ width, height }: Size): ChartLayout {
	if (width < COMPACT_WIDTH) {
		return {
			height: Math.round(Math.min(480, Math.max(360, width * 1.15))),
			margin: { top: 28, right: 12, bottom: 48, left: 36 },
			compact: true,
		};
	}
	return {
		height: height >= MIN_FILL_HEIGHT ? Math.floor(height) : DEFAULT_HEIGHT,
		margin: { top: 28, right: 230, bottom: 52, left: 56 },
		compact: false,
	};
}

export type XScale =
	| ScaleLogarithmic<number, number>
	| ScaleLinear<number, number>;
export type Series = {
	id: string;
	points: ValuePoint[];
	label: string;
	modelName: string;
	/** "API", or the subscription plan's label. */
	pricingLabel: string;
	color: string;
	isApi: boolean;
};

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
