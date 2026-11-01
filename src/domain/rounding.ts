/** A number rounded to `digits` decimals; null for anything that is not one. */
export function roundedOrNull(value: unknown, digits: number): number | null {
	return typeof value === "number" ? Number(value.toFixed(digits)) : null;
}
