/** Dollar amounts with enough precision to tell sub-cent tasks apart. */
export function formatUsd(value: number): string {
	if (value >= 100) return `$${Math.round(value).toLocaleString("en-US")}`;
	if (value >= 1) return `$${Number(value.toFixed(2))}`;
	return `$${Number(value.toPrecision(2))}`;
}

export function formatMultiple(value: number): string {
	return value >= 10 ? `${Math.round(value)}×` : `${value.toFixed(1)}×`;
}
