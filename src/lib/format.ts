/** Dollar amounts with enough precision to tell sub-cent tasks apart. */
export function formatUsd(value: number): string {
	if (value >= 100) return `$${Math.round(value).toLocaleString("en-US")}`;
	if (value >= 1) return `$${Number(value.toFixed(2))}`;
	return `$${Number(value.toPrecision(2))}`;
}

export function formatMultiple(value: number): string {
	return value >= 10 ? `${Math.round(value)}×` : `${value.toFixed(1)}×`;
}

const DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
	year: "numeric",
	// The same day on the server that prerenders and in every visitor's zone.
	timeZone: "UTC",
});

/** "Oct 13, 2026" for an ISO timestamp. */
export function formatDay(iso: string): string {
	return DAY_FORMAT.format(new Date(iso));
}

/** An intelligence index score, to the tenth the benchmark reports. */
export function formatIntelligence(value: number): string {
	return value.toFixed(1);
}

const compactCount = new Intl.NumberFormat("en-US", {
	notation: "compact",
	maximumSignificantDigits: 3,
});

/** Token counts at a glance: 850, 38.1K, 1.2M. */
export function formatTokens(value: number): string {
	return compactCount.format(value);
}

/**
 * How a plan's effective cost compares with paying per token for the same
 * work, from the plan's value multiple (effective cost = API cost ÷ multiple).
 */
export function formatApiComparison(valueMultiple: number): string {
	const factor = formatMultiple(Math.max(valueMultiple, 1 / valueMultiple));
	if (factor === formatMultiple(1)) return "Same cost as API";
	return `${factor} ${valueMultiple > 1 ? "cheaper" : "pricier"} than API`;
}
