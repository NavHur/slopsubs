import { readFileSync } from "node:fs";
import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { compareTexts } from "./data-snapshot.ts";

const read = (file: string) =>
	readFileSync(new URL(`../src/data/${file}`, import.meta.url), "utf8");
const texts = {
	benchmarks: read("benchmarks.json"),
	aaEvals: read("aa-evals.json"),
	frontierCode: read("frontiercode.json"),
	chart: read("chart-benchmarks.json"),
	plans: read("plans.json"),
	samples: read("samples.json"),
};
const compare = (base: typeof texts, current: typeof texts) =>
	Effect.runPromise(compareTexts("origin/main", base, current));

describe("comparing data snapshots", () => {
	it("finds no changes between identical copies", async () => {
		await expect(compare(texts, texts)).resolves.toEqual({
			familiesAdded: [],
			familiesRemoved: [],
			scores: [],
			prices: [],
			planValues: [],
			changedFiles: [],
			refetchedFiles: [],
		});
	});
	it("names the git ref when its copy of a file fails to decode", async () => {
		await expect(
			compare({ ...texts, plans: "[{}]" }, texts),
		).rejects.toHaveProperty("path", "origin/main:src/data/plans.json");
	});
	it("names the working tree path when its copy fails to decode", async () => {
		await expect(
			compare(texts, { ...texts, plans: "[{}]" }),
		).rejects.toHaveProperty("path", "src/data/plans.json");
	});
});
