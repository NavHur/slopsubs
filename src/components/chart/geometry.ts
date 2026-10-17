import {
	type ScaleLinear,
	type ScaleLogarithmic,
	scaleLinear,
	scaleLog,
} from "d3-scale";
import type { ValuePoint } from "#/domain/value";

export const HEIGHT = 620;
export const MARGIN = { top: 28, right: 230, bottom: 52, left: 56 };
export const LABEL_GAP = 22;
export const LOG_TICKS = [
	0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50,
];

export type XScale =
	| ScaleLogarithmic<number, number>
	| ScaleLinear<number, number>;
export type Series = {
	id: string;
	points: ValuePoint[];
	label: string;
	color: string;
	isApi: boolean;
};

export type AxisScale = "log" | "linear";

export function makeScales(
	points: readonly ValuePoint[],
	scale: AxisScale,
	width: number,
) {
	const costs = points.map((p) => p.costPerTaskUsd);
	const iq = points.map((p) => p.intelligence);
	const right = Math.max(MARGIN.left + 100, width - MARGIN.right);
	const x: XScale =
		scale === "log"
			? scaleLog().domain([Math.min(...costs) * 0.7, Math.max(...costs) * 1.4])
			: scaleLinear().domain([0, Math.max(...costs) * 1.05]);
	x.range([MARGIN.left, right]);
	const y = scaleLinear()
		.domain([
			Math.floor(Math.min(...iq) / 10) * 10,
			Math.ceil(Math.max(...iq) / 10) * 10,
		])
		.range([HEIGHT - MARGIN.bottom, MARGIN.top]);
	return { x, y, right };
}

export function xTicks(x: XScale, scale: AxisScale): number[] {
	if (scale === "linear") return x.ticks(6);
	const [lo, hi] = x.domain();
	return LOG_TICKS.filter((t) => t >= lo && t <= hi);
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
			(p, i) =>
				`${i ? "L" : "M"}${px(x(p.costPerTaskUsd))},${px(y(p.intelligence))}`,
		)
		.join("");
}
