// Scanning primitives shared by the readers of an AA model page's Next.js
// flight payload, and by the importer reading slopalytics' JS bundle.

import { Schema } from "effect";
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
 * Throws when an earlier page read the same model differently. */
export function firstReading(
	seen: Map<string, string>,
	slug: string,
	reading: string,
): boolean {
	const earlier = seen.get(slug);
	if (earlier === undefined) {
		seen.set(slug, reading);
		return true;
	}
	if (earlier !== reading)
		throw new AaImportError({ message: `AA's pages disagree on ${slug}` });
	return false;
}

/** End of the object starting at `start`, skipping braces inside strings. */
function objectEnd(text: string, start: number): number {
	let depth = 0;
	for (let i = start; i < text.length; i++) {
		if (text[i] === '"') i = stringLiteralEnd(text, i);
		else depth += BRACE_DELTA[text[i]] ?? 0;
		if (depth === 0) return i + 1;
	}
	throw new AaImportError({
		message: `Object at offset ${start} never closes`,
	});
}

const decodeObject = Schema.decodeUnknownSync(
	Schema.fromJsonString(Schema.Record(Schema.String, Schema.Unknown)),
);

/** The object starting at `start`, parsed. */
function objectAt(flight: string, start: number) {
	const text = flight.slice(start, objectEnd(flight, start));
	try {
		return decodeObject(text);
	} catch (cause) {
		if (!(cause instanceof Schema.SchemaError)) throw cause;
		throw new AaImportError({
			message: `Record at offset ${start} is not valid JSON`,
			cause,
		});
	}
}

/** Every model record in the payload, unvalidated: each id-and-slug object
 * that carries an Intelligence Index field, which a nested creator lacks. */
export function flightRecords(flight: string) {
	return [...flight.matchAll(MODEL_START_PATTERN)]
		.map((found) => objectAt(flight, found.index))
		.filter((record) => Object.hasOwn(record, "intelligenceIndex"));
}
