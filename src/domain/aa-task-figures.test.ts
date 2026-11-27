import { Effect } from "effect";
import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { importAaEvals as importAaEvalsEffect } from "./aa-task-figures";
import {
	ALPHA,
	SONNET,
	evalPageRecord,
	modelRecord,
	pageOf,
} from "./aa-test-pages";
import type { BenchmarkPoint } from "./model";

const importAaEvals = (...args: Parameters<typeof importAaEvalsEffect>) =>
	Effect.runSync(importAaEvalsEffect(...args));

const catalogOf = (...families: string[]) =>
	new Map(
		families.map((family) => [
			family,
			[{ family, effort: "max" } as BenchmarkPoint],
		]),
	);

type PriorRow = Parameters<typeof importAaEvals>[0]["prior"][number];

type Inputs = {
	models?: object[];
	evalPages?: object[][];
	prior?: PriorRow[];
};

function run({
	models = [modelRecord()],
	evalPages = [[evalPageRecord()]],
	prior = [],
}: Inputs = {}) {
	return importAaEvals({
		modelPages: [pageOf(models)],
		evalPages: evalPages.map(pageOf),
		byFamily: catalogOf(SONNET.slug, ALPHA.slug),
		prior,
	});
}

const figuresOf = (rows: ReturnType<typeof run>["rows"]) =>
	Object.fromEntries(rows.map((r) => [r.eval, r.costPerTaskUsd]));

const rowOf = (rows: ReturnType<typeof run>["rows"], evalId: string) =>
	rows.find((r) => r.eval === evalId);

describe("importAaEvals cost", () => {
	it("reads each eval's cost per task as AA's weighted cost over the eval's weight", () => {
		expect(figuresOf(run().rows)).toEqual({
			"aa-briefcase": 20.47391,
			"automationbench-aa": 1.03244,
			"terminalbench-4-1": 12.64644,
			"frontiercode-2-0": 11.55752,
			omniscience: 0.15182,
			"gdp-pdf": 0.79433,
			"hle-diamond": 0.80372,
			"critpt-v2-hard": 1.92674,
			"terminal-bench-science": 23.76071,
		});
	});
});

describe("importAaEvals tokens and time", () => {
	it("reads tokens per task from the eval page's counts over the eval's task count", () => {
		const { rows } = run();
		expect(rowOf(rows, "aa-briefcase")?.tokensPerTask).toBe(625176);
		expect(rowOf(rows, "omniscience")?.tokensPerTask).toBe(15148);
	});

	it("reads time per task as tokens over the model's output speed", () => {
		const { rows } = run();
		expect(rowOf(rows, "aa-briefcase")?.secondsPerTask).toBe(4371);
		expect(rowOf(rows, "omniscience")?.secondsPerTask).toBe(105.9);
	});

	it("reads critpt-v2-hard's tokens under AA's agentic-hard key", () => {
		expect(rowOf(run().rows, "critpt-v2-hard")?.tokensPerTask).toBe(140930);
	});
});

/** A prior dataset row, filed under Sonnet at max. */
const priorRow = (
	evalId: PriorRow["eval"],
	figures: Partial<PriorRow>,
): PriorRow => ({
	family: SONNET.slug,
	effort: "max",
	eval: evalId,
	costPerTaskUsd: 1.5,
	tokensPerTask: 1000,
	secondsPerTask: 7.5,
	...figures,
});

/** Sonnet is off the eval pages, which still chart alpha. */
const SONNET_UNCHARTED = {
	models: [modelRecord(), modelRecord({ who: ALPHA })],
	evalPages: [[evalPageRecord({ who: ALPHA })]],
};

