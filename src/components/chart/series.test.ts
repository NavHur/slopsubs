import { describe, expect, it } from "vitest";
import type { Plan } from "#/domain/model";
import type { Pricing, ValuePoint } from "#/domain/value";
import { buildSeries, groupByModel, modelEnd, pricingKey } from "./series";

function plan(id: string): Pricing {
	// SAFETY: series building reads only the plan's id and label.
	return { kind: "plan", plan: { id, label: id } as Plan, valueMultiple: 1 };
}

function line(family: string, pricing: Pricing, costs: number[]): ValuePoint[] {
	const key = pricing.kind === "api" ? "api" : pricing.plan.id;
	return costs.map(
		(costPerTaskUsd, i) =>
			// SAFETY: series building reads only identity, family, cost and pricing.
			({
				seriesId: `${family}@${key}`,
				benchmark: { id: `${family}-${i}`, family },
				intelligence: 40 + i,
				costPerTaskUsd,
				pricing,
			}) as unknown as ValuePoint,
	);
}

const api: Pricing = { kind: "api" };
const points = [
	...line("haiku", api, [0.02, 0.2]),
	...line("opus", api, [0.5, 6]),
	...line("haiku", plan("max-20x"), [0.0006, 0.005]),
	...line("opus", plan("max-20x"), [0.01, 0.15]),
	...line("haiku", plan("opencode-go"), [0.016, 0.14]),
];

describe("buildSeries", () => {
	it("gives each plan its own marker and keeps API lines apart", () => {
		const key = pricingKey(buildSeries(points));
		expect(key.map((s) => [s.label, s.isApi, s.marker])).toEqual([
			["API", true, "circle"],
			["max-20x", false, "circle"],
			["opencode-go", false, "square"],
		]);
	});

	it("names model and plan on every line", () => {
		const labels = buildSeries(points).map((s) => s.label);
		expect(labels).toContain("haiku · opencode-go");
		expect(labels).toContain("opus · API");
	});
});

describe("groupByModel", () => {
	it("folds every pricing of a model into one entry", () => {
		const models = groupByModel(buildSeries(points));
		expect(models.map((m) => [m.id, m.series.length])).toEqual([
			["haiku", 3],
			["opus", 2],
		]);
	});

	it("starts a model's label at its rightmost line end", () => {
		const [haiku] = groupByModel(buildSeries(points));
		expect(modelEnd(haiku).costPerTaskUsd).toBe(0.2);
	});
});
