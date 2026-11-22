import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { parseArgs } from "./benchmark-args.ts";

const parse = (args: string[]) => Effect.runSync(parseArgs(args));

describe("benchmark arguments", () => {
	it("defaults to live sources and strict costs and scores", () => {
		expect(parse([])).toEqual({
			html: [],
			allowMissingCost: false,
			allowScoreDrift: false,
		});
	});
	it("reads cached sources and independent opt-ins in any order", () => {
		expect(
			parse([
				"--allow-score-drift",
				"--html",
				"page",
				"--html",
				"other",
				"--bundle",
				"bundle",
				"--allow-missing-cost",
			]),
		).toEqual({
			bundle: "bundle",
			html: ["page", "other"],
			allowMissingCost: true,
			allowScoreDrift: true,
		});
	});
	it("keeps the last repeated path and consumes flag-like values as paths", () => {
		expect(parse(["--bundle", "first", "--bundle", "--html"])).toEqual({
			bundle: "--html",
			html: [],
			allowMissingCost: false,
			allowScoreDrift: false,
		});
	});
	it("ignores a missing path", () => {
		expect(parse(["--html"]).html).toEqual([]);
	});
	it("rejects an unknown argument with its name", () => {
		expect(() => parse(["--wat"])).toThrow("Unknown argument --wat");
	});
});
