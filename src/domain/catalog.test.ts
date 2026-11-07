import { describe, expect, it } from "vite-plus/test";
import type { AaModel, TaskCost } from "./aa-site";
import { deriveModel, mergeCatalog, type SlopaPoint } from "./catalog";

const AA = {
	releaseDate: "2026-09-22",
	creator: { slug: "anthropic", name: "Anthropic" },
	intelligenceIndex: 58.4,
	price1mInputTokens: 4,
	price1mOutputTokens: 20,
} satisfies Omit<AaModel, "slug" | "name">;

function aaModel(
	slug: string,
	name: string,
	extra: Partial<AaModel> = {},
): AaModel {
	return { ...AA, slug, name, ...extra };
}

function point(extra: Partial<SlopaPoint> = {}): SlopaPoint {
	return {
		id: "claude-opus-5-5",
		family: "claude-opus-5-5",
		name: "Claude Opus 5.5",
		variant: "Claude Opus 5.5",
		lab: "anthropic",
		labName: "Anthropic",
		released: "2026-09-22",
		open: false,
		deprecated: false,
		effort: "max",
		effortLabel: "max",
		effortOrder: 60,
		score: 58.41,
		costPerTaskUsd: 10.03641,
		tokensPerTask: 173313,
		secondsPerTask: 1445.4,
		inputPricePerMTokUsd: 4,
		outputPricePerMTokUsd: 20,
		...extra,
	};
}

const CLAUDE = aaModel(
	"claude-opus-5-5",
	"Claude Opus 5.5 (Max, Default Fallback)",
);

const NO_SITE_COSTS = new Map<string, TaskCost>();

const SITE_COST: TaskCost = {
	costPerTaskUsd: 0.58331,
	tokensPerTask: 134205,
	secondsPerTask: 1620.9,
};

const DEEPSEEK_AA = [
	aaModel("deepseek-v4-1-flash-1017", "DeepSeek V4.1 Flash 1017 (Max)", {
		intelligenceIndex: 32.5,
		price1mInputTokens: 0.3,
		price1mOutputTokens: 1.2,
	}),
	aaModel(
		"deepseek-v4-1-flash-1017-non-reasoning",
		"DeepSeek V4.1 Flash 1017 (Non-reasoning)",
		{
			intelligenceIndex: 18.5,
			price1mInputTokens: 0.3,
			price1mOutputTokens: 1.2,
		},
	),
	aaModel(
		"deepseek-v4-1-flash-non-reasoning",
		"DeepSeek V4.1 Flash (Non-reasoning)",
		{
			intelligenceIndex: null,
			price1mInputTokens: 0.3,
			price1mOutputTokens: 1.2,
		},
	),
];

const DEEPSEEK_SLOPA = [
	point({
		id: "deepseek-v4-1-flash-1017",
		family: "deepseek-v4-1-flash-1017",
		name: "DeepSeek V4.1 Flash 1017",
		variant: "DeepSeek V4.1 Flash 1017",
		effort: "max",
		effortLabel: "max",
		effortOrder: 60,
		score: 32.49,
	}),
	point({
		id: "deepseek-v4-1-flash-non-reasoning",
		family: "deepseek-v4-1-flash",
		effort: "none",
		effortLabel: "Non-reasoning",
		effortOrder: 0,
		score: null,
		costPerTaskUsd: null,
		tokensPerTask: null,
	}),
];

describe("deriveModel", () => {
	it("reads the effort AA states in the name", () => {
		expect(deriveModel(CLAUDE)).toEqual({
			family: "claude-opus-5-5",
			effort: "max",
		});
		expect(
			deriveModel(
				aaModel("mistral-large-4-medium", "Mistral Large 4 (Medium)"),
			),
		).toEqual({ family: "mistral-large-4", effort: "medium" });
	});

	it("treats a non-reasoning variant as its own effort", () => {
		expect(
			deriveModel(
				aaModel(
					"deepseek-v4-1-flash-1017-non-reasoning",
					"DeepSeek V4.1 Flash 1017 (Non-reasoning)",
				),
			),
		).toEqual({ family: "deepseek-v4-1-flash-1017", effort: "none" });
	});

	it("leaves a model without an effort in its name alone", () => {
		expect(
			deriveModel(
				aaModel("mistral-large-4-preview", "Mistral Large 4 Preview"),
			),
		).toBeNull();
	});
});

