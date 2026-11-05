import { describe, expect, it } from "vite-plus/test";
import { median, requirePainted } from "./paint-stats.ts";

describe("median", () => {
	it("takes the middle of an odd count", () => {
		expect(median([9, 1, 5])).toBe(5);
	});

	it("averages the two middle values of an even count", () => {
		expect(median([300, 100])).toBe(200);
		expect(median([1, 2, 3, 10])).toBe(2.5);
	});
});

describe("requirePainted", () => {
	const painted = { firstPaintMs: 120, fcpMs: 130, lcpMs: 140 };

	it("accepts recorded paints", () => {
		expect(() => requirePainted("/", painted)).not.toThrow();
	});

	it("throws on a missing first paint (NaN)", () => {
		expect(() =>
			requirePainted("/", { ...painted, firstPaintMs: Number.NaN }),
		).toThrow(/firstPaintMs/);
	});

	it("throws on a missing largest paint (0)", () => {
		expect(() => requirePainted("/", { ...painted, lcpMs: 0 })).toThrow(
			/lcpMs/,
		);
	});
});
