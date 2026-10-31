import { describe, expect, it } from "vite-plus/test";
import { codingPoints, frontierCodePoints } from "./leaderboards";
import type {
	BenchmarkPoint,
	CatalogPoint,
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

describe("codingPoints", () => {
	const scored: CatalogPoint = {
		...catalogPoint(OPUS, "max", "max", 60),
		coding: { score: 44, costPerTaskUsd: 9, tokensPerTask: 80_000 },
	};
	const unscored: CatalogPoint = {
		...catalogPoint(SOL, "none", "Non-reasoning", 0),
		coding: null,
	};

	it("plots a point at its coding score, cost and tokens", () => {
		const [point] = codingPoints([scored]);
		expect(point).toMatchObject({
			id: scored.id,
			family: OPUS,
			score: 44,
			costPerTaskUsd: 9,
			tokensPerTask: 80_000,
			inputPricePerMTokUsd: 2,
		});
		expect(point).not.toHaveProperty("coding");
	});

	it("drops points never run on the coding evals", () => {
		expect(codingPoints([unscored, scored]).map((p) => p.family)).toEqual([
			OPUS,
		]);
	});
});
