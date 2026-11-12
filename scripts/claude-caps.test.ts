import { describe, expect, it } from "vite-plus/test";
import type { FamilyId } from "../src/domain/model.ts";
import { claudeCap } from "./claude-caps.ts";

const DAYS_PER_WEEK = 7;
const THEO_MONTH_DAYS = 30;
const FABLE_SHARE = 0.5;

describe("claudeCap", () => {
	const opus = "claude-opus-5-5" as FamilyId;
	const fable = "claude-fable-5-2" as FamilyId;
	const caps = claudeCap(200, [opus, fable]).weeklyCapApiUsdByFamily;

	it("gives Ultra Theo's measured week of Opus", () => {
		expect(caps[opus]).toBe(3421);
	});

	it("gives Fable a full-gauge cap whose half share is Theo's month of it", () => {
		const fableMonth =
			(caps[fable] * FABLE_SHARE * THEO_MONTH_DAYS) / DAYS_PER_WEEK;
		expect(fableMonth).toBeCloseTo(3021);
	});

	it("scales Ultra's figures to Max by price", () => {
		const max = claudeCap(100, [opus, fable]);
		expect(max.weeklyCapApiUsdByFamily[fable]).toBeCloseTo(caps[fable] / 2);
	});

	it("refuses a model Theo has no figure for", () => {
		expect(() => claudeCap(200, ["claude-fable-5-1"])).toThrow(
			/claude-fable-5-1/,
		);
	});
});
