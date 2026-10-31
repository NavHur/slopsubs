import { describe, expect, it } from "vite-plus/test";
import { frontierCodePoints } from "./leaderboards";
import type { BenchmarkPoint, FamilyId, FrontierCodeRow } from "./model";

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
