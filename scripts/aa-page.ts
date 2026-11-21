// Fetches the AA pages import-benchmarks and import-aa-evals read: one model
// page per plan-covered family, and one page per eval.

import { readFile } from "node:fs/promises";
import { AA_EVAL_INDEX } from "../src/domain/aa-eval-index.ts";

const MODEL_PAGE = "https://artificialanalysis.ai/models/";
const EVAL_PAGE = "https://artificialanalysis.ai/evaluations/";

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

const HEADERS = { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64)" };

async function fetchPage(url: string): Promise<string> {
	const response = await fetch(url, { headers: HEADERS });
	if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
	return response.text();
}

/** An eval page's HTML; a renamed slug redirects or 404s, so only a plain 200
 * counts. */
async function fetchEvalPage(url: string): Promise<string> {
	const response = await fetch(url, { headers: HEADERS, redirect: "manual" });
	if (response.status !== 200)
		throw new Error(`${url}: HTTP ${response.status}`);
	return response.text();
}

/** The pages' HTML: the cached copies at `paths` when given, else one `fetchUrl`
 * per URL, a few at a time. */
async function loadPages(
	urls: readonly string[],
	paths: readonly string[],
	fetchUrl: (url: string) => Promise<string>,
): Promise<string[]> {
	if (paths.length) return Promise.all(paths.map((p) => readFile(p, "utf8")));
	const pages: string[] = [];
	for (let i = 0; i < urls.length; i += PARALLEL_FETCHES)
		pages.push(
			...(await Promise.all(urls.slice(i, i + PARALLEL_FETCHES).map(fetchUrl))),
		);
	return pages;
}

/** The model pages' HTML, one per page slug, or the cached copies at `paths`. */
export function loadAaPages(
	slugs: readonly string[],
	paths: readonly string[],
): Promise<string[]> {
	return loadPages(
		slugs.map((slug) => MODEL_PAGE + slug),
		paths,
		fetchPage,
	);
}

/** The eval pages' HTML, one per eval, or the cached copies at `paths`. */
export function loadAaEvalPages(paths: readonly string[]): Promise<string[]> {
	const pages = new Set(Object.values(AA_EVAL_INDEX).map((e) => e.page));
	return loadPages(
		[...pages].map((page) => EVAL_PAGE + page),
		paths,
		fetchEvalPage,
	);
}
