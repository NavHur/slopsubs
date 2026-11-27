// Credit plans: a fixed amount of usage a month at the vendor's own token
// rates, which build-plans values at list price as a published allowance.

import { Effect } from "effect";
import type { Promotion, PublishedAllowance } from "../src/domain/model.ts";
import { listPriced, type ListRates, type TokenRates } from "./list-price.ts";
import { PlanDataError } from "./plan-offers.ts";

/** A limited-time discount on one model's rates, counted while it runs. */
type CreditPromo = { rates: TokenRates; promotion: Promotion };

export type CreditPlan = {
	/** The monthly credit, in dollars or, for `unit: "credits"`, the vendor's
	 * own credits. */
	monthlyCredit: number;
	unit: "usd" | "credits";
	/**
	 * The vendor's rates per million tokens, in the credit's unit. A dollar
	 * plan lists only the models it bills off list price; a plan in its own
	 * credits lists every model, since there is no list price to assume.
	 */
	rates: Record<string, TokenRates>;
	promos: Record<string, CreditPromo>;
	url: string;
	/** How the credit is reached and spent at the plan's monthly price,
	 * shown next to the figure. */
	basis: (priceUsd: number) => string;
};

/** Each family's monthly allowance in list-priced dollars. */
export const creditAllowance = Effect.fnUntraced(function* (
	plan: CreditPlan,
	priceUsd: number,
	families: readonly string[],
	listRates: ListRates,
) {
	return {
		apiUsdPerMonthByFamily: Object.fromEntries(
			yield* Effect.forEach(
				families,
				Effect.fnUntraced(function* (family) {
					return [
						family,
						listPriced(
							plan.monthlyCredit,
							yield* vendorRates(plan, family, listRates),
							yield* listRates(family),
						),
					] as const;
				}),
			),
		),
		url: plan.url,
		basis: plan.basis(priceUsd),
	} satisfies PublishedAllowance;
});

const vendorRates = Effect.fnUntraced(function* (
	plan: CreditPlan,
	family: string,
	listRates: ListRates,
) {
	const rates = plan.promos[family]?.rates ?? plan.rates[family];
	if (rates) return rates;
	if (plan.unit === "credits")
		return yield* new PlanDataError({
			message: `${family}: no credit rate for a plan in its own credits`,
		});
	return yield* listRates(family);
});

/** The promotions a credit plan's allowance counts: its families' only. */
export function creditPromotions(
	plan: CreditPlan,
	families: readonly string[],
): Record<string, Promotion> {
	return Object.fromEntries(
		Object.entries(plan.promos)
			.filter(([family]) => families.includes(family))
			.map(([family, p]) => [family, p.promotion]),
	);
}
