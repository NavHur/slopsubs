import { describe, expect, it } from "vite-plus/test";
import { parseArgs, summaryLine } from "./aa-eval-cli.ts";

describe("import-aa-evals arguments", () => {
	it("reads cached model and eval pages in any order", () => {
		expect(
			parseArgs(["--eval-html", "e1", "--html", "m1", "--html", "m2"]),
		).toEqual({ html: ["m1", "m2"], evalHtml: ["e1"] });
	});
	it("defaults to live pages", () => {
		expect(parseArgs([])).toEqual({ html: [], evalHtml: [] });
	});
	it.each(["--html", "--eval-html"])(
		"names %s when its path is missing",
		(flag) => {
			expect(() => parseArgs([flag])).toThrow(`${flag} needs a file path`);
		},
	);
	it("rejects another option as a path", () => {
		expect(() => parseArgs(["--html", "--eval-html", "e1"])).toThrow(
			"--html needs a file path",
		);
		expect(() => parseArgs(["--eval-html", "--html", "m1"])).toThrow(
			"--eval-html needs a file path",
		);
	});
	it("rejects an unknown flag", () => {
		expect(() => parseArgs(["--wat"])).toThrow("Unknown argument --wat");
	});
});

const row = (family: string, effort: string) => ({ family, effort });

describe("import-aa-evals summary", () => {
	it("counts the distinct family and effort variants", () => {
		const rows = [
			row("a", "high"),
			row("a", "high"),
			row("a", "low"),
			row("b", "high"),
		];
		expect(summaryLine(rows)).toBe("Read 4 eval rows for 3 model variants");
	});
});
