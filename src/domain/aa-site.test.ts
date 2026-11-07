import { describe, expect, it } from "vite-plus/test";
import { readAaSite } from "./aa-site";

/** A model id in the payload's 36-character uuid form. */
const uuidOf = (index: number) =>
	`${String(index).padStart(8, "0")}-0000-0000-0000-000000000000`;

type Fixture = { slug: string; cost?: number; selected?: boolean };

/** One model record as the flight payload lays it out, creator nested. */
function modelRecord({ slug, cost, selected = false }: Fixture, index: number) {
	return {
		id: uuidOf(index),
		slug,
		name: `${slug} (High)`,
		releaseDate: "2026-10-23",
		chartDefaultSelected: selected,
		creator: {
			id: uuidOf(900 + index),
			slug: "lab",
			name: 'Lab "{x}',
			logo: "/img/lab.svg",
		},
		intelligenceIndex: cost === undefined ? null : 30,
		price1mInputTokens: cost === undefined ? null : 0.181,
		price1mOutputTokens: cost === undefined ? null : 0.362,
		intelligenceIndexTimePerTask: cost === undefined ? null : 412.345,
		intelligenceIndexCostPerTask:
			cost === undefined ? null : { cost: { total: cost }, evaluations: [] },
		intelligenceIndexOutputTokensPerTask:
			cost === undefined ? null : { output: 91113.8, answer: 1 },
	};
}

const flightOf = (models: Fixture[]) =>
	`0:${JSON.stringify({ models: models.map(modelRecord) })}`;

describe("readAaSite", () => {
	it("reads a model's score, prices, release date and creator", () => {
		const { models } = readAaSite(flightOf([{ slug: "mimo-v2-5", cost: 1 }]));
		expect(models).toEqual([
			{
				slug: "mimo-v2-5",
				name: "mimo-v2-5 (High)",
				releaseDate: "2026-10-23",
				creator: { slug: "lab", name: 'Lab "{x}' },
				intelligenceIndex: 30,
				price1mInputTokens: 0.181,
				price1mOutputTokens: 0.362,
			},
		]);
	});

	it("lists an unscored, unpriced model with null figures", () => {
		const { models } = readAaSite(flightOf([{ slug: "granite-4-2-3b" }]));
		expect(models[0]).toMatchObject({
			intelligenceIndex: null,
			price1mInputTokens: null,
			price1mOutputTokens: null,
		});
	});

	it("reads a model's cost, tokens and time per task", () => {
		const { costs } = readAaSite(
			flightOf([{ slug: "glm-5-3-flash", cost: 0.583310344 }]),
		);
		expect(costs.get("glm-5-3-flash")).toEqual({
			costPerTaskUsd: 0.58331,
			tokensPerTask: 91114,
			secondsPerTask: 412.3,
		});
	});

	it("leaves out an uncosted model instead of taking its neighbour's cost", () => {
		const { costs } = readAaSite(
			flightOf([
				{ slug: "muse-spark-1-3-xhigh" },
				{ slug: "kimi-k3-low", cost: 2.37 },
			]),
		);
		expect(costs.has("muse-spark-1-3-xhigh")).toBe(false);
		expect(costs.get("kimi-k3-low")?.costPerTaskUsd).toBe(2.37);
	});

	it("does not read a nested creator as a model", () => {
		const { models } = readAaSite(flightOf([{ slug: "alpha", cost: 1 }]));
		expect(models.map((model) => model.slug)).toEqual(["alpha"]);
	});

	it("stops on a page that lists a model twice", () => {
		expect(() =>
			readAaSite(flightOf([{ slug: "alpha" }, { slug: "alpha" }])),
		).toThrow(/alpha twice/);
	});

	it("stops on a page that lists only the default chart selection", () => {
		expect(() =>
			readAaSite(flightOf([{ slug: "alpha", cost: 1, selected: true }])),
		).toThrow(/default chart selection/);
	});
});
