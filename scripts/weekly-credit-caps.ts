// Rate-window plans that bill each model in the vendor's own credits against
// a weekly credit quota. The quota at the model's credit rates, priced at
// list, is the plan's estimated weekly cap.

import type { ReportedCap } from "../src/domain/model.ts";
import { listPriced, type TokenRates } from "./list-price.ts";

export type WeeklyCreditPlan = {
	weeklyCredits: number;
	/** Credits per million tokens, by family. */
	rates: Record<string, TokenRates>;
	by: string;
	url: string;
	basis: string;
};

/** Each family's weekly cap in list-priced dollars, as an estimate. */
export function weeklyCreditCap(
	plan: WeeklyCreditPlan,
	families: readonly string[],
	listRates: (family: string) => TokenRates,
): ReportedCap {
	return {
		weeklyCapApiUsdByFamily: Object.fromEntries(
			families.map((family) => {
				const rates = plan.rates[family];
				if (!rates) throw new Error(`${family}: no credit rate`);
				return [
					family,
					listPriced(plan.weeklyCredits, rates, listRates(family)),
				];
			}),
		),
		by: plan.by,
		url: plan.url,
		basis: plan.basis,
	};
}

const ZAI_DOCS = "https://docs.z.ai/devpack/overview";

/**
 * Z.ai's usage multipliers, per 10,000 credits a token (docs, 2026-11-15):
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
		basis: `${weeklyCredits.toLocaleString("en-US")} weekly credits at Z.ai's per-token credit rates, valued at list price, at peak hours. Off-peak usage costs half the credits, so up to twice this`,
	};
}

/** Every shipped weekly-credit plan, by plan id. */
export const WEEKLY_CREDIT_PLANS: Record<string, WeeklyCreditPlan> = {
	"zai-glm-coding-lite": zai(10_000),
	"zai-glm-coding-pro": zai(60_000),
	"zai-glm-coding-max": zai(140_000),
};
