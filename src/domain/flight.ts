// Scanning primitives shared by the readers of an AA model page's Next.js
// flight payload, and by the importer reading slopalytics' JS bundle.

import { Effect, Schema } from "effect";
import { AaImportError } from "./aa-import-error";

const BRACE_DELTA: Record<string, number> = { "{": 1, "}": -1 };

/** Where a model record (or another id-and-slug object) opens. */
export const MODEL_START_PATTERN = /\{"id":"[0-9a-f-]{36}","slug":"/g;

/** Index of the quote closing the string literal opened at `open`, by the
 * same quote character, or an index at or past the text's length when it
 * never closes (a trailing backslash skips one extra character). */
export function stringLiteralEnd(text: string, open: number): number {
	const quote = text[open];
	let i = open + 1;
	while (i < text.length && text[i] !== quote) i += text[i] === "\\" ? 2 : 1;
	return i;
}

/** Whether `slug` is new to `seen`, which then records `reading` for it.
 * Fails when an earlier page read the same model differently. */
export const firstReading = Effect.fnUntraced(function* (
	seen: Map<string, string>,
	slug: string,
	reading: string,
) {
	const earlier = seen.get(slug);
	if (earlier === undefined) {
		seen.set(slug, reading);
		return true;
	}
	if (earlier !== reading)
		return yield* new AaImportError({
			message: `AA's pages disagree on ${slug}`,
		});
	return false;
});

/** End of the object starting at `start`, skipping braces inside strings. */
const objectEnd = Effect.fnUntraced(function* (text: string, start: number) {
	let depth = 0;
	for (let i = start; i < text.length; i++) {
		if (text[i] === '"') i = stringLiteralEnd(text, i);
		else depth += BRACE_DELTA[text[i]] ?? 0;
		if (depth === 0) return i + 1;
	}
	return yield* new AaImportError({
		message: `Object at offset ${start} never closes`,
	});
});

const decodeObject = Schema.decodeUnknownEffect(
	Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)),
);

/** The object starting at `start`, parsed. */
const objectAt = Effect.fnUntraced(function* (flight: string, start: number) {
	const text = flight.slice(start, yield* objectEnd(flight, start));
	return yield* decodeObject(text).pipe(
		Effect.mapError(
			(cause) =>
				new AaImportError({
					message: `Record at offset ${start} is not valid JSON`,
					cause,
				}),
		),
	);
});

/** Every model record in the payload, unvalidated: each id-and-slug object
 * that carries an Intelligence Index field, which a nested creator lacks. */
export const flightRecords = Effect.fnUntraced(function* (flight: string) {
	const records = yield* Effect.forEach(
		flight.matchAll(MODEL_START_PATTERN),
		(found) => objectAt(flight, found.index),
	);
	return records.filter((record) => Object.hasOwn(record, "intelligenceIndex"));
});