describe("importAaEvals carry-forward", () => {
	it("keeps a variant's tokens and time as a pair when the eval pages do not chart it, with its cost fresh", () => {
		const prior = [priorRow("omniscience", {})];
		const row = rowOf(run({ ...SONNET_UNCHARTED, prior }).rows, "omniscience");
		expect([
			row?.costPerTaskUsd,
			row?.tokensPerTask,
			row?.secondsPerTask,
		]).toEqual([0.15182, 1000, 7.5]);
	});

	it("keeps only the cost when AA lists no weighted cost for an eval", () => {
		const prior = [priorRow("omniscience", { costPerTaskUsd: 0.2 })];
		const uncosted = { ...modelRecord(), intelligenceIndexCostPerTask: null };
		const models = [uncosted, modelRecord({ who: ALPHA })];
		const row = rowOf(run({ models, prior }).rows, "omniscience");
		expect([row?.costPerTaskUsd, row?.tokensPerTask]).toEqual([0.2, 15148]);
	});

	it("carries only the cost of an eval whose weighted cost AA dropped, the rest staying fresh", () => {
		const record = modelRecord();
		const costs = record.intelligenceIndexCostPerTask;
		const [omniscience] = costs.evaluations.splice(4, 1);
		expect(omniscience.slug).toBe("omniscience");
		costs.cost.total -= omniscience.weightedCostPerTask;
		const prior = [
			priorRow("omniscience", { costPerTaskUsd: 0.2 }),
			priorRow("aa-briefcase", { costPerTaskUsd: 9.9 }),
		];
		const { rows, carry } = run({ models: [record], prior });
		expect(rowOf(rows, "omniscience")?.costPerTaskUsd).toBe(0.2);
		expect(rowOf(rows, "omniscience")?.tokensPerTask).toBe(15148);
		expect(rowOf(rows, "aa-briefcase")?.costPerTaskUsd).toBe(20.47391);
		expect([carry.costFresh, carry.costCarried]).toEqual([8, 1]);
	});

	it("leaves a figure null when no earlier row had it", () => {
		const row = rowOf(run(SONNET_UNCHARTED).rows, "omniscience");
		expect([row?.tokensPerTask, row?.secondsPerTask]).toEqual([null, null]);
	});

	it("gives the same rows when run again with its own output as the prior", () => {
		const first = run(SONNET_UNCHARTED);
		const again = run({ ...SONNET_UNCHARTED, prior: first.rows });
		expect(again.rows).toEqual(first.rows);
	});
});

describe("importAaEvals carry report", () => {
	it("counts the figures read fresh, carried and missing", () => {
		const prior = [priorRow("omniscience", {})];
		const { carry } = run({ ...SONNET_UNCHARTED, prior });
		expect(carry).toEqual({
			costFresh: 18,
			costCarried: 0,
			figuresFresh: 9,
			figuresCarried: 1,
			withoutFigures: 8,
		});
	});
});

describe("importAaEvals carry report pairs", () => {
	it("counts a carried row with tokens but no time as missing its figures", () => {
		const prior = [priorRow("omniscience", { secondsPerTask: null })];
		const { carry } = run({ ...SONNET_UNCHARTED, prior });
		expect([carry.figuresCarried, carry.withoutFigures]).toEqual([0, 9]);
	});
});

