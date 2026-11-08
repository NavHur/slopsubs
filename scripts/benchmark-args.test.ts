import { describe, expect, it } from "vite-plus/test";
import { parseArgs } from "./benchmark-args.ts";

describe("benchmark arguments", () => {
	it("defaults to live sources and strict costs and scores", () => {
		expect(parseArgs([])).toEqual({
			allowMissingCost: false,
			allowScoreDrift: false,
		});
	});
	it("reads cached sources and independent opt-ins in any order", () => {
		expect(
			parseArgs([
				"--allow-score-drift",
				"--html",
				"page",
				"--bundle",
				"bundle",
				"--allow-missing-cost",
			]),
		).toEqual({
			bundle: "bundle",
			html: "page",
			allowMissingCost: true,
			allowScoreDrift: true,
		});
	});
	it("keeps the last repeated path and consumes flag-like values as paths", () => {
		expect(parseArgs(["--bundle", "first", "--bundle", "--html"])).toEqual({
			bundle: "--html",
			allowMissingCost: false,
			allowScoreDrift: false,
		});
	});
	it("leaves a missing path undefined", () => {
		expect(parseArgs(["--html"]).html).toBeUndefined();
	});
	it("rejects an unknown argument with its name", () => {
		expect(() => parseArgs(["--wat"])).toThrow("Unknown argument --wat");
	});
});
