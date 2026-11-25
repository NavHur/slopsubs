import { describe, expect, it } from "vite-plus/test";
import plansJson from "../src/data/plans.json";

const PRO_WEEKLY_CAP_USD = (23 * 19.99) / (52 / 12);

describe("the shipped Google AI Pro plans", () => {
	it.each([
		["google-ai-pro", 19.99],
		["google-ai-pro-deal-4-99", 4.99],
		["google-ai-pro-deal-9-99", 9.99],
		["google-ai-pro-annual", 8.25],
	])("%s costs $%s a month with Pro's 23x $19.99 cap", (id, price) => {
		const plan = plansJson.find((p) => p.id === id);
		expect(plan?.monthlyPriceUsd).toBe(price);
		const caps = Object.values(
			plan?.reportedCap?.weeklyCapApiUsdByFamily ?? {},
		);
		expect(caps).toHaveLength(6);
		for (const cap of caps) expect(cap).toBeCloseTo(PRO_WEEKLY_CAP_USD, 6);
	});
});
