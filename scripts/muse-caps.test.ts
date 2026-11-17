import { describe, expect, it } from "vite-plus/test";
import plansJson from "../src/data/plans.json";
import { OUR_GAUGE_READINGS } from "../src/domain/enums.ts";
import { MUSE_EVERYDAY } from "./muse-caps.ts";

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
});

describe("the shipped Muse Code plans", () => {
	const FAMILIES = ["muse-wonder", "muse-spark-1-3", "muse-ember"];

	it.each([
		["muse-code-everyday", "Everyday's", [16, 75, 4]],
		["muse-code-high", "5x Everyday's", [80, 375, 20]],
		["muse-code-power", "20x Everyday's", [320, 1500, 80]],
		["muse-code-maximum", "80x Everyday's", [1280, 6000, 320]],
	])("%s: weekly caps are %s", (id, _multiple, expected) => {
		const caps = plansJson.find((p) => p.id === id)?.reportedCap
			?.weeklyCapApiUsdByFamily;
		expect(caps).toBeDefined();
		FAMILIES.forEach((family, i) =>
			expect(caps?.[family as keyof typeof caps]).toBeCloseTo(expected[i]),
		);
	});
});
