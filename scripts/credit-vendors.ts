// Each credit plan's monthly credit and the rates it is spent at, from the
// vendors' own pages (accessed 2026-11-15; research/plans/ cites them).

import type { CreditPlan } from "./credit-plans.ts";
import type { TokenRates } from "./list-price.ts";

const COPILOT_PLANS = "https://docs.github.com/en/copilot/get-started/plans";
const COPILOT_RATES =
	"https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing";

/** Copilot's per-token prices match list price, except promotions. */
const COPILOT_GEMINI_PROMO = (model: string) => ({
	rates: [2, 10] as TokenRates,
	promotion: {
		summary: `Copilot bills ${model} at 50% off, doubling its usage`,
		endsOn: "2026-11-30",
		url: COPILOT_RATES,
	},
});
const COPILOT_PROMOS = {
	"gemini-4-argon": COPILOT_GEMINI_PROMO("Gemini 4 Argon"),
	"gemini-4-carbon": COPILOT_GEMINI_PROMO("Gemini 4 Carbon"),
};

const count = (n: number) => n.toLocaleString("en-US");

/** "1 AI credit = $0.01 USD", base plus flex credits a month. */
function copilot(baseCredits: number, flexCredits: number): CreditPlan {
	const usd = (baseCredits + flexCredits) / 100;
	return {
		monthlyCredit: usd,
		unit: "usd",
		rates: {},
		promos: COPILOT_PROMOS,
		url: COPILOT_PLANS,
		basis: (priceUsd) =>
			`$${usd} of usage at list price for $${priceUsd}: ${count(baseCredits)} base and ${count(flexCredits)} flex AI credits of $0.01, and GitHub says flex may change`,
	};
}

/** Ollama's rate table matches list price except MiniMax M3, at twice it. */
function ollama(creditUsd: number): CreditPlan {
	return {
		monthlyCredit: creditUsd,
		unit: "usd",
		rates: { "minimax-m3": [0.6, 2.4] },
		promos: {},
		url: "https://ollama.com/pricing",
		basis: (priceUsd) =>
			`$${creditUsd} of usage credits a month for $${priceUsd}, at Ollama's per-model rates: list price, except MiniMax M3 at twice it`,
	};
}

/** Every shipped credit plan, by plan id. */
export const CREDIT_PLANS: Record<string, CreditPlan> = {
	"copilot-pro": copilot(1000, 500),
	"copilot-pro-plus": copilot(3900, 3100),
	"copilot-max": copilot(10000, 10000),
	"ollama-pro": ollama(60),
	"ollama-max": ollama(300),
};
