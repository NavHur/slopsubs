import { readFileSync } from "node:fs";
import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { SUPERSEDED_AA_EVAL } from "../src/domain/enums.ts";
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
	describe("when the base predates the Terminal-Bench 4.1 rename", () => {
		const { id, successor } = SUPERSEDED_AA_EVAL;
		const asBefore = (text: string) =>
			text.replaceAll(`"${successor}"`, `"${id}"`);
		const base = {
			...texts,
			aaEvals: asBefore(texts.aaEvals),
			chart: asBefore(texts.chart),
		};

		it("decodes the base and counts the renamed files as changed", async () => {
			await expect(compare(base, texts)).resolves.toEqual({
				familiesAdded: [],
				familiesRemoved: [],
				scores: [],
				prices: [],
				planValues: [],
				changedFiles: ["aa-evals.json", "chart-benchmarks.json"],
				refetchedFiles: [],
			});
		});
		it("still reports a score that changed since the base", async () => {
			const rescored = JSON.parse(texts.chart);
			rescored.leaderboards[successor].models[0].score += 10;
			const changes = await compare(base, {
				...texts,
				chart: JSON.stringify(rescored),
			});
			expect(changes.scores).toHaveLength(1);
			expect(changes.scores[0]).toMatchObject({ benchmark: successor });
			expect(changes.changedFiles).toEqual([
				"aa-evals.json",
				"chart-benchmarks.json",
			]);
		});
		it("keeps the current copy strict about the superseded id", async () => {
			await expect(compare(texts, base)).rejects.toHaveProperty(
				"path",
				"src/data/aa-evals.json",
			);
		});
	});
});
