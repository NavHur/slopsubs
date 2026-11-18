// OpenCode Go's regular token prices and limited-time promotions, which
// go-plans.ts turns into each tier's published allowance.

import type { GoPricing } from "./go-plans.ts";
import { OPENCODE_GO_USD } from "./plan-families.ts";

/** Go's docs, the source of its allowances, prices and promos. */
export const OPENCODE_DOCS = "https://opencode.ai/docs/go#usage-limits";

/** Go's console, where the promoted allowances show. */
const OPENCODE_CONSOLE = "https://opencode.ai/console/go";

export const GO_PRICING: GoPricing = {
	usageUsd: OPENCODE_GO_USD,
	// Go's regular [input, output] $/MTok where it differs from the list price.
	offListRates: {
		"gemini-4-argon": [4, 20],
		// The Contributor variants, billed far below Meta's list price.
		"muse-spark-1-3": [0.1, 0.2],
		"muse-spark-1-2": [0.1, 0.2],
		"longcat-2-0": [0.3, 1.2],
		"mimo-v2-5-pro": [0.435, 0.87],
		"mimo-v2-5-0424": [0.14, 0.28],
		hy3: [0.14, 0.58],
	},
	// After endsOn build-plans refuses to run: confirm the new allowance on the
	// Console Go page (browser-only), delete the promo, update OPENCODE_GO_USD.
	promos: {
		// GLM-5.3 is billed at list price, so the promoted dollars are list-priced.
		"glm-5-3": {
			kind: "allowance",
			usageUsd: [500, 1000],
			summaries: [
				"Go raises GLM-5.3 to $500 of monthly usage, from $200",
				"Go Plus raises GLM-5.3 to $1,000 of monthly usage, from $400",
			],
			endsOn: "2026-11-22",
			url: OPENCODE_CONSOLE,
		},
		"gemini-4-argon": {
			kind: "price",
			prices: [2, 10],
			promotion: {
				summary: "Go bills Gemini 4 Argon at 50% off, doubling its usage",
				endsOn: "2026-11-30",
				url: OPENCODE_DOCS,
			},
		},
	},
};
