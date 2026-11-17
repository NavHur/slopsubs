// Muse Code's weekly caps, per model, from our own gauge readings on the
// Everyday tier: research/plans.md ("Muse Code's cap, from our gauge readings").

import { OUR_GAUGE_READINGS } from "../src/domain/enums.ts";
import type { KnownTier } from "./tier-ladder.ts";

const READINGS =
	"https://github.com/NavHur/slopsubs/blob/main/research/plans.md";

/** dev.meta.ai/products/muse-code: High "5x", Power "20x" and Maximum "80x
 * more usage than the Everyday Usage plan". */
export const MUSE_TIMES_EVERYDAY = {
	everyday: 1,
	high: 5,
	power: 20,
	maximum: 80,
} as const;

/** The weekly gauge rose a third as fast as the 5-hour window in every
 * reading, so a full week holds three full windows. */
const WINDOWS_PER_WEEK = 3;

/**
 * One prompt run several times on a model in Muse Code, contributor mode on:
 * the 5-hour window it used up, and what one run costs at Meta's list price.
 * Every run read about 39K input tokens and wrote a few hundred.
 */
type GaugeReading = {
	runs: number;
	windowPercent: number;
	listUsdPerRun: number;
};

// 2026-11-16, Muse Code 1.4.20, `high` effort. The gauge shows whole percents.
const EVERYDAY_READINGS: Record<string, GaugeReading> = {
	// Routed to muse-wonder-1.0-contributor: 28% -> 31% -> 34%.
	"muse-wonder": { runs: 2, windowPercent: 6, listUsdPerRun: 0.16 },
	// Routed to muse-spark-1.3-contributor: 25% -> 26%.
	"muse-spark-1-3": { runs: 5, windowPercent: 1, listUsdPerRun: 0.05 },
	// No contributor variant, so both toggle states: 24% -> 25%, 26% -> 28%.
	"muse-ember": { runs: 10, windowPercent: 3, listUsdPerRun: 0.004 },
};

/** List-priced usage that fills a whole weekly gauge, from one reading. */
function weeklyCapUsd({ runs, windowPercent, listUsdPerRun }: GaugeReading) {
	const windowUsd = (runs * listUsdPerRun * 100) / windowPercent;
	return windowUsd * WINDOWS_PER_WEEK;
}

/** Everyday's weekly gauge in list-priced usage, by model: the known tier the
 * higher Muse Code tiers scale from. */
export const MUSE_EVERYDAY: KnownTier = {
	label: "Everyday",
	base: "Everyday",
	times: MUSE_TIMES_EVERYDAY.everyday,
	cap: {
		weeklyCapApiUsdByFamily: Object.fromEntries(
			Object.entries(EVERYDAY_READINGS).map(([family, reading]) => [
				family,
				weeklyCapUsd(reading),
			]),
		),
		by: OUR_GAUGE_READINGS,
		url: READINGS,
		basis: "Our Everyday gauge readings, contributor mode on",
	},
};
