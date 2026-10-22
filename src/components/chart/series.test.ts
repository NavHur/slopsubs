import { describe, expect, it } from "vitest";
import type { BenchmarkPoint, FamilyId, Plan, PlanId } from "#/domain/model";
import type { Pricing, ValuePoint } from "#/domain/value";
import { buildSeries, groupByModel, modelEnd, pricingStyles } from "./series";

const haiku = "claude-haiku-5-5" as FamilyId;
const opus = "claude-opus-5-5" as FamilyId;

const basePlan: Plan = {
	id: "claude-max-20x" as PlanId,
	vendor: "Anthropic",
	lab: "anthropic",
	label: "Max 20x",
	monthlyPriceUsd: 200,
	harnesses: ["Claude Code"],
	families: [haiku, opus],
	limits: "weekly cap",
	includedApiCreditUsd: 0,
	thirdPartyHarnessAllowed: false,
	confidence: "primary",
	sourceUrl: "https://example.com/pricing",
	reportedCap: null,
	publishedAllowance: null,
	maxEffortByFamily: {},
};

function plan(id: string, label: string): Pricing {
	return {
		kind: "plan",
		plan: { ...basePlan, id: id as PlanId, label },
		valueMultiple: 1,
	};
}

function benchmark(family: FamilyId, order: number): BenchmarkPoint {
	return {
		id: `${family}-${order}`,
		family,
		name: family,
		lab: "anthropic",
		labName: "Anthropic",
		deprecated: false,
		effort: "max",
		effortLabel: "max",
		effortOrder: order,
		intelligence: 40 + order,
		costPerTaskUsd: order,
		tokensPerTask: 1000,
		inputPricePerMTokUsd: 5,
		outputPricePerMTokUsd: 25,
	};
}

function line(
	family: FamilyId,
	pricing: Pricing,
	costs: number[],
): ValuePoint[] {
	const key = pricing.kind === "api" ? "api" : pricing.plan.id;
	return costs.map((costPerTaskUsd, i) => ({
		seriesId: `${family}@${key}`,
		benchmark: benchmark(family, i),
		intelligence: 40 + i,
		costPerTaskUsd,
		pricing,
	}));
}

const api: Pricing = { kind: "api" };
const max = plan("claude-max-20x", "Max 20x");
const go = plan("opencode-go", "OpenCode Go");
const points = [
	...line(haiku, api, [0.02, 0.2]),
	...line(opus, api, [0.5, 6]),
	...line(haiku, max, [0.0006, 0.005]),
	...line(opus, max, [0.01, 0.15]),
	...line(haiku, go, [0.016, 0.14]),
];

describe("buildSeries", () => {
	it("gives each plan its own marker and keeps API lines apart", () => {
		const key = [...pricingStyles(buildSeries(points)).values()];
		expect(key.map((s) => [s.label, s.isApi, s.marker])).toEqual([
			["API", true, "circle"],
			["Max 20x", false, "circle"],
			["OpenCode Go", false, "square"],
		]);
	});

	it("names model and plan on every line", () => {
		const labels = buildSeries(points).map((s) => s.label);
		expect(labels).toContain("Haiku 5.5 · OpenCode Go");
		expect(labels).toContain("Opus 5.5 · API");
	});
});

describe("pricingStyles", () => {
	it("finds each plan's line style by plan id, and the API's by api", () => {
		const styles = pricingStyles(buildSeries(points));
		expect(styles.get("api")?.isApi).toBe(true);
		expect(styles.get("opencode-go" as PlanId)?.marker).toBe("square");
	});

	it("has no style for a plan without lines", () => {
		const styles = pricingStyles(buildSeries(points));
		expect(styles.has("claude-pro" as PlanId)).toBe(false);
	});
});

describe("groupByModel", () => {
	it("folds every pricing of a model into one entry", () => {
		const models = groupByModel(buildSeries(points));
		expect(models.map((m) => [m.id, m.series.length])).toEqual([
			[haiku, 3],
			[opus, 2],
		]);
	});

	it("starts a model's label at its rightmost line end", () => {
		const [first] = groupByModel(buildSeries(points));
		expect(modelEnd(first).costPerTaskUsd).toBe(0.2);
	});
});
