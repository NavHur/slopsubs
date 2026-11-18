import { describe, expect, it } from "vite-plus/test";
import { nothingToPlot, nothingToRank } from "./emptyChart";

describe("nothingToRank", () => {
	it("asks a visitor with no plan checked for a plan, without offering API prices", () => {
		const text = nothingToRank(false);
		expect(text).toMatch(/select a plan/i);
		expect(text).not.toMatch(/API/i);
	});

	it("tells a visitor with a plan checked to pick a model, not to select a plan", () => {
		const text = nothingToRank(true);
		expect(text).not.toMatch(/select a plan/i);
		expect(text).toContain("Pick a model");
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
