// Fetches the Artificial Analysis model page the importers read, shared by
// the importers that take data from the website rather than the data API.

import { readFile } from "node:fs/promises";

/**
 * A model page embeds every model unless its own model is in AA's default
 * chart selection, so this one must stay outside it.
 */
const SOURCE = "https://artificialanalysis.ai/models/gemini-4-argon";

/** The page's HTML, from a cached copy at `path` or one request. */
export async function loadAaPage(path: string | undefined): Promise<string> {
	if (path) return readFile(path, "utf8");
	const response = await fetch(SOURCE, {
		headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64)" },
	});
	if (!response.ok) throw new Error(`${SOURCE}: HTTP ${response.status}`);
	return response.text();
}
