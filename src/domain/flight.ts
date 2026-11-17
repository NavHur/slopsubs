// Scanning primitives shared by the readers of an AA model page's Next.js
// flight payload, and by the importer reading slopalytics' JS bundle.

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

/** End of the object starting at `start`, skipping braces inside strings. */
function objectEnd(text: string, start: number): number {
	let depth = 0;
	for (let i = start; i < text.length; i++) {
		if (text[i] === '"') i = stringLiteralEnd(text, i);
		else depth += BRACE_DELTA[text[i]] ?? 0;
		if (depth === 0) return i + 1;
	}
	throw new Error(`Object at offset ${start} never closes`);
}

/** The object starting at `start`, parsed. */
function objectAt(flight: string, start: number): unknown {
	const text = flight.slice(start, objectEnd(flight, start));
	try {
		return JSON.parse(text);
	} catch (cause) {
		throw new Error(`Record at offset ${start} is not valid JSON`, { cause });
	}
}

/** Every model record in the payload, unvalidated: each id-and-slug object
 * that carries an Intelligence Index field, which a nested creator lacks. */
export function flightRecords(flight: string): object[] {
	return [...flight.matchAll(MODEL_START_PATTERN)]
		.map((found) => objectAt(flight, found.index))
		.filter(
			(record): record is object =>
				typeof record === "object" &&
				record !== null &&
				"intelligenceIndex" in record,
		);
}
