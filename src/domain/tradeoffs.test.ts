import { describe, expect, it } from "vite-plus/test";
import { type TimedPoint, timedPoints, tradeoffFrontier } from "./tradeoffs";
import type { ValuePoint } from "./value";

function valuePoint(
	id: string,
	cost: number,
	seconds: number | null,
	score: number,
): ValuePoint {
	// SAFETY: the trade-off code reads only these fields and identity.
	return {
		seriesId: id,
		score,
		costPerTaskUsd: cost,
		benchmark: { secondsPerTask: seconds },
	} as ValuePoint;
}

function timed(
	id: string,
	cost: number,
	seconds: number,
	score: number,
): TimedPoint {
	return { ...valuePoint(id, cost, seconds, score), secondsPerTask: seconds };
}

const ids = (points: Iterable<TimedPoint>) =>
	[...points].map((p) => p.seriesId);

describe("timedPoints", () => {
	it("keeps the points a benchmark timed, carrying their time", () => {
		const points = [
			valuePoint("timed", 0.1, 120, 40),
			valuePoint("untimed", 0.1, null, 40),
		];
		expect(
			timedPoints(points).map((p) => [p.seriesId, p.secondsPerTask]),
		).toEqual([["timed", 120]]);
	});
});

describe("tradeoffFrontier", () => {
	it("keeps each point that wins on some measure, drops a dominated one", () => {
		const cheap = timed("cheap", 1, 100, 50);
		const fast = timed("fast", 2, 50, 55);
		const smart = timed("smart", 3, 80, 70);
		const dominated = timed("dominated", 3, 100, 50);
		expect(ids(tradeoffFrontier([cheap, fast, smart, dominated]))).toEqual([
			"cheap",
			"fast",
			"smart",
		]);
	});

	it("drops a point another matches on two measures and beats on one", () => {
		const slower = timed("slower", 1, 200, 50);
		const faster = timed("faster", 1, 100, 50);
		expect(ids(tradeoffFrontier([slower, faster]))).toEqual(["faster"]);
	});

	it("keeps identical points, since neither beats the other", () => {
		const first = timed("first", 1, 50, 60);
		const second = timed("second", 1, 50, 60);
		expect(ids(tradeoffFrontier([first, second]))).toEqual(["first", "second"]);
	});
});
