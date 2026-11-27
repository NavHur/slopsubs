import { Effect } from "effect";
import { PlanDataError } from "./plan-offers.ts";
// OpenCode Go's monthly usage, which build-plans values at list price as a
// published allowance, and the promotions that allowance counts.

import type { Promotion } from "../src/domain/model.ts";
import { listPriced, type ListRates, type TokenRates } from "./list-price.ts";

/** Go is tier 0 and Go Plus tier 1, the order of a family's usage pair. */
export type GoTier = 0 | 1;

/** A family's usage as [Go, Go Plus], in dollars at Go's token prices. */
type TierUsd = [go: number, goPlus: number];

/**
 * A limited-time offer on one family, with one effect: it either discounts
 * the family's token prices, stretching the same dollars over more tokens, or
 * raises its monthly dollars outright.
 */
type GoPromo =
	| { kind: "price"; prices: TokenRates; promotion: Promotion }
	| {
			kind: "allowance";
			/** Replaces the regular usage while the promo runs. */
			usageUsd: TierUsd;
			/** What each tier's caveat says, since each tier's figure differs. */
			summaries: [go: string, goPlus: string];
			endsOn: string;
			url: string;
	  };

export type GoPricing = {
	/** Each family's regular monthly usage. */
	usageUsd: Record<string, TierUsd>;
	/** Go's regular rates where they differ from the list price. */
	offListRates: Record<string, TokenRates>;
	promos: Record<string, GoPromo>;
};

export type GoPlan = {
	apiUsdPerMonthByFamily: Record<string, number>;
	promotionByFamily: Record<string, Promotion>;
};

/**
 * A tier's monthly usage in list-priced (API) dollars, and the promotions it
 * counts, for the families the plan lists. A promotion on a family with no
 * regular usage is a data mistake, so it throws.
 */
export const goPlan = Effect.fnUntraced(function* (
	pricing: GoPricing,
	tier: GoTier,
	families: readonly string[],
	listRates: ListRates,
) {
	const orphans = Object.keys(pricing.promos).filter(
		(family) => !(family in pricing.usageUsd),
	);
	if (orphans.length)
		return yield* new PlanDataError({
			message: `Go promotions on families with no usage: ${orphans.join(", ")}`,
		});
	const listed = families.filter((family) => family in pricing.usageUsd);
	return {
		apiUsdPerMonthByFamily: Object.fromEntries(
			yield* Effect.forEach(
				listed,
				Effect.fnUntraced(function* (family) {
					return [
						family,
						yield* listPricedUsd(pricing, family, tier, listRates),
					] as const;
				}),
			),
		),
		promotionByFamily: Object.fromEntries(
			Object.entries(pricing.promos)
				.filter(([family]) => listed.includes(family))
				.map(([family, promo]) => [family, promotionFor(promo, tier)]),
		),
	} satisfies GoPlan;
});

function promotionFor(promo: GoPromo, tier: GoTier): Promotion {
	if (promo.kind === "price") return promo.promotion;
	return {
		summary: promo.summaries[tier],
		endsOn: promo.endsOn,
		url: promo.url,
	};
}

/** Converts a family's Go-priced dollar usage into list-priced (API) dollars. */
const listPricedUsd = Effect.fnUntraced(function* (
	pricing: GoPricing,
	family: string,
	tier: GoTier,
	listRates: ListRates,
) {
	const promo = pricing.promos[family];
	const goUsd =
		promo?.kind === "allowance"
			? promo.usageUsd[tier]
			: pricing.usageUsd[family][tier];
	const goRates =
		promo?.kind === "price" ? promo.prices : pricing.offListRates[family];
	return goRates ? listPriced(goUsd, goRates, yield* listRates(family)) : goUsd;
});
