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
};

function snapshot({
	fetchedAt = "2026-11-10T00:00:00.000Z",
	catalog = [point(astra), point(argon)],
	shipped = [point(astra)],
	weeklyCapApiUsd = 1000,
}: SnapshotInput = {}): DataSnapshot {
	const board = { fetchedAt, models: shipped };
	return {
		benchmarks: { fetchedAt, source: "AA", frontier: {}, models: catalog },
		aaEvals: { fetchedAt, source: "AA", evals: [], rows: [] },
		frontierCode: { fetchedAt, source: "Cognition", rows: [] },
		chart: {
			frontier: {},
			leaderboards: {
				intelligence: board,
				frontiercode: { fetchedAt, models: [] },
				"aa-briefcase": board,
				"automationbench-aa": board,
				"terminalbench-4-0": board,
				"frontiercode-2-0": board,
				omniscience: board,
				"gdp-pdf": board,
				"hle-diamond": board,
				"critpt-v2-hard": board,
				"terminal-bench-science": board,
			},
		},
		plans: [plan(weeklyCapApiUsd)],
		samples: [],
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

	it("reports a plan whose value multiple changed", () => {
		const changes = summarizeDataChanges(
			snapshot(),
			snapshot({ weeklyCapApiUsd: 1200 }),
		);
		expect(changes.planValues).toHaveLength(1);
		const [value] = changes.planValues;
		expect(value).toMatchObject({ planId: "chatgpt-pro-200", family: astra });
		expect(value.after! / value.before!).toBeCloseTo(1.2);
		expect(changes.changedFiles).toEqual(["plans.json"]);
	});
});
