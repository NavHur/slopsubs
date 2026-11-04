import type { ValuePoint } from "./value";

/** A plotted point whose benchmark also timed the task, so it has all three
 * measures the trade-off chart weighs: score, cost and time. */
export type TimedPoint = ValuePoint & { secondsPerTask: number };

/** Keeps the points whose benchmark timed the task. */
export function timedPoints(points: readonly ValuePoint[]): TimedPoint[] {
	return points.flatMap((point) => {
		const seconds = point.benchmark.secondsPerTask;
		return seconds === null ? [] : [{ ...point, secondsPerTask: seconds }];
	});
}

/** Whether `a` is at least as good as `b` on every measure: as cheap, as
 * fast and as smart. */
function noWorse(a: TimedPoint, b: TimedPoint): boolean {
	return (
		a.costPerTaskUsd <= b.costPerTaskUsd &&
		a.secondsPerTask <= b.secondsPerTask &&
		a.score >= b.score
	);
}

/** Whether `a` beats `b` on at least one measure. */
function betterSomewhere(a: TimedPoint, b: TimedPoint): boolean {
	return (
		a.costPerTaskUsd < b.costPerTaskUsd ||
		a.secondsPerTask < b.secondsPerTask ||
		a.score > b.score
	);
}

/** `a` dominates `b`: no worse on any measure and better on one. */
function dominates(a: TimedPoint, b: TimedPoint): boolean {
	return noWorse(a, b) && betterSomewhere(a, b);
}

/**
 * The points no other point dominates on cost, time and score together: the
 * options worth weighing. Identical points both stay, since neither beats the
 * other. Quadratic, which suits a chart of at most a few hundred points.
 */
export function tradeoffFrontier(
	points: readonly TimedPoint[],
): Set<TimedPoint> {
	return new Set(
		points.filter(
			(candidate) => !points.some((other) => dominates(other, candidate)),
		),
	);
}
