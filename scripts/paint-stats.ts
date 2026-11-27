import { Effect, Schema } from "effect";
import { BrowserCheckError } from "./effects/browser.ts";
/** The middle value; the mean of the two middle values for an even count. */
export function median(values: readonly number[]): number {
	const sorted = values.toSorted((a, b) => a - b);
	const upper = sorted.length >> 1;
	if (sorted.length % 2 === 1) return sorted[upper];
	return (sorted[upper - 1] + sorted[upper]) / 2;
}

/** Throws unless every paint metric was recorded: a missing entry reads as
 * NaN or 0, which would pass for a fast page. */
export const requirePainted = Effect.fnUntraced(function* (
	url: string,
	metrics: { firstPaintMs: number; fcpMs: number; lcpMs: number },
) {
	const { firstPaintMs, fcpMs, lcpMs } = metrics;
	for (const [name, ms] of Object.entries({ firstPaintMs, fcpMs, lcpMs })) {
		yield* Schema.decodeUnknownEffect(
			Schema.Finite.check(Schema.isGreaterThan(0)),
		)(ms).pipe(
			Effect.mapError(
				(cause) =>
					new BrowserCheckError({
						message: `${url} recorded no ${name}; got ${ms}`,
						cause,
					}),
			),
		);
	}
});
