import { describe, expect, it } from "vite-plus/test";
import type { TimedPoint } from "#/domain/tradeoffs";
import { plotSpace, SCORE_HEIGHT } from "./plotSpace";

function point(cost: number, seconds: number, score: number): TimedPoint {
	// SAFETY: the plot space reads only the three measures.
	return {
		costPerTaskUsd: cost,
		secondsPerTask: seconds,
		score,
	} as TimedPoint;
}

const values = (ticks: { value: number }[]) => ticks.map((t) => t.value);

function insideCube([x, y, z]: readonly number[]) {
	return x >= -1 && x <= 1 && y >= -1 && y <= 1 && z >= 0 && z <= SCORE_HEIGHT;
}

describe("plotSpace", () => {
	const cheapQuick = point(0.001, 60, 10);
	const priceySlow = point(1, 1800, 45);
	const space = plotSpace([cheapQuick, priceySlow]);

	it("places every point inside the cube, off the cost axis's ends", () => {
		const a = space.position(cheapQuick);
		const b = space.position(priceySlow);
		expect(insideCube(a) && insideCube(b)).toBe(true);
		expect(a[1]).toBeGreaterThan(-1);
		expect(b[1]).toBeLessThan(1);
	});

	it("moves a pricier, slower, smarter point further along each axis", () => {
		const [ax, ay, az] = space.position(cheapQuick);
		const [bx, by, bz] = space.position(priceySlow);
		expect(bx).toBeGreaterThan(ax);
		expect(by).toBeGreaterThan(ay);
		expect(bz).toBeGreaterThan(az);
	});

	it("starts time and score at zero, so heights compare honestly", () => {
		const zero = plotSpace([point(0.01, 0, 0), point(0.1, 600, 50)]);
		const [x, , z] = zero.position(point(0.01, 0, 0));
		expect(x).toBe(-1);
		expect(z).toBe(0);
	});

	it("ticks time in whole minutes from the origin to the axis's end", () => {
		const minutes = space.ticks.minutes;
		expect(values(minutes)).toEqual([0, 5, 10, 15, 20, 25, 30]);
		expect(minutes[0].at).toBe(0);
		expect(minutes[minutes.length - 1].at).toBe(2);
	});

	it("ticks score up to the axis's top", () => {
		const score = space.ticks.score;
		expect(values(score)).toEqual([0, 10, 20, 30, 40, 50]);
		expect(score[score.length - 1].at).toBeCloseTo(SCORE_HEIGHT);
	});

	it("thins cost ticks to decades across a wide range", () => {
		expect(values(space.ticks.cost)).toEqual([0.001, 0.01, 0.1, 1]);
		for (const tick of space.ticks.cost) {
			expect(tick.at).toBeGreaterThanOrEqual(0);
			expect(tick.at).toBeLessThanOrEqual(2);
		}
	});

	it("ticks a middling cost range at 1-3 steps", () => {
		const middling = plotSpace([point(0.01, 60, 10), point(1, 120, 20)]);
		expect(values(middling.ticks.cost)).toEqual([0.01, 0.03, 0.1, 0.3, 1]);
	});

	it("ticks a narrow cost range at 1-2-5 steps", () => {
		const narrow = plotSpace([point(0.02, 60, 10), point(0.05, 120, 20)]);
		expect(values(narrow.ticks.cost)).toEqual([0.02, 0.05]);
	});

	it("keeps a lone point with no time or score inside the cube", () => {
		const lone = point(0.5, 0, 0);
		const position = plotSpace([lone]).position(lone);
		expect(position.every(Number.isFinite)).toBe(true);
		expect(insideCube(position)).toBe(true);
	});
});
