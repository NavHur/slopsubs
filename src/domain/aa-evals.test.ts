import { describe, expect, it } from "vite-plus/test";
import {
	extractEvals,
	flightFromHtml,
	pickModel,
	resolveRows,
} from "./aa-evals";
import type { BenchmarkPoint } from "./model";

type Fixture = {
	release: string;
	effort?: string;
	reasons?: boolean;
	score: number;
};

/** A model id in the payload's 36-character uuid form. */
const uuidOf = (index: number) =>
	`${String(index).padStart(8, "0")}-0000-0000-0000-000000000000`;

/** One model record as the flight payload lays it out, evals key last. */
function modelRecord(
	{ release, effort, reasons = true, score }: Fixture,
	index: number,
): string {
	const effortJson = effort ? `"effort":{"slug":"${effort}"},` : "";
	const evals = JSON.stringify([
		{ slug: "omniscience", score, costPerTask: 1.234567 },
		{ slug: "not-a-chart-eval", score: 1 },
	]);
	return (
		`{"id":"${uuidOf(index)}","slug":"${release}","name":"x","isReasoning":${reasons},${effortJson}"release":{"slug":"${release}"},` +
		`"intelligenceIndexEvaluations":${evals}}`
	);
}

/** An HTML page whose single push chunk carries the given model records. */
function pageOf(records: Fixture[]): string {
	const flight = `[${records.map(modelRecord).join(",")}]`;
	return `<script>self.__next_f.push([1,${JSON.stringify(flight)}])</script>`;
}

const rowsOf = (records: Fixture[]) =>
	extractEvals(flightFromHtml(pageOf(records)));

describe("extractEvals", () => {
	it("keeps an effortless model's effort null instead of the previous model's", () => {
		const rows = rowsOf([
			{ release: "alpha", effort: "high", score: 0.5 },
			{ release: "beta", score: 0.4 },
		]);
		expect(rows.map((r) => [r.family, r.effort])).toEqual([
			["alpha", "high"],
			["beta", null],
		]);
	});

	it("reads an effortless model that does not reason as effort none", () => {
		const [row] = rowsOf([{ release: "beta", reasons: false, score: 0.4 }]);
		expect(row.effort).toBe("none");
	});

	it("reads a model's own effort and rounds its cost", () => {
		const [row] = rowsOf([{ release: "alpha", effort: "low", score: 0.5 }]);
		expect(row).toEqual({
			family: "alpha",
			effort: "low",
			eval: "omniscience",
			score: 0.5,
			costPerTaskUsd: 1.23457,
			tokensPerTask: null,
			secondsPerTask: null,
		});
	});
});

function catalogModel(family: string, effort: string): BenchmarkPoint {
	return { family, effort } as BenchmarkPoint;
}

const row = (family: string, effort: string | null) => ({
	family,
	effort,
	eval: "omniscience" as const,
	score: 0.5,
	costPerTaskUsd: null,
	tokensPerTask: null,
	secondsPerTask: null,
});

describe("pickModel", () => {
	it("files an effortless row under the family's only model", () => {
		const only = catalogModel("beta", "default");
		expect(pickModel([only], null, "beta")).toBe(only);
	});

	it("skips a named effort a multi-variant family lacks", () => {
		const models = [catalogModel("beta", "low"), catalogModel("beta", "high")];
		expect(pickModel(models, "max", "beta")).toBeNull();
	});

	it("skips a reasoning model whose family has only a non-reasoning model", () => {
		expect(pickModel([catalogModel("beta", "none")], null, "beta")).toBeNull();
	});

	it("throws when a null effort fits several models and no fallback", () => {
		const models = [catalogModel("beta", "low"), catalogModel("beta", "high")];
		expect(() => pickModel(models, null, "beta")).toThrow(
			/Ambiguous null effort for beta/,
		);
	});
});

describe("resolveRows", () => {
	const byFamily = new Map([["beta", [catalogModel("beta", "default")]]]);

	it("files the effortless model under its catalog effort end to end", () => {
		const raw = rowsOf([
			{ release: "alpha", effort: "high", score: 0.5 },
			{ release: "beta", score: 0.4 },
		]);
		const { rows, skips } = resolveRows(raw, byFamily);
		expect(rows.map((r) => [r.family, r.effort])).toEqual([
			["beta", "default"],
		]);
		expect([...skips.families]).toEqual(["alpha"]);
	});

	it("files the website's one named effort under a sole default, logged", () => {
		const { rows, skips } = resolveRows([row("beta", "xhigh")], byFamily);
		expect(rows.map((r) => r.effort)).toEqual(["default"]);
		expect([...skips.mappedToDefault]).toEqual(["beta (xhigh)"]);
	});

	it("skips a sole default family the website lists at two efforts", () => {
		const raw = [row("beta", "medium"), row("beta", "high")];
		const { rows, skips } = resolveRows(raw, byFamily);
		expect(rows).toEqual([]);
		expect([...skips.efforts]).toEqual(["beta (medium)", "beta (high)"]);
	});

	it("files effortless reasoning and non-reasoning models by their mode", () => {
		const raw = rowsOf([
			{ release: "gamma", reasons: true, score: 0.5 },
			{ release: "gamma", reasons: false, score: 0.3 },
		]);
		const gamma = [
			catalogModel("gamma", "default"),
			catalogModel("gamma", "none"),
		];
		const { rows } = resolveRows(raw, new Map([["gamma", gamma]]));
		expect(rows.map((r) => [r.effort, r.score])).toEqual([
			["default", 0.5],
			["none", 0.3],
		]);
	});

	it("throws on two rows for one family, effort and eval", () => {
		expect(() =>
			resolveRows([row("beta", null), row("beta", "default")], byFamily),
		).toThrow(/Two rows for beta@default@omniscience/);
	});
});
