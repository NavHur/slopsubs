import { describe, expect, it } from "vite-plus/test";
import type { TaskCost } from "./aa-index-cost";
import {
	type AaModel,
	deriveModel,
	mergeCatalog,
	type SlopaPoint,
} from "./catalog";

const AA = {
	release_date: "2026-09-22",
	model_creator: { slug: "anthropic", name: "Anthropic" },
	evaluations: { artificial_analysis_intelligence_index: 58.4 },
	pricing: { price_1m_input_tokens: 4, price_1m_output_tokens: 20 },
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
		evaluations: { artificial_analysis_intelligence_index: 32.5 },
		pricing: { price_1m_input_tokens: 0.3, price_1m_output_tokens: 1.2 },
	}),
	aaModel(
		"deepseek-v4-1-flash-1017-non-reasoning",
		"DeepSeek V4.1 Flash 1017 (Non-reasoning)",
		{
			evaluations: { artificial_analysis_intelligence_index: 18.5 },
			pricing: { price_1m_input_tokens: 0.3, price_1m_output_tokens: 1.2 },
		},
	),
	aaModel(
		"deepseek-v4-1-flash-non-reasoning",
		"DeepSeek V4.1 Flash (Non-reasoning)",
		{
			evaluations: { artificial_analysis_intelligence_index: null },
			pricing: { price_1m_input_tokens: 0.3, price_1m_output_tokens: 1.2 },
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
					evaluations: { artificial_analysis_intelligence_index: 50.4 },
					pricing: { price_1m_input_tokens: 4, price_1m_output_tokens: 20 },
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
					pricing: {
						price_1m_input_tokens: 4.0004,
						price_1m_output_tokens: 20,
					},
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

	it("keeps slopalytics' cost over AA's site", () => {
		const merged = mergeCatalog([CLAUDE], [point()], {
			coveredFamilies: covered,
			siteCosts: new Map([["claude-opus-5-5", SITE_COST]]),
		});
		expect(merged.models[0].costPerTaskUsd).toBe(10.03641);
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
					evaluations: { artificial_analysis_intelligence_index: 25.3 },
					pricing: { price_1m_input_tokens: 0.7, price_1m_output_tokens: 2.1 },
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
