// Claude's reported weekly caps, per model, from Theo's Ultra measurement.

import type { KnownTier } from "./tier-ladder.ts";

// Theo's 2026-11-11 Ultra measurement: figures in research/plans.md ("Claude's
// cap differs by model"), chart at research/theo-claude-ultra-2026-11.png.
const THEO_ULTRA = "https://x.com/theo/status/2119960608816988596";
const THEO_WEEKS_PER_MONTH = 30 / 7;
const ULTRA_OPUS_WEEKLY_USD = 3421;
const ULTRA_FABLE_5_2_MONTHLY_USD = 3021;
/** Theo measured Fable held to half of each week. */
const THEO_FABLE_SHARE = 0.5;
/** The pricing page: "Max 5x Pro, Ultra 10x Pro" weekly usage. */
export const CLAUDE_TIMES_PRO = { pro: 1, max: 5, ultra: 10 } as const;

/** API-priced usage that fills a whole weekly gauge, from a month of a model
 * held to `share` of the gauge. */
function fullGaugeWeekUsd(monthlyUsd: number, share: number): number {
	return monthlyUsd / THEO_WEEKS_PER_MONTH / share;
}

/**
 * Ultra's weekly gauge in API-priced usage, by model: the known tier the
 * other Claude plans scale from. Theo measured only Opus and Fable, so Sonnet
 * and Haiku assume Opus's rate.
 */
export const CLAUDE_ULTRA: KnownTier = {
	label: "Ultra",
	base: "Pro",
	times: CLAUDE_TIMES_PRO.ultra,
	cap: {
		weeklyCapApiUsdByFamily: {
			"claude-opus-5-5": ULTRA_OPUS_WEEKLY_USD,
			"claude-sonnet-5-5": ULTRA_OPUS_WEEKLY_USD,
			"claude-haiku-5-5": ULTRA_OPUS_WEEKLY_USD,
			"claude-fable-5-2": fullGaugeWeekUsd(
				ULTRA_FABLE_5_2_MONTHLY_USD,
				THEO_FABLE_SHARE,
			),
		},
		by: "Theo",
		url: THEO_ULTRA,
		basis: "Theo measured Ultra from 1.1M requests",
	},
};
