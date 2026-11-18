// OpenCode Go's monthly usage, which build-plans values at list price as a
// published allowance, and the promotions that allowance counts.

import type { Promotion } from "../src/domain/model.ts";
import { listPriced, type TokenRates } from "./list-price.ts";

/** Go is tier 0 and Go Plus tier 1, the order of a family's usage pair. */
export type GoTier = 0 | 1;

/** A limited-time discount on one family's token prices. */
type GoPricePromo = { prices: TokenRates; promotion: Promotion };

export type GoPricing = {
	/** Each family's regular monthly usage as [Go, Go Plus], in dollars at
	 * Go's token prices. */
	usageUsd: Record<string, [go: number, goPlus: number]>;
	/** Go's regular rates where they differ from the list price. */
	offListRates: Record<string, TokenRates>;
	promos: Record<string, GoPricePromo>;
};

export type GoPlan = {
	apiUsdPerMonthByFamily: Record<string, number>;
	promotionByFamily: Record<string, Promotion>;
};

/** A tier's monthly usage in list-priced (API) dollars, and the promotions
 * it counts for the families the plan lists. */
export function goPlan(
	pricing: GoPricing,
	tier: GoTier,
	families: readonly string[],
	listRates: (family: string) => TokenRates,
): GoPlan {
	return {
		apiUsdPerMonthByFamily: Object.fromEntries(
			Object.entries(pricing.usageUsd).map(([family, usd]) => [
				family,
				listPricedUsd(pricing, family, usd[tier], listRates),
			]),
		),
		promotionByFamily: Object.fromEntries(
			Object.entries(pricing.promos)
				.filter(([family]) => families.includes(family))
				.map(([family, p]) => [family, p.promotion]),
		),
	};
}

/** Converts a Go-priced dollar allowance into list-priced (API) dollars. */
function listPricedUsd(
	pricing: GoPricing,
	family: string,
	goUsd: number,
	listRates: (family: string) => TokenRates,
): number {
	const goRates =
		pricing.promos[family]?.prices ?? pricing.offListRates[family];
	return goRates ? listPriced(goUsd, goRates, listRates(family)) : goUsd;
}
