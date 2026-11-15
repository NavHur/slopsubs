import { describe, expect, it } from "vite-plus/test";
import plansJson from "../src/data/plans.json";
import type { FamilyId, Plan, PlanId } from "../src/domain/model.ts";
import {
	planCapacity,
	valueMultiple,
	weeklyAllowance,
} from "../src/domain/value.ts";
import {
	type CreditPlan,
	creditAllowance,
	creditPromotions,
} from "./credit-plans.ts";
import type { TokenRates } from "./list-price.ts";

const WEEKS_PER_MONTH = 52 / 12;
const sonnet = "claude-sonnet-5-5" as FamilyId;
const argon = "gemini-4-argon" as FamilyId;

const LIST: Record<string, TokenRates> = {
	[sonnet]: [2, 10],
	[argon]: [4, 20],
};
const listRates = (family: string) => LIST[family];

const copilot: CreditPlan = {
	monthlyCredit: 15,
	unit: "usd",
	rates: {},
	promos: {
		[argon]: {
			rates: [2, 10],
			promotion: {
				summary: "half price",
				endsOn: "2026-11-30",
				url: "https://example.com/rates",
			},
		},
	},
	url: "https://example.com/plans",
	basis: (price) => `$15 of usage at list price for $${price}`,
};

/** A shipped plan around a credit plan's allowance. */
function shipped(credit: CreditPlan, priceUsd: number): Plan {
	return {
		id: "copilot-pro" as PlanId,
		vendor: "Copilot",
		lab: "github",
		label: "Copilot Pro",
		monthlyPriceUsd: priceUsd,
		harnesses: ["Copilot CLI"],
		families: [sonnet, argon],
		limits: "1,500 credits",
		allowanceKind: "credit",
		includedApiCreditUsd: 0,
		thirdPartyHarnessAllowed: true,
		confidence: "primary",
		sourceUrl: "https://example.com/plans",
		reportedCap: null,
		publishedAllowance: creditAllowance(
			credit,
			priceUsd,
			[sonnet, argon],
			listRates,
		),
		weeklyShareByFamily: {},
		maxEffortByFamily: {},
		promotionByFamily: creditPromotions(credit, [sonnet, argon]),
	};
}

describe("a credit plan", () => {
	const plan = shipped(copilot, 10);
	const capacity = planCapacity(plan, []);
	const sonnetAllowance = weeklyAllowance(plan, capacity, sonnet);

	it("gives a list-priced model the credit over the weeks of a month", () => {
		expect(sonnetAllowance?.apiUsd).toBeCloseTo(15 / WEEKS_PER_MONTH);
		expect(sonnetAllowance?.basis).toBe("published");
	});

	it("is worth its credit ratio over the API", () => {
		if (!sonnetAllowance) throw new Error("no allowance");
		expect(valueMultiple({ plan, allowance: sonnetAllowance })).toBeCloseTo(
			1.5,
		);
	});

	it("stretches the credit over a promoted model's discount", () => {
		const promoted = weeklyAllowance(plan, capacity, argon);
		if (!promoted) throw new Error("no allowance");
		expect(valueMultiple({ plan, allowance: promoted })).toBeCloseTo(3);
		expect(plan.promotionByFamily[argon]?.summary).toBe("half price");
	});

	it("counts only the promotions of models the plan includes", () => {
		expect(creditPromotions(copilot, [sonnet])).toEqual({});
		expect(Object.keys(creditPromotions(copilot, [sonnet, argon]))).toEqual([
			argon,
		]);
	});

	it("divides a model billed above list price by the markup", () => {
		const marked: CreditPlan = {
			...copilot,
			promos: {},
			rates: { [sonnet]: [4, 20] },
		};
		const allowance = creditAllowance(marked, 10, [sonnet], listRates);
		expect(allowance.apiUsdPerMonthByFamily[sonnet]).toBeCloseTo(7.5);
	});

	it("says what the credit buys for the plan's price", () => {
		expect(plan.publishedAllowance?.basis).toBe(
			"$15 of usage at list price for $10",
		);
	});
});

describe("a credit plan in the vendor's own credits", () => {
	const mimo: CreditPlan = {
		monthlyCredit: 4.1e9,
		unit: "credits",
		rates: { [sonnet]: [300e6, 600e6] },
		promos: {},
		url: "https://example.com/mimo",
		basis: () => "credits",
	};

	it("values the credits' tokens at list price", () => {
		const allowance = creditAllowance(mimo, 6, [sonnet], listRates);
		// 4.1B credits buy 4.1e9 / 375e6 MTok at the 3:1 blend, $4 a MTok at list.
		expect(allowance.apiUsdPerMonthByFamily[sonnet]).toBeCloseTo(
			(4.1e9 / 375e6) * 4,
		);
	});

	it("refuses a model it has no credit rate for", () => {
		expect(() => creditAllowance(mimo, 6, [argon], listRates)).toThrow(
			/gemini-4-argon: no credit rate/,
		);
	});
});

describe("the shipped Ollama plans", () => {
	it.each(["ollama-pro", "ollama-max"])(
		"%s credits Muse Spark Open, which its rate table lists",
		(id) => {
			const plan = plansJson.find((p) => p.id === id);
			const credit =
				plan?.publishedAllowance?.apiUsdPerMonthByFamily["muse-spark-open"];
			expect(credit).toBeGreaterThan(0);
		},
	);
});
