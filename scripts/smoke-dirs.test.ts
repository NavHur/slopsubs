import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

	it("sees the same directory through a symlink", () => {
		const root = mkdtempSync(join(tmpdir(), "smoke-dirs-"));
		try {
			const baseline = join(root, "baseline");
			const alias = join(root, "alias");
			mkdirSync(baseline);
			symlinkSync(baseline, alias);
			expect(() => baselineDirectory(alias, baseline)).toThrow(
				/overwrite its baseline/,
			);
			expect(() => baselineDirectory(baseline, alias)).toThrow(
				/overwrite its baseline/,
			);
		} finally {
			rmSync(root, { recursive: true });
		}
	});

	it("rejects an empty baseline path instead of skipping the comparison", () => {
		expect(() => baselineDirectory("/tmp/new", "")).toThrow(
			/baseline directory/,
		);
	});
});
