import { describe, expect, it } from "vite-plus/test";
import { rangeLayout, rangeScale, rangeTicks } from "./rangeGeometry";

describe("rangeLayout", () => {
	it("stacks label and value above the track on phones", () => {
		expect(rangeLayout(390)).toMatchObject({ compact: true, trackWidth: 390 });
	});

	it("gives the track what the label and value columns leave", () => {
		expect(rangeLayout(1000)).toMatchObject({
			compact: false,
			trackWidth: 1000 - 210 - 120 - 24,
		});
	});
});

describe("rangeTicks", () => {
	it("uses 1-2-5 ticks when they fit", () => {
		expect(rangeTicks(rangeScale([10, 400], 800))).toEqual([
			10, 20, 50, 100, 200, 500,
		]);
	});

	it("thins to powers of ten on a narrow track", () => {
		expect(rangeTicks(rangeScale([1, 10_000], 300))).toEqual([
			1, 10, 100, 1000, 10_000,
		]);
	});

	it("skips powers of ten when even those crowd", () => {
		// 184px of track fits three labels across seven decades.
		expect(rangeTicks(rangeScale([1, 1_000_000], 200))).toEqual([
			1, 1000, 1_000_000,
		]);
	});

	it("keeps ticks inside a sub-dollar domain", () => {
		expect(rangeTicks(rangeScale([0.004, 0.09], 600))).toEqual([
			0.005, 0.01, 0.02, 0.05, 0.1,
		]);
	});
});
