import { describe, expect, it } from "vite-plus/test";
import { importAaEvals } from "./aa-task-figures";
import { AA_EVAL_IDS } from "./enums";
import type { BenchmarkPoint } from "./model";

/** Claude Sonnet 5.5 (max) as AA's pages carried it on 2026-11-20. */
const SONNET = {
	id: "b171d979-5ec1-45de-b8b9-db1ee65e77ec",
	slug: "claude-sonnet-5-5",
	scores: {
		briefcaseBreakdown: { overall: { elo: 1815.14 } },
		automationBenchPartialScore: 0.7176882128193995,
		terminalBench40: 0.636363636363636,
		frontierCode20: 0.416993434343434,
		omniscience: 30.466666666666665,
		gdpPdfAllPass: 0.258,
		hleDiamond: 0.533,
		critptAgenticHard: 0.59,
		terminalBenchScience: 0.533333333333333,
	},
	/** AA's weighted cost per task for each eval, in `AA_EVAL_IDS` order. */
	weightedCosts: [
		3.071086362898891, 0.051622199990514886, 1.2646441608317138,
		1.733627426843996, 0.022773200799999997, 0.039716396, 0.0803716788,
		0.1926741603570175, 3.5641057568736194,
	],
	totalCost: 10.020621343395753,
	outputTokensPerTask: 285387.11335048935,
	secondsPerTask: 1995.3302417810676,
	/** The record's answer and reasoning tokens for each eval, by AA's key. */
	tokenCounts: {
		briefcase: { answer: 19316127, reasoning: 37574868 },
		automationBench: { answer: 12194455, reasoning: 27824106 },
		terminalBench40: { answer: 6131049, reasoning: 19109282 },
		frontierCode20: { answer: 11727454, reasoning: 29982620 },
		omniscience: { answer: 216035, reasoning: 45227159 },
		gdpPdf: { answer: 197628, reasoning: 4221285 },
		hleDiamond: { answer: 527912, reasoning: 79715780 },
		critptAgenticHard: { answer: 494212, reasoning: 5143006 },
		terminalBenchScience: { answer: 10380324, reasoning: 25238209 },
	},
};

type Sonnet = typeof SONNET;
type Who = { id: string; slug: string };
/** A second model with Sonnet's figures, to stand beside it on a page. */
const ALPHA: Who = {
	id: "a1fa0000-0000-0000-0000-000000000000",
	slug: "alpha",
};
type ModelOverrides = Partial<{
	who: Who;
	weightedCosts: number[];
	totalCost: number;
	tokenCounts: Partial<Sonnet["tokenCounts"]>;
}>;

const identity = (who: Who = SONNET) => ({
	id: who.id,
	slug: who.slug,
	release: { slug: who.slug },
	effort: { slug: "max" },
	isReasoning: true,
	intelligenceIndex: 30,
});

/** A model page's record: scores, and the index's cost and time per task. */
function modelRecord(over: ModelOverrides = {}) {
	const costs = over.weightedCosts ?? SONNET.weightedCosts;
	return {
		...identity(over.who),
		...SONNET.scores,
		intelligenceIndexCostPerTask: {
			cost: { total: over.totalCost ?? SONNET.totalCost },
			evaluations: AA_EVAL_IDS.map((slug, i) => ({
				slug,
				weightedCostPerTask: costs[i],
			})),
		},
		intelligenceIndexOutputTokensPerTask: {
			output: SONNET.outputTokensPerTask,
		},
		intelligenceIndexTimePerTask: SONNET.secondsPerTask,
	};
}

/** An eval page's record: the same model with its token counts. */
function evalPageRecord(over: ModelOverrides = {}) {
	return {
		...identity(over.who),
		canonicalEvalTokenCounts: { ...SONNET.tokenCounts, ...over.tokenCounts },
	};
}

/** An HTML page whose single push chunk carries the given records. */
function pageOf(records: object[]): string {
	const flight = `0:${JSON.stringify(records)}`;
	return `<script>self.__next_f.push([1,${JSON.stringify(flight)}])</script>`;
}

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
			"terminalbench-4-0": 12.64644,
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
		expect(() => run({ evalPages })).toThrow(/disagree on b171d979/);
	});

	it("takes no rows or scores from an eval page's records", () => {
		const evalPages = [[evalPageRecord(), evalPageRecord({ who: ALPHA })]];
		expect(new Set(run({ evalPages }).rows.map((r) => r.family))).toEqual(
			new Set([SONNET.slug]),
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