describe("mergeCatalog", () => {
	const covered = new Set(["claude-opus-5-5", "deepseek-v4-1-flash-1017"]);

	it("takes AA's score, price and release date", () => {
		const merged = mergeCatalog([CLAUDE], [point()], {
			coveredFamilies: covered,
			siteCosts: NO_SITE_COSTS,
		});
		expect(merged.models[0]).toMatchObject({
			score: 58.4,
			inputPricePerMTokUsd: 4,
			outputPricePerMTokUsd: 20,
			released: "2026-09-22",
			costPerTaskUsd: 10.03641,
			tokensPerTask: 173313,
		});
		expect(merged.warnings).toEqual([]);
	});

	it("keeps slopalytics' cost and warns when a price moved", () => {
		const merged = mergeCatalog(
			[
				aaModel("gemini-4-argon", "Gemini 4 Argon (High)", {
					intelligenceIndex: 50.4,
					price1mInputTokens: 4,
					price1mOutputTokens: 20,
				}),
			],
			[
				point({
					id: "gemini-4-argon",
					family: "gemini-4-argon",
					score: 50.41,
					inputPricePerMTokUsd: 2,
					outputPricePerMTokUsd: 10,
				}),
			],
			{
				coveredFamilies: new Set(["gemini-4-argon"]),
				siteCosts: NO_SITE_COSTS,
			},
		);
		expect(merged.models[0].inputPricePerMTokUsd).toBe(4);
		expect(merged.models[0].costPerTaskUsd).toBe(10.03641);
		expect(merged.warnings).toHaveLength(2);
	});

	it("ignores a price gap too small to move the chart", () => {
		const merged = mergeCatalog(
			[
				aaModel("claude-opus-5-5", "Claude Opus 5.5 (Max)", {
					price1mInputTokens: 4.0004,
					price1mOutputTokens: 20,
				}),
			],
			[point()],
			{ coveredFamilies: covered, siteCosts: NO_SITE_COSTS },
		);
		expect(merged.warnings).toEqual([]);
	});

	it("refuses a score the two sources disagree on", () => {
		expect(() =>
			mergeCatalog([CLAUDE], [point({ score: 59.2 })], {
				coveredFamilies: covered,
				siteCosts: NO_SITE_COSTS,
			}),
		).toThrow(/AA index 58.4, slopalytics 59.2/);
	});

	it("accepts a published regrade as a warning", () => {
		const merged = mergeCatalog([CLAUDE], [point({ score: 59.2 })], {
			coveredFamilies: covered,
			siteCosts: NO_SITE_COSTS,
			allowScoreDrift: true,
		});
		expect(merged.models[0].score).toBe(58.4);
		expect(merged.warnings).toEqual([
			"claude-opus-5-5: AA regraded 59.2 to 58.4; using AA",
		]);
	});

	it("still refuses a score gap no regrade explains", () => {
		expect(() =>
			mergeCatalog([CLAUDE], [point({ score: 60.5 })], {
				coveredFamilies: covered,
				siteCosts: NO_SITE_COSTS,
				allowScoreDrift: true,
			}),
		).toThrow(/AA index 58.4, slopalytics 60.5/);
	});

	it("refuses a point AA does not list", () => {
		expect(() =>
			mergeCatalog([], [point()], {
				coveredFamilies: covered,
				siteCosts: NO_SITE_COSTS,
			}),
		).toThrow(/AA has no model for claude-opus-5-5/);
	});

	it("adds an AA-only point on a plan with no cost data", () => {
		const merged = mergeCatalog(DEEPSEEK_AA, DEEPSEEK_SLOPA, {
			coveredFamilies: covered,
			siteCosts: NO_SITE_COSTS,
		});
		const added = merged.models.at(-1);
		expect(added).toMatchObject({
			id: "deepseek-v4-1-flash-1017-non-reasoning",
			family: "deepseek-v4-1-flash-1017",
			name: "DeepSeek V4.1 Flash 1017",
			effort: "none",
			effortLabel: "Non-reasoning",
			score: 18.5,
			costPerTaskUsd: null,
		});
		expect(merged.missingCost).toEqual([
			"deepseek-v4-1-flash-1017-non-reasoning",
		]);
	});

	it("fills a cost slopalytics lacks from AA's site", () => {
		const uncosted = point({
			costPerTaskUsd: null,
			tokensPerTask: null,
			secondsPerTask: null,
		});
		const merged = mergeCatalog([CLAUDE], [uncosted], {
			coveredFamilies: covered,
			siteCosts: new Map([["claude-opus-5-5", SITE_COST]]),
		});
		expect(merged.models[0]).toMatchObject(SITE_COST);
	});

	it("keeps slopalytics' tokens and time when only its cost is missing", () => {
		const partial = point({
			costPerTaskUsd: null,
			tokensPerTask: 88476,
			secondsPerTask: null,
		});
		const merged = mergeCatalog([CLAUDE], [partial], {
			coveredFamilies: covered,
			siteCosts: new Map([
				["claude-opus-5-5", { ...SITE_COST, tokensPerTask: null }],
			]),
		});
		expect(merged.models[0]).toMatchObject({
			costPerTaskUsd: SITE_COST.costPerTaskUsd,
			tokensPerTask: 88476,
			secondsPerTask: SITE_COST.secondsPerTask,
		});
	});

	it("prefers AA's site cost, tokens and time over slopalytics'", () => {
		const merged = mergeCatalog([CLAUDE], [point()], {
			coveredFamilies: covered,
			siteCosts: new Map([["claude-opus-5-5", SITE_COST]]),
		});
		expect(merged.models[0]).toMatchObject(SITE_COST);
	});

	it("keeps slopalytics' time when AA's site lacks it", () => {
		const merged = mergeCatalog([CLAUDE], [point()], {
			coveredFamilies: covered,
			siteCosts: new Map([
				["claude-opus-5-5", { ...SITE_COST, secondsPerTask: null }],
			]),
		});
		expect(merged.models[0]).toMatchObject({
			costPerTaskUsd: SITE_COST.costPerTaskUsd,
			tokensPerTask: SITE_COST.tokensPerTask,
			secondsPerTask: 1445.4,
		});
	});

	it("costs an AA-only point from AA's site, so it is not missing", () => {
		const merged = mergeCatalog(DEEPSEEK_AA, DEEPSEEK_SLOPA, {
			coveredFamilies: covered,
			siteCosts: new Map([
				["deepseek-v4-1-flash-1017-non-reasoning", SITE_COST],
			]),
		});
		expect(merged.models.at(-1)).toMatchObject(SITE_COST);
		expect(merged.missingCost).toEqual([]);
	});

	it("leaves out an AA-only model no plan covers", () => {
		const merged = mergeCatalog(
			[CLAUDE, aaModel("gemini-4-carbon", "Gemini 4 Carbon (High)")],
			[point()],
			{ coveredFamilies: covered, siteCosts: NO_SITE_COSTS },
		);
		expect(merged.models).toHaveLength(1);
		expect(merged.skipped).toEqual(["gemini-4-carbon"]);
	});

	it("refuses a covered family's model whose effort it cannot read", () => {
		for (const slug of ["claude-opus-5-5-preview", "claude-opus-5-5"]) {
			expect(() =>
				mergeCatalog([aaModel(slug, "Claude Opus 5.5 Preview")], [], {
					coveredFamilies: covered,
					siteCosts: NO_SITE_COSTS,
				}),
			).toThrow(new RegExp(`${slug} .*cannot read an effort`));
		}
	});

	it("follows AA's new slug for a model we already import", () => {
		const merged = mergeCatalog(
			[
				aaModel("mistral-large-4-preview", "Mistral Large 4 Preview", {
					intelligenceIndex: 25.3,
					price1mInputTokens: 0.7,
					price1mOutputTokens: 2.1,
				}),
			],
			[
				point({
					id: "mistral-large-4",
					family: "mistral-large-4",
					score: 25.29,
					inputPricePerMTokUsd: 1.36,
					outputPricePerMTokUsd: 4.18,
				}),
			],
			{
				coveredFamilies: new Set(["mistral-large-4"]),
				siteCosts: NO_SITE_COSTS,
			},
		);
		expect(merged.models[0].score).toBe(25.3);
		expect(merged.models[0].inputPricePerMTokUsd).toBe(0.7);
		expect(merged.skipped).toEqual([]);
	});
});
