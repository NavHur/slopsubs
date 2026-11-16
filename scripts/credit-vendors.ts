// Each credit plan's credit and spend rates, from the vendors' pages (accessed
// 2026-11-15, cited in research/plans/); JetBrains publishes none, so list price.

import type { CreditPlan } from "./credit-plans.ts";
import type { TokenRates } from "./list-price.ts";

const COPILOT_PLANS = "https://docs.github.com/en/copilot/get-started/plans";
const COPILOT_RATES =
	"https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing";

/** Copilot's per-token prices match list price, except promotions. */
const COPILOT_GEMINI_PROMO = (model: string) => ({
	rates: [2, 10] satisfies TokenRates,
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
			`$${creditUsd} of usage credits a month for $${priceUsd}, at Ollama's per-model rates: list price, except MiniMax M3 at twice it. Ollama prices off-peak usage separately, which isn't counted`,
	};
}

/** "Each AI credit equals $1 USD"; JetBrains publishes no per-model rates. */
function jetbrains(credits: number): CreditPlan {
	return {
		monthlyCredit: credits,
		unit: "usd",
		rates: {},
		promos: {},
		url: "https://www.jetbrains.com/help/ai-assistant/licensing-and-subscriptions.html",
		basis: (priceUsd) =>
			`${credits} AI credits of $1 a month for $${priceUsd}. JetBrains doesn't publish its per-model rates, so this assumes list price`,
	};
}

/** "$20 of agent usage included each month at API rates". */
function warp(usd: number): CreditPlan {
	return {
		monthlyCredit: usd,
		unit: "usd",
		rates: {},
		promos: {},
		url: "https://www.warp.dev/pricing",
		basis: (priceUsd) =>
			`$${usd} of agent usage a month at API rates, for $${priceUsd}`,
	};
}

/** MiMo's credits per token: V2.6 Pro 300 in and 600 out, Flash 100 and 200. */
const MIMO_RATES: Record<string, TokenRates> = {
	"mimo-v2-6-pro": [300e6, 600e6],
	"mimo-v2-6-flash": [100e6, 200e6],
};
function mimo(billions: number): CreditPlan {
	return {
		monthlyCredit: billions * 1e9,
		unit: "credits",
		rates: MIMO_RATES,
		promos: {},
		url: "https://mimo.mi.com/static/docs/price/token-plan.md",
		basis: (priceUsd) =>
			`${billions} billion credits a month for $${priceUsd}, at MiMo's per-token credit rates, valued at list price (input and output blended 3:1, no cache discount, at peak hours)`,
	};
}

/** Every shipped credit plan, by plan id. */
export const CREDIT_PLANS: Record<string, CreditPlan> = {
	"copilot-pro": copilot(1000, 500),
	"copilot-pro-plus": copilot(3900, 3100),
	"copilot-max": copilot(10000, 10000),
	"jetbrains-ai-pro": jetbrains(10),
	"jetbrains-ai-ultimate": jetbrains(35),
	"ollama-pro": ollama(60),
	"ollama-max": ollama(300),
	"warp-build": warp(20),
	"warp-max": warp(200),
	"mimo-token-lite": mimo(4.1),
	"mimo-token-standard": mimo(11),
	"mimo-token-pro": mimo(38),
	"mimo-token-max": mimo(82),
};
