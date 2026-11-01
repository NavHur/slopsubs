// Scanning primitives shared by the readers of an AA model page's Next.js
// flight payload, and by the importer reading slopalytics' JS bundle.

/** Where a model record (or another id-and-slug object) opens. */
export const MODEL_START_PATTERN = /\{"id":"[0-9a-f-]{36}","slug":"/g;

/** Index of the quote closing the string literal opened at `open`, by the
 * same quote character, or the text's length when it never closes. */
export function stringLiteralEnd(text: string, open: number): number {
	const quote = text[open];
	let i = open + 1;
	while (i < text.length && text[i] !== quote) i += text[i] === "\\" ? 2 : 1;
	return i;
}
