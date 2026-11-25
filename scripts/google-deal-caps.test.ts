import { describe, expect, it } from "vite-plus/test";
import plansJson from "../src/data/plans.json";

describe("the shipped Google AI Pro deal plans", () => {
	const capsOf = (id: string) =>
		plansJson.find((p) => p.id === id)?.reportedCap?.weeklyCapApiUsdByFamily;
	const proCaps = capsOf("google-ai-pro");

	it("has Pro's caps to compare against", () => {
		expect(proCaps).toBeDefined();
	});

	it.each([
		"google-ai-pro-deal-4-99",
		"google-ai-pro-deal-9-99",
		"google-ai-pro-annual",
	])("%s: weekly caps are Pro's, not a multiple of its own price", (id) => {
		expect(capsOf(id)).toEqual(proCaps);
	});
});
