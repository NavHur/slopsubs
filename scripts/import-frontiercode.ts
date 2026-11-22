// Imports Cognition's FrontierCode 2.0 leaderboard into src/data/frontiercode.json,
// under Artificial Analysis family ids.

import { Clock, Data, Effect, Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { EFFORTS } from "../src/domain/enums.ts";
import { FrontierCodeDataset } from "../src/domain/model.ts";
import { roundedOrNull } from "../src/domain/rounding.ts";
import { loadCatalogByFamily } from "./catalog-by-family.ts";
import { TextFiles } from "./effects/files.ts";
import { getText } from "./effects/http.ts";

const ROOT = new URL("..", import.meta.url);
const SOURCE = "https://cognition.com/data/frontier-code-2.0/data.json";

/** Cognition names whose normalized form isn't our family id. */
const FAMILY_ALIASES: Record<string, string> = {
	// Cognition's "Muse Wonder 1.0" is the family we chart as muse-wonder.
	"muse-wonder-1-0": "muse-wonder",
	// Cognition's "Beam 1.0" is the family we chart as reflection-beam.
	"beam-1-0": "reflection-beam",
};

const Result = Schema.Struct({
	correct: Schema.Finite,
	new_score: Schema.Finite,
	tokens: Schema.NullOr(Schema.Finite),
	cost: Schema.NullOr(Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0))),
});

const Leaderboard = Schema.Struct({
	data: Schema.Record(
		Schema.String,
		Schema.Record(Schema.String, Schema.Struct({ main: Result })),
	),
});

/** "GPT-6.1 Sol" -> "gpt-6-1-sol", the slug our catalog uses. */
function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

class DuplicateFrontierCodeRow extends Data.TaggedError(
	"DuplicateFrontierCodeRow",
)<{ key: string }> {
	override get message() {
		return `Two rows for ${this.key}`;
	}
}

function collectRows(
	leaderboard: typeof Leaderboard.Type,
	families: ReadonlyMap<string, unknown>,
) {
	const skippedFamilies = new Set<string>();
	const skippedEfforts = new Set<string>();
	const rows = Object.entries(leaderboard.data).flatMap(([name, efforts]) => {
		const slug = slugify(name);
		const family = FAMILY_ALIASES[slug] ?? slug;
		return Object.entries(efforts).flatMap(([effort, { main }]) => {
			const known = EFFORTS.find((e) => e === effort);
			if (!known) {
				skippedEfforts.add(`${name} (${effort})`);
				return [];
			}
			if (!families.has(family)) {
				skippedFamilies.add(name);
				return [];
			}
			return [
				{
					family,
					effort: known,
					score: roundedOrNull(main.new_score * 100, 2),
					costPerTaskUsd: roundedOrNull(main.cost, 5),
					tokensPerTask: main.tokens,
				},
			];
		});
	});
	return { rows, skippedFamilies, skippedEfforts };
}

function logSkips(families: ReadonlySet<string>, efforts: ReadonlySet<string>) {
	if (families.size) console.log(`No family for ${[...families].join(", ")}`);
	if (efforts.size) console.log(`No effort for ${[...efforts].join(", ")}`);
}

const main = Effect.gen(function* () {
	const files = yield* TextFiles;
	const body = yield* getText(SOURCE);
	const leaderboard = yield* Schema.decodeUnknownEffect(
		Schema.fromJsonString(Leaderboard),
	)(body);
	const families = yield* loadCatalogByFamily(ROOT);
	const { rows, skippedFamilies, skippedEfforts } = collectRows(
		leaderboard,
		families,
	);
	const seen = new Set<string>();
	for (const { family, effort } of rows) {
		const key = `${family}@${effort}`;
		if (seen.has(key)) return yield* new DuplicateFrontierCodeRow({ key });
		seen.add(key);
	}
	const output = yield* Schema.decodeUnknownEffect(FrontierCodeDataset)({
		fetchedAt: new Date(yield* Clock.currentTimeMillis).toISOString(),
		source: "Cognition's FrontierCode 2.0",
		rows,
	});
	yield* files.write(
		new URL("src/data/frontiercode.json", ROOT),
		`${JSON.stringify(output, null, 2)}\n`,
	);
	console.log(`Wrote ${rows.length} rows`);
	logSkips(skippedFamilies, skippedEfforts);
});

await Effect.runPromise(
	main.pipe(
		Effect.provide(Layer.mergeAll(TextFiles.layer, FetchHttpClient.layer)),
	),
);
