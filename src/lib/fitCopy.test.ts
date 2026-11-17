import { describe, expect, it } from "vite-plus/test";
import { leaderboards } from "#/data";
import type { FamilyId } from "#/domain/model";
import { type PlanShort, recommendPlans } from "#/domain/recommend";
import { type FitSearch, fitInputs, fitWorkload, SIZED_PLANS } from "./fit";
import { baselineLine, shortDetail, verdictHeadline } from "./fitCopy";

const opus = "claude-opus-5-5" as FamilyId;
const fable = "claude-fable-5-2" as FamilyId;
const BENCHMARK = "Intelligence Index";

function answer(fit: FitSearch | undefined) {
	const inputs = fitInputs(fit);
	const result = recommendPlans({
		plans: SIZED_PLANS,
		points: leaderboards.intelligence.models,
		workload: fitWorkload(inputs),
	});
	if (result.kind !== "ranked") throw new Error(`unexpected ${result.kind}`);
	return { inputs, result };
}

describe("verdictHeadline", () => {
	it("names the cheapest over-budget plan when the budget leaves none", () => {
		const { result } = answer({ models: [fable], amount: 500, budget: 100 });
		expect(verdictHeadline(result)).toBe(
			"No plan within your $100 budget covers this week. Claude Ultra does, at $200 a month.",
		);
	});

	it("does the same for the default models at a tighter budget", () => {
		const { result } = answer({ amount: 500, budget: 50 });
		expect(verdictHeadline(result)).toMatch(
			/^No plan within your \$50 budget covers this week\. .+ does, at \$\d+ a month\.$/,
		);
	});

	it("keeps saying no plan covers a week that is too big with no budget", () => {
		const { result } = answer({ models: [fable], amount: 50_000 });
		expect(verdictHeadline(result)).toMatch(/^No single plan covers this week/);
	});
});

describe("the verdict and the baseline", () => {
	it.each([1, 1.3, 1.4, 50])(
		"don't contradict at %s tasks a week",
		(amount) => {
			const { inputs, result } = answer({ unit: "tasks", amount });
			const scale = result.breakEvenScale ?? 0;
			// Per token wins exactly below the quoted crossing.
			expect(result.apiCheaper).toBe(scale > 1);
			expect(verdictHeadline(result)).toContain(
				result.apiCheaper ? "Paying per token is cheaper" : "fits with",
			);
			expect(baselineLine(result, inputs, BENCHMARK)).toContain(
				result.apiCheaper ? "pay off above" : "cheaper only below",
			);
		},
	);

	it("quotes Claude Pro's crossing for the default week", () => {
		const { inputs, result } = answer({ unit: "tasks", amount: 1 });
		expect(baselineLine(result, inputs, BENCHMARK)).toBe(
			"A plan starts to pay off above about 1.3 Intelligence Index tasks a week.",
		);
	});
});

describe("shortDetail", () => {
	const short = (families: FamilyId[], binding: FamilyId): PlanShort => ({
		plan: SIZED_PLANS[0].plan,
		families,
		basis: "measured",
		kind: "short",
		binding,
		coverage: 0.5,
		shortUsdPerMonth: 40,
	});

	it("names the model once when it is also the one that runs out", () => {
		expect(shortDetail(short([opus], opus), true)).toBe(
			"Opus 5.5 runs out first, $40 a month short",
		);
	});

	it("still names the model an any-flagship week runs when another binds", () => {
		expect(shortDetail(short([opus], fable), true)).toBe(
			"runs Opus 5.5, Fable 5.2 runs out first, $40 a month short",
		);
	});
});
