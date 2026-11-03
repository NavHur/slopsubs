import {
	type ScaleLinear,
	type ScaleLogarithmic,
	scaleLinear,
	scaleLog,
} from "d3-scale";
import type { TimedPoint } from "#/domain/tradeoffs";
import type { Vec3 } from "./projection";

/**
 * The trade-off chart's cube: time per task runs along x, cost per task
 * (log) along y, both across -1..1 of the floor, and score rises up z.
 */

/** How tall the score axis stands over the 2-unit floor, so the cube reads
 * as a box rather than a slab. */
export const SCORE_HEIGHT = 1.5;

const FLOOR_MIN = -1;
const FLOOR_MAX = 1;

/** The corner where all three axes start: no time, cheapest, score 0. */
const ORIGIN: Vec3 = [FLOOR_MIN, FLOOR_MIN, 0];

/** Each axis as a segment from the origin corner. */
export const AXES = {
	minutes: [ORIGIN, [FLOOR_MAX, FLOOR_MIN, 0]],
	cost: [ORIGIN, [FLOOR_MIN, FLOOR_MAX, 0]],
	score: [ORIGIN, [FLOOR_MIN, FLOOR_MIN, SCORE_HEIGHT]],
} as const satisfies Record<string, readonly [Vec3, Vec3]>;
export type AxisId = keyof typeof AXES;

/** The floor's corners and the score axis's top. The camera fits these
 * whatever the points, so the frame holds still as they change; it also fits
 * the points, which can rise above this frame over the far corner. */
export const FRAME_ANCHORS: readonly Vec3[] = [
	[FLOOR_MIN, FLOOR_MIN, 0],
	[FLOOR_MIN, FLOOR_MAX, 0],
	[FLOOR_MAX, FLOOR_MIN, 0],
	[FLOOR_MAX, FLOOR_MAX, 0],
	AXES.score[1],
];

/** A labelled tick: its value in the axis's unit and its distance along
 * the axis in plot units. */
export type AxisTick = { value: number; at: number };

export type PlotSpace = {
	/** Where a point sits in the cube. */
	position: (point: TimedPoint) => Vec3;
	ticks: Record<AxisId, AxisTick[]>;
};

const SECONDS_PER_MINUTE = 60;

/** Room past the cheapest and priciest point on the log cost axis, as
 * factors, so no point sits on the cube's edge (as on the 2D chart). */
const COST_PAD_BELOW = 0.7;
const COST_PAD_ABOVE = 1.4;

/** Tick count hints for the linear axes; d3 rounds them to nice steps. */
const MINUTE_TICKS = 6;
const SCORE_TICKS = 5;

/** Mantissas of the log ticks within each decade, densest first. */
const LOG_TICK_MANTISSAS = [[1, 2, 5], [1, 3], [1]] as const;
/** Most cost ticks one axis carries before it thins to sparser mantissas. */
const MAX_COST_TICKS = 6;

/**
 * The cube for these points. Time and score start at zero, so heights and
 * depths compare honestly; cost is logarithmic like the 2D chart's. An axis
 * with no spread still gets a positive extent, so every point maps inside.
 */
export function plotSpace(
	points: readonly [TimedPoint, ...TimedPoint[]],
): PlotSpace {
	const minutes = scaleLinear()
		.domain([0, Math.max(...points.map(minutesOf))])
		.nice(MINUTE_TICKS)
		.range([FLOOR_MIN, FLOOR_MAX]);
	const costs = points.map((p) => p.costPerTaskUsd);
	const cost = scaleLog()
		.domain([
			Math.min(...costs) * COST_PAD_BELOW,
			Math.max(...costs) * COST_PAD_ABOVE,
		])
		.range([FLOOR_MIN, FLOOR_MAX]);
	const score = scaleLinear()
		.domain([0, Math.max(...points.map((p) => p.score))])
		.nice(SCORE_TICKS)
		.range([0, SCORE_HEIGHT]);
	widenFlatDomain(minutes);
	widenFlatDomain(score);
	return {
		position: (p) => [
			minutes(minutesOf(p)),
			cost(p.costPerTaskUsd),
			score(p.score),
		],
		ticks: {
			minutes: linearTicks(minutes, MINUTE_TICKS, FLOOR_MIN),
			cost: costTicks(cost),
			score: linearTicks(score, SCORE_TICKS, 0),
		},
	};
}

function minutesOf(point: TimedPoint): number {
	return point.secondsPerTask / SECONDS_PER_MINUTE;
}

/** Gives a zero-to-zero domain (every point at 0) a unit extent. */
function widenFlatDomain(scale: ScaleLinear<number, number>): void {
	const [low, high] = scale.domain();
	if (high === low) scale.domain([low, low + 1]);
}

function linearTicks(
	scale: ScaleLinear<number, number>,
	count: number,
	start: number,
): AxisTick[] {
	return scale.ticks(count).map((value) => ({
		value,
		at: scale(value) - start,
	}));
}

/** The densest 1-2-5, 1-3 or decade ticks inside the cost domain that keep
 * to MAX_COST_TICKS, falling back to the sparsest. */
function costTicks(scale: ScaleLogarithmic<number, number>): AxisTick[] {
	const [low, high] = scale.domain();
	const candidates = LOG_TICK_MANTISSAS.map((mantissas) =>
		logValues(low, high, mantissas),
	);
	const values =
		candidates.find((c) => c.length <= MAX_COST_TICKS) ??
		candidates[candidates.length - 1];
	return values.map((value) => ({ value, at: scale(value) - FLOOR_MIN }));
}

/** Every mantissa × power of ten within [low, high]. */
function logValues(
	low: number,
	high: number,
	mantissas: readonly number[],
): number[] {
	const values: number[] = [];
	for (
		let exponent = Math.floor(Math.log10(low));
		exponent <= Math.ceil(Math.log10(high));
		exponent++
	) {
		for (const mantissa of mantissas) {
			// toPrecision drops float noise: 3 × 10⁻³ is 0.003, not 0.0030000000000000005.
			const value = Number((mantissa * 10 ** exponent).toPrecision(12));
			if (value >= low && value <= high) values.push(value);
		}
	}
	return values;
}
