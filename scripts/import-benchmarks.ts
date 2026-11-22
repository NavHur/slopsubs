// Merges AA's website (scores, prices, releases, cost/tokens/time per task)
// and slopalytics (the catalog, and figures AA's site lacks) into
// src/data/benchmarks.json.

import { Clock, Data, Effect, Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { flightFromHtml } from "../src/domain/aa-evals.ts";
import { joinAaSites, readAaSite } from "../src/domain/aa-site.ts";
import {
	CatalogMismatch,
	mergeCatalog,
	slopaPoint,
	SlopalyticsDataset,
} from "../src/domain/catalog.ts";
import { BenchmarkDataset, Frontier } from "../src/domain/model.ts";
import { aaPageSlugs, loadAaPages, readAaPayload } from "./aa-page.ts";
import { parseArgs } from "./benchmark-args.ts";
import { BundleLayoutError, extract } from "./bundle-literal.ts";
import { TextFiles } from "./effects/files.ts";
import { getText } from "./effects/http.ts";
import { PLAN_FAMILIES } from "./plan-families.ts";

const SITE = "https://slopalytics.com";
const OUTPUT = new URL("../src/data/benchmarks.json", import.meta.url);

/**
 * Frontier families slopalytics still names by a predecessor, keyed by that
 * predecessor. The successor takes its tier, colour and place in the order.
 * ceiling: a stopgap until slopalytics' frontier names the successor; the
 * import then fails here, and the entry should be deleted.
 */
const FRONTIER_SUCCESSORS: Record<string, string> = {
	"gpt-6-astra": "gpt-6-2-astra",
	"gpt-6-1-sol": "gpt-6-2-sol",
};

function withSuccessors(frontier: Frontier) {
	return Effect.gen(function* () {
		for (const [predecessor, successor] of Object.entries(
			FRONTIER_SUCCESSORS,
		)) {
			if (!(predecessor in frontier) || successor in frontier)
				return yield* new BundleLayoutError({
					message: `Slopalytics' frontier has moved past ${predecessor}; delete FRONTIER_SUCCESSORS["${predecessor}"].`,
				});
		}
		return Object.fromEntries(
			Object.entries(frontier).map(([family, entry]) => [
				FRONTIER_SUCCESSORS[family] ?? family,
				entry,
			]),
		);
	});
}

class MissingIndexBundle extends Data.TaggedError("MissingIndexBundle")<{}> {
	override get message() {
		return `No index bundle referenced from ${SITE}`;
	}
}

function loadBundle(path: string | undefined) {
	return Effect.gen(function* () {
		const files = yield* TextFiles;
		if (path) return yield* files.read(path);
		const html = yield* getText(SITE);
		const script = html.match(/\/assets\/index-[\w-]+\.js/)?.[0];
		if (!script) return yield* new MissingIndexBundle();
		return yield* getText(SITE + script);
	});
}

function logCatalogNotes(merged: ReturnType<typeof mergeCatalog>) {
	if (merged.unlisted.length)
		console.log(
			`Left out ${merged.unlisted.length} catalog models AA no longer lists and no plan covers: ${merged.unlisted.join(", ")}`,
		);
	if (merged.skipped.length)
		console.log(
			`Left out ${merged.skipped.length} AA models no plan covers: ${merged.skipped.join(", ")}`,
		);
	for (const warning of merged.warnings) console.warn(`warning: ${warning}`);
	if (merged.missingCost.length)
		console.warn(`No cost data yet: ${merged.missingCost.join(", ")}`);
}

const main = Effect.gen(function* () {
	const files = yield* TextFiles;
	const args = parseArgs(process.argv.slice(2));
	const bundle = yield* loadBundle(args.bundle);
	const dataset = yield* Schema.decodeUnknownEffect(SlopalyticsDataset)(
		yield* extract(bundle, /=\{fetchedAt:/),
	);
	const rawFrontier = yield* Schema.decodeUnknownEffect(Frontier)(
		yield* extract(bundle, /=\{"gpt-6-astra":\{tier:/),
	);
	const frontier = yield* withSuccessors(rawFrontier);
	const slopa = dataset.models.map(slopaPoint);
	const coveredFamilies = new Set(
		Object.values(PLAN_FAMILIES).flatMap((plan) => plan.families),
	);
	const pages = yield* loadAaPages(
		aaPageSlugs(coveredFamilies, slopa),
		args.html,
	);
	const aa = yield* readAaPayload(() =>
		joinAaSites(pages.map((page) => readAaSite(flightFromHtml(page)))),
	);
	const merged = yield* Effect.try({
		try: () =>
			mergeCatalog(aa.models, slopa, {
				coveredFamilies,
				siteCosts: aa.costs,
				allowScoreDrift: args.allowScoreDrift,
			}),
		catch: (cause) => {
			if (cause instanceof CatalogMismatch) return cause;
			throw cause;
		},
	});
	if (merged.missingCost.length && !args.allowMissingCost)
		return yield* new CatalogMismatch({
			message:
				`AA lists ${merged.missingCost.join(", ")} with no cost data from slopalytics or AA's site. ` +
				"Update the bundle, or pass --allow-missing-cost to publish them as " +
				'"No cost data".',
		});
	const output = yield* Schema.decodeUnknownEffect(BenchmarkDataset)({
		fetchedAt: new Date(yield* Clock.currentTimeMillis).toISOString(),
		source:
			"Artificial Analysis website (scores, prices, releases, cost, tokens and time per task); Slopalytics (catalog, and figures AA's site lacks)",
		frontier,
		models: merged.models,
	});
	yield* files.write(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
	console.log(
		`Wrote ${merged.models.length} benchmark points, ${Object.keys(frontier).length} frontier families, from ${pages.length} AA model pages`,
	);
	logCatalogNotes(merged);
});

await Effect.runPromise(
	main.pipe(
		Effect.provide(Layer.mergeAll(TextFiles.layer, FetchHttpClient.layer)),
	),
);
