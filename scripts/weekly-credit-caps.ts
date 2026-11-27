// Plans that bill each model in vendor credits against a weekly quota: the
// quota at the model's credit rates, priced at list, is the estimated cap.

import { Effect } from "effect";
import type { ReportedCap } from "../src/domain/model.ts";
import { listPriced, type ListRates, type TokenRates } from "./list-price.ts";
import { PlanDataError } from "./plan-offers.ts";

export type WeeklyCreditPlan = {
	weeklyCredits: number;
	/** Credits per million tokens, by family. */
	rates: Record<string, TokenRates>;
	by: string;
	url: string;
	basis: string;
};

/** Each family's weekly cap in list-priced dollars, as an estimate. */
export const weeklyCreditCap = Effect.fnUntraced(function* (
	plan: WeeklyCreditPlan,
	families: readonly string[],
	listRates: ListRates,
) {
	return {
		weeklyCapApiUsdByFamily: Object.fromEntries(
			yield* Effect.forEach(
				families,
				Effect.fnUntraced(function* (family) {
					const rates = plan.rates[family];
					if (!rates)
						return yield* new PlanDataError({
							message: `${family}: no credit rate`,
						});
					return [
						family,
						listPriced(plan.weeklyCredits, rates, yield* listRates(family)),
					] as const;
				}),
			),
		),
		by: plan.by,
		url: plan.url,
		basis: plan.basis,
	} satisfies ReportedCap;
});

const ZAI_DOCS = "https://docs.z.ai/devpack/overview";

/**
 * Z.ai's usage multipliers, in credits per 10,000 tokens (docs, 2026-11-15):
 * GLM-5.3 6.9 in and 24 out, GLM-5.3-Flash 2.3 and 8. Per million tokens
 * that is 100 times the multiplier.
 */
const ZAI_RATES: Record<string, TokenRates> = {
	"glm-5-3": [690, 2400],
	"glm-5-3-flash": [230, 800],
};

function zai(weeklyCredits: number): WeeklyCreditPlan {
	return {
		weeklyCredits,
		rates: ZAI_RATES,
		by: "Z.ai",
		url: ZAI_DOCS,
		basis: `${weeklyCredits.toLocaleString("en-US")} weekly credits at Z.ai's per-token credit rates, valued at list price (input and output blended 3:1, no cache discount), at peak hours. Off-peak usage costs half the credits, so up to twice this`,
	};
}

/** Every shipped weekly-credit plan, by plan id. */
export const WEEKLY_CREDIT_PLANS: Record<string, WeeklyCreditPlan> = {
	"zai-glm-coding-lite": zai(10_000),
	"zai-glm-coding-pro": zai(60_000),
	"zai-glm-coding-max": zai(140_000),
};