describe("importAaEvals checks", () => {
	it("stops when a record's weighted costs do not add up to its index cost", () => {
		expect(() => run({ models: [modelRecord({ totalCost: 11 })] })).toThrow(
			/weighted costs for claude-sonnet-5-5/,
		);
	});

	it("stops when AA costs an eval the importer does not know", () => {
		const record = modelRecord();
		const costed: { slug: string; weightedCostPerTask: number }[] =
			record.intelligenceIndexCostPerTask.evaluations;
		costed.push({ slug: "brand-new-eval", weightedCostPerTask: 0.1 });
		expect(() => run({ models: [record] })).toThrow(/brand-new-eval/);
	});

	it("stops when the weighted tokens do not add up to the index's output tokens", () => {
		const briefcase = { answer: 38632254, reasoning: 75149736 };
		const evalPages = [[evalPageRecord({ tokenCounts: { briefcase } })]];
		expect(() => run({ evalPages })).toThrow(
			/weighted tokens per task for claude-sonnet-5-5/i,
		);
	});

	it("stops when two eval pages count one record's tokens differently", () => {
		const briefcase = { answer: 1, reasoning: 2 };
		const evalPages = [
			[evalPageRecord()],
			[evalPageRecord({ tokenCounts: { briefcase } })],
		];
		expect(() => run({ evalPages })).toThrow(/disagree on claude-sonnet-5-5/);
	});

	it("takes no rows or scores from an eval page's records", () => {
		const conflicting = { ...evalPageRecord(), omniscience: 99 };
		const evalPages = [[conflicting, evalPageRecord({ who: ALPHA })]];
		const { rows } = run({ evalPages });
		expect(new Set(rows.map((r) => r.family))).toEqual(new Set([SONNET.slug]));
		expect(rowOf(rows, "omniscience")?.score).toBe(SONNET.scores.omniscience);
	});

	it("stops when AA's costs are negative, though they add up", () => {
		const weightedCosts = [...SONNET.weightedCosts];
		weightedCosts[0] = -1;
		const totalCost = weightedCosts.reduce((sum, cost) => sum + cost, 0);
		expect(() =>
			run({ models: [modelRecord({ weightedCosts, totalCost })] }),
		).toThrow();
	});

	it("stops when AA's token counts are negative", () => {
		const { answer, reasoning } = SONNET.tokenCounts.briefcase;
		const briefcase = { answer: -1, reasoning: answer + reasoning + 1 };
		const evalPages = [[evalPageRecord({ tokenCounts: { briefcase } })]];
		expect(() => run({ evalPages })).toThrow(Schema.SchemaError);
	});

	it("stops when AA's index output tokens are negative", () => {
		const record = modelRecord();
		record.intelligenceIndexOutputTokensPerTask.output = -1;
		expect(() => run({ models: [record] })).toThrow(Schema.SchemaError);
	});

	it("stops when AA's index time makes the output speed overflow", () => {
		const record = modelRecord();
		record.intelligenceIndexTimePerTask = 5e-324;
		expect(() => run({ models: [record] })).toThrow(/not usable/);
	});

	it("stops when AA's index time makes the output speed underflow", () => {
		const record = modelRecord();
		record.intelligenceIndexOutputTokensPerTask.output = Number.MIN_VALUE;
		record.intelligenceIndexTimePerTask = Number.MAX_VALUE;
		expect(() => run({ models: [record] })).toThrow(/not usable/);
	});

	it("stops when AA's index time per task is negative", () => {
		const record = modelRecord();
		record.intelligenceIndexTimePerTask = -1;
		expect(() => run({ models: [record] })).toThrow(Schema.SchemaError);
	});

	it("stops when two eval pages split one eval's tokens differently, though they sum alike", () => {
		const { answer, reasoning } = SONNET.tokenCounts.briefcase;
		const briefcase = { answer: answer + 1, reasoning: reasoning - 1 };
		const evalPages = [
			[evalPageRecord()],
			[evalPageRecord({ tokenCounts: { briefcase } })],
		];
		expect(() => run({ evalPages })).toThrow(/disagree on claude-sonnet-5-5/);
	});

	it("stops when AA costs one eval twice, though the costs add up", () => {
		const record = modelRecord();
		const costs = record.intelligenceIndexCostPerTask;
		costs.evaluations.push({ ...costs.evaluations[0] });
		costs.cost.total += costs.evaluations[0].weightedCostPerTask;
		expect(() => run({ models: [record] })).toThrow(
			/costs aa-briefcase twice for claude-sonnet-5-5/,
		);
	});

	it("reads two eval pages' equal counts alike whatever order their keys come in", () => {
		const reversed = Object.fromEntries(
			Object.entries(SONNET.tokenCounts)
				.reverse()
				.map(([key, { answer, reasoning }]) => [key, { reasoning, answer }]),
		);
		const evalPages = [
			[evalPageRecord()],
			[{ ...evalPageRecord(), canonicalEvalTokenCounts: reversed }],
		];
		expect(run({ evalPages }).rows).toHaveLength(9);
	});

	it("stops when two records for one model differ in id", () => {
		const twin = modelRecord({ who: { ...SONNET, id: ALPHA.id } });
		expect(() => run({ models: [modelRecord(), twin] })).toThrow(
			/disagree on claude-sonnet-5-5/,
		);
	});

	it("stops when two records for one model differ in output speed", () => {
		const slower = { ...modelRecord(), intelligenceIndexTimePerTask: 4000 };
		expect(() => run({ models: [modelRecord(), slower] })).toThrow(
			/disagree on claude-sonnet-5-5/,
		);
	});

	it("stops when two records for one model differ in index output tokens", () => {
		const twin = {
			...modelRecord(),
			intelligenceIndexOutputTokensPerTask: { output: 1 },
		};
		expect(() => run({ models: [modelRecord(), twin] })).toThrow(
			/disagree on claude-sonnet-5-5/,
		);
	});
});

describe("importAaEvals guards", () => {
	it("stops when no row has a fresh cost", () => {
		const models = [{ ...modelRecord(), intelligenceIndexCostPerTask: null }];
		expect(() => run({ models })).toThrow(/no fresh cost/i);
	});

	it("stops when no row has fresh tokens", () => {
		expect(() => run({ evalPages: [[]] })).toThrow(/no fresh tokens/i);
	});

	it("stops when no model page row matches the catalog", () => {
		const models = [modelRecord({ who: { ...ALPHA, slug: "unlisted" } })];
		expect(() => run({ models })).toThrow(/No eval rows matched the catalog/);
	});
});

describe("importAaEvals empty pages", () => {
	it("stops when the model pages carry no records", () => {
		expect(() => run({ models: [] })).toThrow(/No eval rows extracted/);
	});
});
