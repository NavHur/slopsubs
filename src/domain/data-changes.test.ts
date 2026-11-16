import { describe, expect, it } from "vite-plus/test";
import {
	type DataSnapshot,
	hasDataChanges,
	summarizeDataChanges,
} from "./data-changes";
import type { BenchmarkPoint, FamilyId, Plan, PlanId } from "./model";

const astra = "gpt-6-astra" as FamilyId;
const argon = "gemini-4-argon" as FamilyId;

function point(
	family: FamilyId,
	overrides: Partial<BenchmarkPoint> = {},
): BenchmarkPoint {
	return {
		id: `${family}-high`,
		family,
		name: family === astra ? "GPT-6 Astra" : "Gemini 4 Argon",
		lab: "lab",
		labName: "Lab",
		deprecated: false,
		effort: "high",
		effortLabel: "High",
		effortOrder: 60,
		score: 70,
		costPerTaskUsd: 1,
		tokensPerTask: 1000,
		secondsPerTask: 10,
		inputPricePerMTokUsd: 2,
		outputPricePerMTokUsd: 10,
		...overrides,
	};
}

function plan(apiUsdPerWeek: number): Plan {
	return {
		id: "chatgpt-pro-200" as PlanId,
		vendor: "Codex",
		lab: "openai",
		label: "Pro",
		monthlyPriceUsd: 200,
		harnesses: ["Codex"],
		families: [astra],
		limits: "weekly cap",
		includedApiCreditUsd: 0,
		thirdPartyHarnessAllowed: false,
		confidence: "primary",
		sourceUrl: "https://example.com/pricing",
		reportedCap: {
			weeklyCapApiUsdByFamily: { [astra]: apiUsdPerWeek },
			by: "Theo",
			url: "https://example.com/theo",
			basis: "estimate",
		},
		publishedAllowance: null,
		weeklyShareByFamily: {},
		maxEffortByFamily: {},
		promotionByFamily: {},
	};
}

type SnapshotInput = {
	fetchedAt?: string;
	catalog?: BenchmarkPoint[];
	shipped?: BenchmarkPoint[];
	weeklyCapApiUsd?: number;
	/** Fields the importer writes to each catalog model that the schema drops. */
	unparsedModelFields?: Record<string, unknown>;
	/** The gdp-pdf board's points, when they differ from `shipped`. */
	gdpPdf?: BenchmarkPoint[];
};

function snapshot({
	fetchedAt = "2026-11-10T00:00:00.000Z",
	catalog = [point(astra), point(argon)],
	shipped = [point(astra)],
	weeklyCapApiUsd = 1000,
	unparsedModelFields = {},
	gdpPdf = shipped,
}: SnapshotInput = {}): DataSnapshot {
	const board = { fetchedAt, models: shipped };
	const benchmarks = { fetchedAt, source: "AA", frontier: {}, models: catalog };
	const aaEvals = { fetchedAt, source: "AA", evals: [], rows: [] };
	const frontierCode = { fetchedAt, source: "Cognition", rows: [] };
	const plans = [plan(weeklyCapApiUsd)];
	const chart = {
		frontier: {},
		leaderboards: {
			intelligence: board,
			frontiercode: { fetchedAt, models: [] },
			"aa-briefcase": board,
			"automationbench-aa": board,
			"terminalbench-4-0": board,
			"frontiercode-2-0": board,
			omniscience: board,
			"gdp-pdf": { fetchedAt, models: gdpPdf },
			"hle-diamond": board,
			"critpt-v2-hard": board,
			"terminal-bench-science": board,
		},
	};
	return {
		benchmarks,
		aaEvals,
		frontierCode,
		chart,
		plans,
		samples: [],
		raw: {
			benchmarks: {
				...benchmarks,
				models: catalog.map((m) => ({ ...m, ...unparsedModelFields })),
			},
			aaEvals,
			frontierCode,
			chart,
			plans,
		},
	};
}

