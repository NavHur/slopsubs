import { mkdirSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { TextFiles } from "./effects/files.ts";
import { baselineDirectory as baselineDirectoryEffect } from "./smoke-dirs.ts";

const baselineDirectory = (
	...args: Parameters<typeof baselineDirectoryEffect>
) =>
	Effect.runPromise(
		baselineDirectoryEffect(...args).pipe(Effect.provide(TextFiles.layer)),
	);

describe("baselineDirectory", () => {
	it("records a baseline when nothing is compared", async () => {
		await expect(
			baselineDirectory("/tmp/slopsubs-smoke", undefined),
		).resolves.toBeUndefined();
	});

	it("compares against a different directory", async () => {
		await expect(baselineDirectory("/tmp/new", "/tmp/baseline")).resolves.toBe(
			"/tmp/baseline",
		);
	});

	it("refuses to compare against the output directory", async () => {
		await expect(
			baselineDirectory("/tmp/slopsubs-smoke", "/tmp/slopsubs-smoke"),
		).rejects.toThrow(/overwrite its baseline/);
	});

	it("sees the same directory through a trailing slash or dot segments", async () => {
		await expect(
			baselineDirectory("/tmp/slopsubs-smoke", "/tmp/x/../slopsubs-smoke/"),
		).rejects.toThrow(/overwrite its baseline/);
	});

	it("sees the same directory through a symlink", async () => {
		const root = mkdtempSync(join(tmpdir(), "smoke-dirs-"));
		try {
			const baseline = join(root, "baseline");
			const alias = join(root, "alias");
			mkdirSync(baseline);
			symlinkSync(baseline, alias);
			await expect(baselineDirectory(alias, baseline)).rejects.toThrow(
				/overwrite its baseline/,
			);
			await expect(baselineDirectory(baseline, alias)).rejects.toThrow(
				/overwrite its baseline/,
			);
		} finally {
			rmSync(root, { recursive: true });
		}
	});

	it("rejects an empty baseline path instead of skipping the comparison", async () => {
		await expect(baselineDirectory("/tmp/new", "")).rejects.toThrow(
			/baseline directory/,
		);
	});
});
