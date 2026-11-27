import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";
import type { FamilyId } from "../src/domain/model.ts";
import { CLAUDE_TIMES_PRO, CLAUDE_ULTRA } from "./claude-caps.ts";
import { scaledCap as scaledCapEffect } from "./tier-ladder.ts";

const scaledCap = (...args: Parameters<typeof scaledCapEffect>) =>
	Effect.runSync(scaledCapEffect(...args));

const DAYS_PER_WEEK = 7;
const THEO_MONTH_DAYS = 30;
const FABLE_SHARE = 0.5;

describe("CLAUDE_ULTRA", () => {
	const caps = CLAUDE_ULTRA.cap.weeklyCapApiUsdByFamily;

	it("gives Ultra Theo's measured week of Opus", () => {
		expect(caps["claude-opus-5-5"]).toBe(3421);
	});

	it("gives Fable a full-gauge cap whose half share is Theo's month of it", () => {
		const fableMonth =
			(caps["claude-fable-5-2"] * FABLE_SHARE * THEO_MONTH_DAYS) /
			DAYS_PER_WEEK;
		expect(fableMonth).toBeCloseTo(3021);
	});

	it("scales to Max by the pricing page's 5x Pro", () => {
		const max = scaledCap(
			CLAUDE_ULTRA,
			{ label: "Claude Max", times: CLAUDE_TIMES_PRO.max },
			["claude-fable-5-2"],
		);
		expect(
			max.weeklyCapApiUsdByFamily["claude-fable-5-2" as FamilyId],
		).toBeCloseTo(caps["claude-fable-5-2"] / 2);
	});
});
