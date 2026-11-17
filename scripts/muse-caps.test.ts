import { describe, expect, it } from "vite-plus/test";
import { OUR_GAUGE_READINGS } from "../src/domain/enums.ts";
import type { FamilyId } from "../src/domain/model.ts";
import { MUSE_EVERYDAY, MUSE_TIMES_EVERYDAY } from "./muse-caps.ts";
import { scaledCap } from "./tier-ladder.ts";

const FAMILIES = ["muse-wonder", "muse-spark-1-3", "muse-ember"] as const;

describe("MUSE_EVERYDAY", () => {
	const caps = MUSE_EVERYDAY.cap.weeklyCapApiUsdByFamily;

	it("is a reading off our own gauge", () => {
		expect(MUSE_EVERYDAY.cap.by).toBe(OUR_GAUGE_READINGS);
	});

	it.each([
		["muse-wonder", 16],
		["muse-spark-1-3", 75],
		["muse-ember", 4],
	])("caps a week of %s at $%d of list price", (family, usd) => {
		expect(caps[family]).toBeCloseTo(usd);
	});

	it.each([
		["high", MUSE_TIMES_EVERYDAY.high, [80, 375, 20]],
		["power", MUSE_TIMES_EVERYDAY.power, [320, 1500, 80]],
		["maximum", MUSE_TIMES_EVERYDAY.maximum, [1280, 6000, 320]],
	])("scales to %s by the vendor's multiple", (label, times, expected) => {
		const scaled = scaledCap(MUSE_EVERYDAY, { label, times }, FAMILIES);
		const actual = FAMILIES.map(
			(family) => scaled.weeklyCapApiUsdByFamily[family as FamilyId],
		);
		expect(actual).toHaveLength(expected.length);
		actual.forEach((usd, i) => expect(usd).toBeCloseTo(expected[i]));
	});
});
