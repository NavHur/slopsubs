import { describe, expect, it } from "vite-plus/test";
import { nothingToPlot, nothingToRank } from "./emptyChart";

describe("nothingToRank", () => {
	it("asks for a plan and does not offer the API toggle as a fix", () => {
		const text = nothingToRank();
		expect(text).toMatch(/select a plan/i);
		expect(text).not.toMatch(/API/i);
	});
});

describe("nothingToPlot", () => {
	it("tells a visitor with no plan checked to check one", () => {
		expect(nothingToPlot(false)).toContain("Check a plan");
	});

	it("tells a visitor with a plan checked to pick a model", () => {
		expect(nothingToPlot(true)).toContain("Pick a model");
	});
});
