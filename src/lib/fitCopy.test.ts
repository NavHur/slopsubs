import { describe, expect, it } from "vite-plus/test";
import { leaderboards } from "#/data";
import type { FamilyId } from "#/domain/model";
import { type PlanShort, recommendPlans } from "#/domain/recommend";
import { type FitSearch, fitInputs, fitWorkload, SIZED_PLANS } from "./fit";
import {
	answersSummary,
	baselineLine,
	formatShare,
	shortDetail,
	unpricedLine,
	verdictHeadline,
} from "./fitCopy";

const opus = "claude-opus-5-5" as FamilyId;
const fable = "claude-fable-5-2" as FamilyId;
const terra = "gpt-6-1-terra" as FamilyId;
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
			/^No plan within your \$50 budget covers this week\. .+ does, at \$\d+(\.\d+)? a month\.$/,
		);
	});

	it("says paying per token is cheaper when it beats the over-budget plan and fits the budget", () => {
		const { result } = answer({ unit: "apiUsd", amount: 1, budget: 5 });
		expect(result.fits).toEqual([]);
		expect(verdictHeadline(result)).toBe(
			"Paying per token is cheaper: about $4.33 a month, within your $5 budget.",
		);
	});

	it("says so when paying per token beats the plans but still tops the budget", () => {
		const { result } = answer({ unit: "apiUsd", amount: 1.5, budget: 5 });
		expect(verdictHeadline(result)).toBe(
			"Paying per token is cheaper: about $6.5 a month, though that is over your $5 budget.",
		);
	});

	it("says a $1 budget leaves no plan, not that none can be sized", () => {
		const { result } = answer({ models: [fable], amount: 500, budget: 1 });
		expect(verdictHeadline(result)).toBe(
			"No plan within your $1 budget covers this week. Claude Ultra does, at $200 a month.",
		);
	});

	it("qualifies the closest plan as within the budget", () => {
		const { result } = answer({ models: [fable], amount: 50_000, budget: 20 });
		expect(result.cheapestOverBudget).toBeNull();
		expect(verdictHeadline(result)).toMatch(
			/^No plan within your \$20 budget covers this week\. .+ comes closest, at (?:<1|\d+)% of it and \$[\d,]+ a month short\.$/,
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
				result.apiCheaper ? "pay off above" : "it would win if your usage fell",
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

/** A quiz week with its amount set, so it can be scaled to probe others. */
type Week = FitSearch & { amount: number };

/** Whether the cheapest plan that fits costs no more than paying per token. */
function planWinsAt(fit: Week, scale: number) {
	const { result } = answer({ ...fit, amount: fit.amount * scale });
	return result.fits.length > 0 && !result.apiCheaper;
}

/** Scales strictly between 1 and the quote, whichever is higher. */
function between(scale: number): number[] {
	return [0.1, 0.5, 0.9].map((part) => 1 + (scale - 1) * part);
}

/** Past the quote the other side wins; between it and the week, this side. */
function expectSideChangesAt(fit: Week, scale: number) {
	const now = planWinsAt(fit, 1);
	const justPast = scale * (now ? 0.999 : 1.001);
	expect(planWinsAt(fit, justPast)).toBe(!now);
	for (const s of between(scale)) expect(planWinsAt(fit, s)).toBe(now);
}

describe("the quoted crossing", () => {
	const week = (fit: Week) => fit;
	const cases = [
		[
			"Terra at high effort, a plan already wins",
			week({ models: [terra], unit: "tasks", amount: 10, effort: "high" }),
		],
		[
			"Terra at high effort, paying per token wins",
			week({ models: [terra], unit: "tasks", amount: 14, effort: "high" }),
		],
		[
			"Terra with reasoning off, per token wins",
			week({ models: [terra], unit: "tasks", amount: 10, effort: "none" }),
		],
		[
			"Terra with reasoning off, a plan wins",
			week({ models: [terra], unit: "tasks", amount: 13, effort: "none" }),
		],
		[
			"a light Fable week",
			week({ models: [fable], unit: "apiUsd", amount: 1 }),
		],
		[
			"a Fable week a plan covers",
			week({ models: [fable], unit: "apiUsd", amount: 9.3 }),
		],
		["the default Opus week", week({ amount: 250 })],
		["a light Opus week", week({ unit: "apiUsd", amount: 3 })],
	] as const;

	it.each(cases)("sits on the far side of the visitor's week: %s", (_, fit) => {
		const { result } = answer(fit);
		const scale = result.breakEvenScale ?? (result.apiCheaper ? 2 : 0.5);
		expect(result.apiCheaper ? scale > 1 : scale <= 1).toBe(true);
	});

	it.each(cases)("is where the cheaper side changes: %s", (_, fit) => {
		const scale = answer(fit).result.breakEvenScale;
		if (scale !== null) expectSideChangesAt(fit, scale);
	});

	it("puts Terra's light week on the plan side of the quote", () => {
		const { inputs, result } = answer(cases[0][1]);
		const line = baselineLine(result, inputs, BENCHMARK);
		expect(result.apiCheaper).toBe(false);
		expect(line).toMatch(
			/it would win if your usage fell to about \d\.?\d* Intelligence Index tasks a week\.$/,
		);
	});

	it("doesn't call the API cheaper at every lower week when bands are disjoint", () => {
		const terraAt = (amount: number): Week => ({
			models: [terra],
			unit: "tasks",
			amount,
			effort: "high",
		});
		// Plans win at 10 and at 20 tasks, the API in between.
		expect([10, 14, 20].map((n) => planWinsAt(terraAt(n), 1))).toEqual([
			true,
			false,
			true,
		]);
		const { inputs, result } = answer(terraAt(20));
		const line = baselineLine(result, inputs, BENCHMARK);
		expect(line).toMatch(
			/^Paying per token would cost about \$\d+(\.\d+)? a month; /,
		);
		expect(line).toMatch(
			/it would win if your usage fell to about 1[5-9](\.\d)? Intelligence Index tasks a week\.$/,
		);
		expect(line).not.toContain("cheaper below");
	});

	it("tells a light non-reasoning Terra week a plan pays off near 11 tasks", () => {
		const { inputs, result } = answer(cases[2][1]);
		expect(result.apiCheaper).toBe(true);
		expect(baselineLine(result, inputs, BENCHMARK)).toMatch(
			/^A plan starts to pay off above about 1[01](\.\d)? Intelligence Index tasks a week\.$/,
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

describe("a week with reasoning off", () => {
	const week: FitSearch = {
		models: [terra],
		unit: "tasks",
		amount: 10,
		effort: "none",
	};

	it("prices Terra's tasks at its non-reasoning cost", () => {
		const { inputs, result } = answer(week);
		// 10 tasks a week at $0.2259, over 52/12 weeks a month.
		expect(result.apiUsdPerMonth).toBeCloseTo(9.79, 2);
		expect(answersSummary(inputs, BENCHMARK)).toBe(
			"GPT-6.1 Terra · 10 Intelligence Index tasks a week with reasoning off · no budget",
		);
	});

	it("beats a $10 plan on API cost", () => {
		const { result } = answer(week);
		expect(result.apiCheaper).toBe(true);
	});

	it("won't price a model with no non-reasoning point", () => {
		const inputs = fitInputs({ ...week, models: [opus] });
		const result = recommendPlans({
			plans: SIZED_PLANS,
			points: leaderboards.intelligence.models,
			workload: fitWorkload(inputs),
		});
		if (result.kind !== "unpriced") throw new Error(result.kind);
		expect(unpricedLine(result, inputs, BENCHMARK)).toMatch(
			/^Intelligence Index has no non-reasoning cost for Opus 5\.5,/,
		);
	});
});

describe("formatShare", () => {
	it("never calls a partial share 0% or 100%", () => {
		expect(formatShare(49.75 / 50)).toBe(">99%");
		expect(formatShare(0.25 / 50)).toBe("1%");
		expect(formatShare(0.0008)).toBe("<1%");
		expect(formatShare(1)).toBe("100%");
		expect(formatShare(0)).toBe("0%");
		expect(formatShare(0.4)).toBe("40%");
	});
});
