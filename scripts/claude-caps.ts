// Claude's reported weekly caps, per model, from Theo's Ultra measurement.

import type { ReportedCap } from "../src/domain/model.ts";

// Theo's 2026-11-11 Ultra measurement: figures in research/plans.md ("Claude's
// cap differs by model"), chart at research/theo-claude-ultra-2026-11.png.
const THEO_ULTRA = "https://x.com/theo/status/2119960608816988596";
const THEO_WEEKS_PER_MONTH = 30 / 7;
const ULTRA_PRICE_USD = 200;
const ULTRA_OPUS_WEEKLY_USD = 3421;
const ULTRA_FABLE_5_2_MONTHLY_USD = 3021;
/** Theo measured Fable held to half of each week. */
const THEO_FABLE_SHARE = 0.5;

/** API-priced usage that fills a whole weekly gauge, from a month of a model
 * held to `share` of the gauge. */
function fullGaugeWeekUsd(monthlyUsd: number, share: number): number {
	return monthlyUsd / THEO_WEEKS_PER_MONTH / share;
}

/**
 * API-priced usage that fills Ultra's weekly gauge, by model. Theo measured
 * only Opus and Fable, so Sonnet and Haiku assume Opus's rate.
 */
const ULTRA_WEEKLY_USD_BY_FAMILY: Record<string, number> = {
	"claude-opus-5-5": ULTRA_OPUS_WEEKLY_USD,
	"claude-sonnet-5-5": ULTRA_OPUS_WEEKLY_USD,
	"claude-haiku-5-5": ULTRA_OPUS_WEEKLY_USD,
	"claude-fable-5-2": fullGaugeWeekUsd(
		ULTRA_FABLE_5_2_MONTHLY_USD,
		THEO_FABLE_SHARE,
	),
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
