import { describe, expect, it } from "vite-plus/test";
import type { AaEvalId } from "./eval-units";
import { evalPoints, frontierCodePoints } from "./leaderboards";
import type {
	AaEvalRow,
	BenchmarkPoint,
	FamilyId,
	FrontierCodeRow,
} from "./model";

// SAFETY: test ids stand in for branded family ids.
const OPUS = "claude-opus-5-5" as FamilyId;
const SOL = "gpt-6-1-sol" as FamilyId;

function catalogPoint(
	family: FamilyId,
	effort: BenchmarkPoint["effort"],
	effortLabel: string,
	effortOrder: number,
): BenchmarkPoint {
	return {
		id: `${family}-${effort}`,
		family,
		name: family.toUpperCase(),
		lab: "lab",
		labName: "Lab",
		deprecated: false,
		effort,
		effortLabel,
		effortOrder,
		score: 50,
		costPerTaskUsd: 1,
		tokensPerTask: 1000,
		secondsPerTask: 120,
		inputPricePerMTokUsd: 2,
		outputPricePerMTokUsd: 10,
	};
}

const CATALOG = [
	catalogPoint(OPUS, "max", "max", 60),
	catalogPoint(SOL, "none", "Non-reasoning", 0),
];

function row(family: FamilyId, effort: FrontierCodeRow["effort"]) {
	return { family, effort, score: 42, costPerTaskUsd: 3, tokensPerTask: 900 };
}

describe("frontierCodePoints", () => {
	it("scores and costs a point from the row, names and prices it from the catalog", () => {
		const [point] = frontierCodePoints([row(OPUS, "max")], CATALOG);
		expect(point).toMatchObject({
			family: OPUS,
			name: "CLAUDE-OPUS-5-5",
			effort: "max",
			score: 42,
			costPerTaskUsd: 3,
			tokensPerTask: 900,
			inputPricePerMTokUsd: 2,
		});
	});

	it("leaves the catalog's time per task off, since FrontierCode has none", () => {
		const [point] = frontierCodePoints([row(OPUS, "max")], CATALOG);
		expect(point?.secondsPerTask).toBeNull();
	});

	it("labels an effort the family lacks in the catalog as other families do", () => {
		const [point] = frontierCodePoints([row(OPUS, "none")], CATALOG);
		expect(point).toMatchObject({
			effort: "none",
			effortLabel: "Non-reasoning",
			effortOrder: 0,
		});
	});

	it("refuses a family the catalog doesn't know", () => {
		const unknown = "swe-2" as FamilyId;
		expect(() => frontierCodePoints([row(unknown, "max")], CATALOG)).toThrow(
			"swe-2",
		);
	});
});

describe("evalPoints", () => {
	function evalRow(
		family: string,
		effort: string,
		extra: Partial<AaEvalRow> = {},
	): AaEvalRow {
		return {
			family: family as FamilyId,
			effort: effort as AaEvalRow["effort"],
			eval: "terminalbench-4-0",
			score: 0.5,
			costPerTaskUsd: 2,
			tokensPerTask: 50_000,
			secondsPerTask: 500,
			...extra,
		};
	}

	it("scores and costs a point from the eval row, names it from the catalog", () => {
		const [point] = evalPoints(
			[evalRow(OPUS, "max")],
			CATALOG,
			"terminalbench-4-0",
		);
		expect(point).toMatchObject({
			family: OPUS,
			name: "CLAUDE-OPUS-5-5",
			effort: "max",
			score: 50,
			costPerTaskUsd: 2,
			tokensPerTask: 50_000,
			secondsPerTask: 500,
			inputPricePerMTokUsd: 2,
		});
	});

	it("converts a percent eval's fraction to points and leaves index evals as is", () => {
		const score = (evalId: AaEvalRow["eval"]) =>
			evalPoints(
				[evalRow(OPUS, "max", { eval: evalId, score: 0.5707 })],
				CATALOG,
				evalId as AaEvalId,
			)[0].score;
		expect(score("terminalbench-4-0")).toBe(57.07);
		expect(score("omniscience")).toBe(0.5707);
		expect(score("aa-briefcase")).toBe(0.5707);
	});

	it("refuses a family the catalog doesn't know", () => {
		const unknown = "swe-2";
		expect(() =>
			evalPoints([evalRow(unknown, "max")], CATALOG, "terminalbench-4-0"),
		).toThrow(unknown);
	});
});
