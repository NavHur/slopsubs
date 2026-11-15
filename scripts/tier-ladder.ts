// Scales one known tier's cap to its sibling tiers by the vendor's own
// multiples, such as Claude Max's "5x Pro" against Ultra's "10x Pro".

import type { ReportedCap } from "../src/domain/model.ts";

/** A plan's usage as a multiple of its ladder's base tier, per the vendor. */
export type Tier = { ladder: string; times: number };

/**
 * The one tier of a ladder whose weekly cap someone reported. `base` names the
 * tier the vendor's multiples count from, as in "5x Pro".
 */
export type KnownTier = {
	label: string;
	base: string;
	times: number;
	/** The tier's own report, keyed by plain family ids. */
	cap: Omit<ReportedCap, "weeklyCapApiUsdByFamily"> & {
		weeklyCapApiUsdByFamily: Record<string, number>;
	};
};

/**
 * The known tier's per-model caps, scaled to a tier `times` the base tier's
 * usage. Every family must have a known figure, so no model drops silently.
 */
export function scaledCap(
	known: KnownTier,
	tier: { label: string; times: number },
	families: readonly string[],
): ReportedCap {
	const scale = tier.times / known.times;
	return {
		...known.cap,
		weeklyCapApiUsdByFamily: Object.fromEntries(
			families.map((family) => {
				const cap = known.cap.weeklyCapApiUsdByFamily[family];
				if (cap === undefined)
					throw new Error(
						`${tier.label}: no ${known.label} figure for ${family}`,
					);
				return [family, cap * scale];
			}),
		),
		basis:
			scale === 1
				? known.cap.basis
				: `${known.cap.basis}, scaled from ${usage(known, known.base)} to ${usage(tier, known.base)}`,
	};
}

/** "Max's 5x Pro", or just "Pro" for the base tier itself. */
function usage(tier: { label: string; times: number }, base: string): string {
	return tier.times === 1
		? tier.label
		: `${tier.label}'s ${tier.times}x ${base}`;
}
