// Claude's reported weekly caps, per model, from Theo's Ultra measurement.

import type { ReportedCap } from "../src/domain/model.ts";
import { PLAN_FAMILIES } from "./plan-families.ts";

// Theo (t3.gg), "What $200 of Claude Ultra gets you", 2026-11-11: one Ultra
// account at API list prices, measured from 1.1M proxied requests, Aug 11 to
// Nov 9, 2026. "One week of only Opus 5.5 is worth $3,421." Fable "has its own
// limit, and it is half of each week": a 30-day month of only Fable 5.2 is
// worth $3,021, and of Fable 5.1 $2,197, which Max and Ultra no longer serve.
const THEO_ULTRA =
	"https://github.com/NavHur/slopsubs/blob/main/research/theo-claude-ultra-2026-11.png";
const THEO_WEEKS_PER_MONTH = 30 / 7;
const ULTRA = "claude-max-20x";
const ULTRA_PRICE_USD = 200;
const ULTRA_OPUS_WEEKLY_USD = 3421;
const ULTRA_FABLE_5_2_MONTHLY_USD = 3021;

/** API-priced usage that fills a whole weekly gauge, from a month of a model
 * held to `share` of the gauge. */
function fullGaugeWeekUsd(monthlyUsd: number, share: number): number {
	return monthlyUsd / THEO_WEEKS_PER_MONTH / share;
}

const fableShare =
	PLAN_FAMILIES[ULTRA].weeklyShareByFamily?.["claude-fable-5-2"] ?? 1;

/**
 * API-priced usage that fills Ultra's weekly gauge, by model. Theo measured
 * only Opus and Fable, so Sonnet and Haiku assume Opus's rate.
 */
const ULTRA_WEEKLY_USD_BY_FAMILY: Record<string, number> = {
	"claude-opus-5-5": ULTRA_OPUS_WEEKLY_USD,
	"claude-sonnet-5-5": ULTRA_OPUS_WEEKLY_USD,
	"claude-haiku-5-5": ULTRA_OPUS_WEEKLY_USD,
	"claude-fable-5-2": fullGaugeWeekUsd(ULTRA_FABLE_5_2_MONTHLY_USD, fableShare),
};

/**
 * Ultra's per-model figures scaled to a Claude plan by price: the pricing page
 * gives Max 5x and Ultra 10x Pro's weekly usage, in step with their prices.
 */
export function claudeCap(
	monthlyPriceUsd: number,
	families: readonly string[],
): ReportedCap {
	const scale = monthlyPriceUsd / ULTRA_PRICE_USD;
	return {
		weeklyCapApiUsdByFamily: Object.fromEntries(
			families.map((family) => {
				const ultra = ULTRA_WEEKLY_USD_BY_FAMILY[family];
				if (ultra === undefined)
					throw new Error(`${family}: no Ultra figure from Theo`);
				return [family, ultra * scale];
			}),
		),
		by: "Theo",
		url: THEO_ULTRA,
		basis:
			scale === 1
				? "Theo measured Ultra from 1.1M requests"
				: `Theo's Ultra measurement from 1.1M requests, scaled to the $${monthlyPriceUsd} price`,
	};
}
