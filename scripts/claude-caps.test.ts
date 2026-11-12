import { describe, expect, it } from "vite-plus/test";
import { claudeCap } from "./claude-caps.ts";

const DAYS_PER_WEEK = 7;
const THEO_MONTH_DAYS = 30;
const FABLE_SHARE = 0.5;

describe("claudeCap", () => {
	const ultra = claudeCap(200, ["claude-opus-5-5", "claude-fable-5-2"]);
	const caps = ultra.weeklyCapApiUsdByFamily;

	it("gives Ultra Theo's measured week of Opus", () => {
		expect(caps["claude-opus-5-5"]).toBe(3421);
	});

	it("gives Fable a full-gauge cap whose half share is Theo's month of it", () => {
		const fableMonth =
			(caps["claude-fable-5-2"] * FABLE_SHARE * THEO_MONTH_DAYS) /
			DAYS_PER_WEEK;
		expect(fableMonth).toBeCloseTo(3021);
	});

	it("scales Ultra's figures to Max by price", () => {
		const max = claudeCap(100, ["claude-opus-5-5", "claude-fable-5-2"]);
		expect(max.weeklyCapApiUsdByFamily["claude-fable-5-2"]).toBeCloseTo(
			caps["claude-fable-5-2"] / 2,
		);
	});

	it("refuses a model Theo has no figure for", () => {
		expect(() => claudeCap(200, ["claude-fable-5-1"])).toThrow(
			/claude-fable-5-1/,
		);
	});
});
