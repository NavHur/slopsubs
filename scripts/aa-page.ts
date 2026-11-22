// Fetches the AA pages import-benchmarks and import-aa-evals read: one model
// page per plan-covered family, and one page per eval.

import { Effect, Schema } from "effect";
import { AA_EVAL_INDEX } from "../src/domain/aa-eval-index.ts";
import { AaImportError } from "../src/domain/aa-import-error.ts";
import { TextFiles } from "./effects/files.ts";
import { getText } from "./effects/http.ts";

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

/** Cached HTML when paths are given, otherwise fetch up to four pages at once. */
function loadPages(
	urls: readonly string[],
	paths: readonly string[],
	fetchOptions: { rejectRedirects?: boolean } = {},
) {
	return Effect.gen(function* () {
		const files = yield* TextFiles;
		if (paths.length)
			return yield* Effect.forEach(paths, (path) => files.read(path), {
				concurrency: PARALLEL_FETCHES,
			});
		return yield* Effect.forEach(
			urls,
			(url) => getText(url, { headers: HEADERS, ...fetchOptions }),
			{ concurrency: PARALLEL_FETCHES },
		);
	});
}

/** The model pages' HTML, one per page slug, or the cached copies at `paths`. */
export function loadAaPages(
	slugs: readonly string[],
	paths: readonly string[],
) {
	return loadPages(
		slugs.map((slug) => MODEL_PAGE + slug),
		paths,
	);
}

/** An eval page's slug can change. Require a direct 200 so a redirect fails. */
export function loadAaEvalPages(paths: readonly string[]) {
	const pages = new Set(Object.values(AA_EVAL_INDEX).map((e) => e.page));
	return loadPages(
		[...pages].map((page) => EVAL_PAGE + page),
		paths,
		{ rejectRedirects: true },
	);
}

/** Keep malformed AA input in the error channel and let parser bugs surface. */
export function readAaPayload<A>(parse: () => A) {
	return Effect.try({
		try: parse,
		catch: (cause) => {
			if (cause instanceof AaImportError || cause instanceof Schema.SchemaError)
				return cause;
			throw cause;
		},
	});
}
