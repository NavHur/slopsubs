import { describe, expect, it } from "vite-plus/test";
import { extractIndexCosts } from "./aa-index-cost";

/** A model id in the payload's 36-character uuid form. */
const uuidOf = (index: number) =>
	`${String(index).padStart(8, "0")}-0000-0000-0000-000000000000`;

type Fixture = { slug: string; cost?: number; selected?: boolean };

/** One model record as the flight payload lays it out, creator nested. */
function modelRecord({ slug, cost, selected = false }: Fixture, index: number) {
	return {
		id: uuidOf(index),
		slug,
		chartDefaultSelected: selected,
		creator: { id: uuidOf(900 + index), slug: "lab", name: "Lab {x}" },
		intelligenceIndex: cost === undefined ? null : 30,
		intelligenceIndexTimePerTask: cost === undefined ? null : 412.345,
		intelligenceIndexCostPerTask:
			cost === undefined ? null : { cost: { total: cost }, evaluations: [] },
		intelligenceIndexOutputTokensPerTask:
			cost === undefined ? null : { output: 91113.8, answer: 1 },
	};
}

const flightOf = (models: Fixture[]) =>
	`0:${JSON.stringify({ models: models.map(modelRecord) })}`;

describe("extractIndexCosts", () => {
	it("reads a model's cost, tokens and time per task", () => {
		const costs = extractIndexCosts(
			flightOf([{ slug: "glm-5-3-flash", cost: 0.583310344 }]),
		);
		expect(costs.get("glm-5-3-flash")).toEqual({
			costPerTaskUsd: 0.58331,
			tokensPerTask: 91114,
			secondsPerTask: 412.3,
		});
	});

	it("leaves out an uncosted model instead of taking its neighbour's cost", () => {
		const costs = extractIndexCosts(
			flightOf([
				{ slug: "muse-spark-1-3-xhigh" },
				{ slug: "kimi-k3-low", cost: 2.37 },
			]),
		);
		expect(costs.has("muse-spark-1-3-xhigh")).toBe(false);
		expect(costs.get("kimi-k3-low")?.costPerTaskUsd).toBe(2.37);
	});

	it("does not read a nested creator as a model", () => {
		const costs = extractIndexCosts(flightOf([{ slug: "alpha", cost: 1 }]));
		expect([...costs.keys()]).toEqual(["alpha"]);
	});

	it("stops on a page that lists only the default chart selection", () => {
		expect(() =>
			extractIndexCosts(flightOf([{ slug: "alpha", cost: 1, selected: true }])),
		).toThrow(/default chart selection/);
	});
});
