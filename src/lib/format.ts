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

/** A percentage score, to the tenth: "45.5%". */
export function formatPercent(value: number): string {
	return `${value.toFixed(1)}%`;
}

const compactCount = new Intl.NumberFormat("en-US", {
	notation: "compact",
	maximumSignificantDigits: 3,
});

/** Token counts at a glance: 850, 38.1K, 1.23M. */
export function formatTokens(value: number): string {
	return compactCount.format(value);
}

const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;
const MINUTES_PER_HOUR = 60;

/**
 * A task's duration: to the second under an hour ("42s", "11m 51s"), to the
 * minute from an hour up ("1h 5m").
 */
export function formatDuration(seconds: number): string {
	const whole = Math.round(seconds);
	if (whole < SECONDS_PER_MINUTE) return `${whole}s`;
	if (whole < SECONDS_PER_HOUR) {
		return `${Math.floor(whole / SECONDS_PER_MINUTE)}m ${whole % SECONDS_PER_MINUTE}s`;
	}
	const totalMinutes = Math.round(whole / SECONDS_PER_MINUTE);
	return `${Math.floor(totalMinutes / MINUTES_PER_HOUR)}h ${totalMinutes % MINUTES_PER_HOUR}m`;
}

/** A count of tasks: 0.4, 38, 1.2K. */
export function formatCount(value: number): string {
	// Rounding first keeps 999.6 on the thousands branch, as "1K".
	if (Math.round(value) >= 1000) return compactCount.format(value);
	if (value >= 10) return String(Math.round(value));
	return String(Number(value.toPrecision(2)));
}

/**
 * How a plan compares with paying per token for the same work, from its value
 * multiple: "2.0× cheaper than API", "Same cost as API".
 */
export function formatApiComparison(valueMultiple: number): string {
	const factor = formatMultiple(Math.max(valueMultiple, 1 / valueMultiple));
	if (factor === formatMultiple(1)) return "Same cost as API";
	return `${factor} ${valueMultiple > 1 ? "cheaper" : "pricier"} than API`;
}
