import { describe, expect, it } from "vite-plus/test";
import { baselineDirectory } from "./smoke-dirs.ts";

describe("baselineDirectory", () => {
	it("records a baseline when nothing is compared", () => {
		expect(baselineDirectory("/tmp/slopsubs-smoke", undefined)).toBeUndefined();
	});

	it("compares against a different directory", () => {
		expect(baselineDirectory("/tmp/new", "/tmp/baseline")).toBe(
			"/tmp/baseline",
		);
	});

	it("refuses to compare against the output directory", () => {
		expect(() =>
			baselineDirectory("/tmp/slopsubs-smoke", "/tmp/slopsubs-smoke"),
		).toThrow(/overwrite its baseline/);
	});

	it("sees the same directory through a trailing slash or dot segments", () => {
		expect(() =>
			baselineDirectory("/tmp/slopsubs-smoke", "/tmp/x/../slopsubs-smoke/"),
		).toThrow(/overwrite its baseline/);
	});
});
