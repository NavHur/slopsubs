// Fetches the Artificial Analysis model pages that import-benchmarks and
// import-aa-evals read. A model page embeds full records only for its own
// release's variants, AA's default chart selection and a few related models,
// so the importers read one page per plan-covered family and join them.

import { readFile } from "node:fs/promises";

const MODEL_PAGE = "https://artificialanalysis.ai/models/";

/** Pages fetched at once, to stay a polite client. */
const PARALLEL_FETCHES = 4;

/** The page slug for each family: its shortest catalog id (AA's bare model
 * slug, which the page URL takes; `qwen3-8-max-0902` lives at
 * `/models/qwen3-8-max`), or the family id when the catalog has none yet. */
export function aaPageSlugs(
	families: Iterable<string>,
	catalog: readonly { id: string; family: string }[],
): string[] {
	const slugs = new Set<string>();
	for (const family of families) {
		const ids = catalog
			.filter((point) => point.family === family)
			.map((point) => point.id)
			.sort((a, b) => a.length - b.length);
		slugs.add(ids[0] ?? family);
	}
	return [...slugs].sort();
}

async function fetchPage(slug: string): Promise<string> {
	const url = MODEL_PAGE + slug;
	const response = await fetch(url, {
		headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64)" },
	});
	if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
	return response.text();
}

/** The pages' HTML: the cached copies at `paths` when given, else one request
 * per slug, a few at a time. */
export async function loadAaPages(
	slugs: readonly string[],
	paths: readonly string[],
): Promise<string[]> {
	if (paths.length) return Promise.all(paths.map((p) => readFile(p, "utf8")));
	const pages: string[] = [];
	for (let i = 0; i < slugs.length; i += PARALLEL_FETCHES)
		pages.push(
			...(await Promise.all(
				slugs.slice(i, i + PARALLEL_FETCHES).map(fetchPage),
			)),
		);
	return pages;
}
