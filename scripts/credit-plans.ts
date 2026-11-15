// Credit plans: a fixed amount of usage a month at the vendor's own token
// rates. build-plans turns each into a published monthly allowance at list
// price, so the value multiple is the credit ratio.

import type { Promotion, PublishedAllowance } from "../src/domain/model.ts";
import { listPriced, type TokenRates } from "./list-price.ts";

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
export function creditAllowance(
	plan: CreditPlan,
	priceUsd: number,
	families: readonly string[],
	listRates: (family: string) => TokenRates,
): PublishedAllowance {
	return {
		apiUsdPerMonthByFamily: Object.fromEntries(
			families.map((family) => [
				family,
				listPriced(
					plan.monthlyCredit,
					vendorRates(plan, family, listRates),
					listRates(family),
				),
			]),
		),
		url: plan.url,
		basis: plan.basis(priceUsd),
	};
}

function vendorRates(
	plan: CreditPlan,
	family: string,
	listRates: (family: string) => TokenRates,
): TokenRates {
	const rates = plan.promos[family]?.rates ?? plan.rates[family];
	if (rates) return rates;
	if (plan.unit === "credits")
		throw new Error(`${family}: no credit rate for a plan in its own credits`);
	return listRates(family);
}

/** The promotions a credit plan's allowance counts, by family. */
export function creditPromotions(plan: CreditPlan): Record<string, Promotion> {
	return Object.fromEntries(
		Object.entries(plan.promos).map(([family, p]) => [family, p.promotion]),
	);
}
