import { describe, expect, it } from "vite-plus/test";
import type { TimedPoint } from "#/domain/tradeoffs";
import { MIN_COST_TICK_GAP, plotSpace, SCORE_HEIGHT } from "./plotSpace";

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

	describe("free ($0) options", () => {
		const free = point(0, 202, 6.2);
		const paid = point(1.5, 100, 20);

		it("plots a $0 option at the cheap edge with finite positions", () => {
			const freeSpace = plotSpace([free, paid]);
			const at = freeSpace.position(free);
			expect(at.every(Number.isFinite)).toBe(true);
			expect(at[1]).toBe(-1);
			expect(freeSpace.position(paid).every(Number.isFinite)).toBe(true);
			expect(values(freeSpace.ticks.cost).every(Number.isFinite)).toBe(true);
			expect(freeSpace.ticks.cost.length).toBeGreaterThan(0);
		});

		it("keeps the $0 option below every paid option on the cost axis", () => {
			const freeSpace = plotSpace([free, paid, point(0.2, 60, 10)]);
			const costY = (p: TimedPoint) => freeSpace.position(p)[1];
			expect(costY(free)).toBeLessThan(costY(point(0.2, 60, 10)));
			expect(costY(point(0.2, 60, 10))).toBeLessThan(costY(paid));
		});

		it("maps a set of only $0 options to finite positions and ticks", () => {
			const onlyFree = [point(0, 30, 5), point(0, 90, 15)] as const;
			const freeSpace = plotSpace(onlyFree);
			for (const p of onlyFree) {
				const at = freeSpace.position(p);
				expect(at.every(Number.isFinite)).toBe(true);
				expect(at[1]).toBe(-1);
			}
			expect(values(freeSpace.ticks.cost).every(Number.isFinite)).toBe(true);
		});

		it("labels the cheap edge $0 first, then only clear positive ticks", () => {
			const [zero, ...rest] = plotSpace([free, paid]).ticks.cost;
			expect(zero).toEqual({ value: 0, at: 0 });
			expect(rest.length).toBeGreaterThan(0);
			expect(values(rest)).toEqual([...values(rest)].sort((a, b) => a - b));
			expect(rest.map((t) => t.value).every((v) => v > 0)).toBe(true);
			expect(rest.map((t) => t.at).every((at) => at >= MIN_COST_TICK_GAP)).toBe(
				true,
			);
		});

		it("labels only $0 when every option is free", () => {
			const onlyFree = [point(0, 30, 5), point(0, 90, 15)] as const;
			expect(plotSpace(onlyFree).ticks.cost).toEqual([{ value: 0, at: 0 }]);
		});

		it("drops a positive tick that would crowd the $0 label", () => {
			const crowded = point(0.07, 60, 10);
			const ticks = plotSpace([free, crowded, paid]).ticks.cost;
			expect(values(ticks)).not.toContain(0.05);
			expect(ticks.slice(1).every((t) => t.at >= MIN_COST_TICK_GAP)).toBe(true);
			// Without a free option the same tick is kept.
			expect(values(plotSpace([crowded, paid]).ticks.cost)).toContain(0.05);
		});
	});

	it("keeps a lone point with no time or score inside the cube", () => {
		const lone = point(0.5, 0, 0);
		const position = plotSpace([lone]).position(lone);
		expect(position.every(Number.isFinite)).toBe(true);
		expect(insideCube(position)).toBe(true);
	});
});
