import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import type { FamilyId, Plan } from "#/domain/model";
import type {
	PlanFit,
	PlanShort,
	RankedRecommendation as Ranked,
} from "#/domain/recommend";
import { fitInputs } from "#/lib/fit";
import { FitResults } from "./FitResults";

const argon = "gemini-4-argon" as FamilyId;
const opus = "claude-opus-5-5" as FamilyId;

/** A plan that carries a promotion on Gemini 4 Argon only. */
const promoted = {
	id: "test-plan",
	vendor: "Test",
	label: "Test Plan",
	monthlyPriceUsd: 20,
	sourceUrl: "https://example.com/pricing",
	reportedCap: null,
	publishedAllowance: null,
	promotionByFamily: {
		[argon]: {
			summary: "Test bills Gemini 4 Argon at 50% off",
			endsOn: "2026-11-30",
			url: "https://example.com/model-pricing",
		},
	},
} as unknown as Plan;

const fit = (families: FamilyId[]) =>
	({
		kind: "fits",
		plan: promoted,
		families,
		basis: "published",
		capUse: 0.5,
		creditUsdPerMonth: 0,
	}) as PlanFit;

const short = (families: FamilyId[]) =>
	({
		kind: "short",
		plan: promoted,
		families,
		basis: "published",
		coverage: 0.5,
		binding: families[0],
		shortUsdPerMonth: 10,
	}) as PlanShort;

function ranked(overrides: Partial<Ranked>): Ranked {
	return {
		kind: "ranked",
		apiUsdPerMonth: 100,
		apiCheaper: false,
		breakEvenScale: null,
		monthlyBudgetUsd: null,
		fits: [],
		cheapestOverBudget: null,
		short: [],
		unsized: [],
		gaps: [],
		overBudget: [],
		...overrides,
	};
}

function html(result: Ranked, search: Parameters<typeof fitInputs>[0]) {
	return renderToStaticMarkup(
		<FitResults
			result={result}
			inputs={fitInputs(search)}
			benchmarkName="Intelligence Index"
		/>,
	);
}

describe("FitResults promotions", () => {
	it("shows a row only the promotions of the models its own verdict ran, in Any flagship", () => {
		const any = { any: true };
		const result = (families: FamilyId[]) =>
			ranked({ fits: [fit(families)], short: [short(families)] });
		expect(html(result([opus]), any)).not.toContain("Promo");
		expect(html(result([argon]), any).match(/Promo until/g)).toHaveLength(2);
	});

	it("shows the promotion behind the over-budget plan the headline names", () => {
		const overBudget = (families: FamilyId[]) =>
			ranked({ cheapestOverBudget: fit(families), monthlyBudgetUsd: 10 });
		const search = { budget: 10 };
		const withPromo = html(overBudget([argon]), search);
		expect(withPromo).toContain("Test Plan does, at $20 a month.");
		expect(withPromo).toContain("Promo until Nov 30, 2026:");
		expect(withPromo).toContain("https://example.com/model-pricing");
		expect(html(overBudget([opus]), search)).not.toContain("Promo");
	});

	it("leaves out an over-budget plan's promotion when a plan in budget fits", () => {
		const result = ranked({
			fits: [fit([opus])],
			cheapestOverBudget: fit([argon]),
			monthlyBudgetUsd: 10,
		});
		expect(html(result, { budget: 10 })).not.toContain("Promo");
	});
});