describe("summarizeDataChanges", () => {
	it("reports only refetched files when nothing but timestamps moved", () => {
		const changes = summarizeDataChanges(
			snapshot(),
			snapshot({ fetchedAt: "2026-11-15T03:00:00.000Z" }),
		);
		expect(hasDataChanges(changes)).toBe(false);
		expect(changes.refetchedFiles).toContain("benchmarks.json");
		expect(changes.changedFiles).toEqual([]);
	});

	it("reports no change between identical snapshots", () => {
		const changes = summarizeDataChanges(snapshot(), snapshot());
		expect(hasDataChanges(changes)).toBe(false);
		expect(changes.refetchedFiles).toEqual([]);
	});

	it("names a family AA started listing", () => {
		const fresh = point("muse-spark-1-4" as FamilyId, { name: "Muse Spark" });
		const changes = summarizeDataChanges(
			snapshot(),
			snapshot({ catalog: [point(astra), point(argon), fresh] }),
		);
		expect(changes.familiesAdded).toEqual([
			{ family: "muse-spark-1-4", name: "Muse Spark" },
		]);
		expect(changes.changedFiles).toEqual(["benchmarks.json"]);
		expect(hasDataChanges(changes)).toBe(true);
	});

	it("names a family AA stopped listing", () => {
		const changes = summarizeDataChanges(
			snapshot(),
			snapshot({ catalog: [point(astra)] }),
		);
		expect(changes.familiesRemoved).toEqual([
			{ family: argon, name: "Gemini 4 Argon" },
		]);
	});

	it("reports a score that moved, per benchmark", () => {
		const changes = summarizeDataChanges(
			snapshot(),
			snapshot({ shipped: [point(astra, { score: 72.5 })] }),
		);
		expect(changes.scores).toContainEqual({
			benchmark: "intelligence",
			family: astra,
			name: "GPT-6 Astra",
			effortLabel: "High",
			before: 70,
			after: 72.5,
		});
		expect(changes.scores.map((s) => s.benchmark)).toContain("gdp-pdf");
	});

	it("leaves out score wobble below the threshold but still counts it", () => {
		const changes = summarizeDataChanges(
			snapshot(),
			snapshot({ shipped: [point(astra, { score: 70.01 })] }),
		);
		expect(changes.scores).toEqual([]);
		expect(hasDataChanges(changes)).toBe(true);
	});

	it.each([
		[70, 70.1],
		[70.1, 70],
		[45.6, 45.7],
	])("reports a %d to %d score move of a tenth", (was, now) => {
		const changes = summarizeDataChanges(
			snapshot({ shipped: [point(astra, { score: was })] }),
			snapshot({ shipped: [point(astra, { score: now })] }),
		);
		expect(changes.scores).toContainEqual(
			expect.objectContaining({ before: was, after: now }),
		);
	});

	it("leaves out a score move just under a tenth", () => {
		const changes = summarizeDataChanges(
			snapshot(),
			snapshot({ shipped: [point(astra, { score: 70.09 })] }),
		);
		expect(changes.scores).toEqual([]);
	});

	it("reports a new effort point of a family already on the board", () => {
		const low = point(astra, {
			id: "astra-low",
			effort: "low",
			effortLabel: "Low",
		});
		const changes = summarizeDataChanges(
			snapshot(),
			snapshot({ shipped: [point(astra), low] }),
		);
		expect(changes.scores).toContainEqual(
			expect.objectContaining({
				benchmark: "intelligence",
				effortLabel: "Low",
				before: null,
				after: 70,
			}),
		);
	});

	it("reports a point that lost its score", () => {
		const changes = summarizeDataChanges(
			snapshot(),
			snapshot({ shipped: [point(astra, { score: null })] }),
		);
		expect(changes.scores).toContainEqual(
			expect.objectContaining({ before: 70, after: null }),
		);
	});

	it("leaves a family new to the catalog to the families sections", () => {
		const muse = point("muse-spark-1-4" as FamilyId, { name: "Muse Spark" });
		const changes = summarizeDataChanges(
			snapshot(),
			snapshot({
				catalog: [point(astra), point(argon), muse],
				shipped: [point(astra), muse],
			}),
		);
		expect(changes.familiesAdded).toHaveLength(1);
		expect(changes.scores).toEqual([]);
	});

	it("reports a catalog family gaining its first row on a board", () => {
		const changes = summarizeDataChanges(
			snapshot({ gdpPdf: [point(astra)] }),
			snapshot({ gdpPdf: [point(astra), point(argon)] }),
		);
		expect(changes.scores).toEqual([
			expect.objectContaining({
				benchmark: "gdp-pdf",
				family: argon,
				before: null,
				after: 70,
			}),
		]);
	});

	it("reports a catalog family losing its only row on a board", () => {
		const changes = summarizeDataChanges(
			snapshot({ gdpPdf: [point(astra), point(argon)] }),
			snapshot({ gdpPdf: [point(astra)] }),
		);
		expect(changes.scores).toEqual([
			expect.objectContaining({
				benchmark: "gdp-pdf",
				family: argon,
				before: 70,
				after: null,
			}),
		]);
	});

	it("leaves out a score move of 0.096 as rounding", () => {
		const changes = summarizeDataChanges(
			snapshot(),
			snapshot({ shipped: [point(astra, { score: 70.096 })] }),
		);
		expect(changes.scores).toEqual([]);
	});

	it("lists a family's list price from the first input and first output it has", () => {
		const outputOnly = point(astra, {
			id: "astra-low",
			effort: "low",
			inputPricePerMTokUsd: null,
		});
		const changes = summarizeDataChanges(
			snapshot({ shipped: [outputOnly, point(astra)] }),
			snapshot({
				shipped: [outputOnly, point(astra, { inputPricePerMTokUsd: 1.5 })],
			}),
		);
		expect(changes.prices.map((p) => [p.before, p.after])).toEqual([
			[
				{ input: 2, output: 10 },
				{ input: 1.5, output: 10 },
			],
		]);
	});

	it("reports an output-only price change while input is unpriced", () => {
		const unpriced = { inputPricePerMTokUsd: null };
		const changes = summarizeDataChanges(
			snapshot({ shipped: [point(astra, unpriced)] }),
			snapshot({
				shipped: [point(astra, { ...unpriced, outputPricePerMTokUsd: 12 })],
			}),
		);
		expect(changes.prices.map((p) => [p.before, p.after])).toEqual([
			[
				{ input: null, output: 10 },
				{ input: null, output: 12 },
			],
		]);
	});

	it("reports a price that appears or disappears", () => {
		const unpriced = point(astra, {
			inputPricePerMTokUsd: null,
			outputPricePerMTokUsd: null,
		});
		const priced = point(astra);
		const appears = summarizeDataChanges(
			snapshot({ shipped: [unpriced] }),
			snapshot({ shipped: [priced] }),
		);
		const disappears = summarizeDataChanges(
			snapshot({ shipped: [priced] }),
			snapshot({ shipped: [unpriced] }),
		);
		expect(appears.prices.map((p) => p.before)).toEqual([
			{ input: null, output: null },
		]);
		expect(disappears.prices.map((p) => p.after)).toEqual([
			{ input: null, output: null },
		]);
	});

	it("reports nothing for prices that stay unpriced", () => {
		const unpriced = point(astra, {
			inputPricePerMTokUsd: null,
			outputPricePerMTokUsd: null,
		});
		const changes = summarizeDataChanges(
			snapshot({ shipped: [unpriced] }),
			snapshot({ shipped: [unpriced] }),
		);
		expect(changes.prices).toEqual([]);
	});

	it("reports a file whose only change is a field the schema drops", () => {
		const changes = summarizeDataChanges(
			snapshot({ unparsedModelFields: { released: "2026-05-01" } }),
			snapshot({ unparsedModelFields: { released: "2026-05-02" } }),
		);
		expect(changes.changedFiles).toEqual(["benchmarks.json"]);
		expect(hasDataChanges(changes)).toBe(true);
	});

	it("reports a list-price change once per family", () => {
		const changes = summarizeDataChanges(
			snapshot(),
			snapshot({
				shipped: [
					point(astra, { inputPricePerMTokUsd: 1.5 }),
					point(astra, {
						id: "gpt-6-astra-low",
						effort: "low",
						inputPricePerMTokUsd: 1.5,
					}),
				],
			}),
		);
		expect(changes.prices).toEqual([
			{
				family: astra,
				name: "GPT-6 Astra",
				before: { input: 2, output: 10 },
				after: { input: 1.5, output: 10 },
			},
		]);
	});

	it("reads a family's list price from a priced point", () => {
		const unpriced = point(astra, {
			id: "gpt-6-astra-low",
			effort: "low",
			inputPricePerMTokUsd: null,
			outputPricePerMTokUsd: null,
		});
		const changes = summarizeDataChanges(
			snapshot({ shipped: [unpriced, point(astra)] }),
			snapshot({
				shipped: [unpriced, point(astra, { outputPricePerMTokUsd: 12 })],
			}),
		);
		expect(changes.prices.map((p) => p.after)).toEqual([
			{ input: 2, output: 12 },
		]);
	});

	it("reports a plan whose value multiple changed", () => {
		const changes = summarizeDataChanges(
			snapshot(),
			snapshot({ weeklyCapApiUsd: 1200 }),
		);
		expect(changes.planValues).toHaveLength(1);
		const [value] = changes.planValues;
		expect(value).toMatchObject({
			planId: "chatgpt-pro-200",
			family: astra,
			name: "GPT-6 Astra",
		});
		expect(value.after! / value.before!).toBeCloseTo(1.2);
		expect(changes.changedFiles).toEqual(["plans.json"]);
	});
});
