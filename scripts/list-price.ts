// Converts usage billed at a vendor's own token rates into list-priced (API)
// dollars, the unit every plan's allowance is compared in.

import type { Effect } from "effect";
import type { PlanDataError } from "./plan-offers.ts";

/** [input, output] per million tokens. */
export type TokenRates = [input: number, output: number];

/** Artificial Analysis's blend: three input tokens per output token. */
export function blendedPrice([input, output]: TokenRates): number {
	return (3 * input + output) / 4;
}

/**
 * List-priced dollars that `amount` of usage buys at the vendor's `rates`:
 * the same tokens, priced at `list` instead. `amount` and `rates` share the
 * vendor's unit, which may be dollars or the vendor's own credits.
 */
export function listPriced(
	amount: number,
	rates: TokenRates,
	list: TokenRates,
): number {
	return (amount / blendedPrice(rates)) * blendedPrice(list);
}

export type ListRates = (
	family: string,
) => Effect.Effect<TokenRates, PlanDataError>;
