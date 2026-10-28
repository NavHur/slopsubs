// Imports Cognition's FrontierCode 2.0 leaderboard, one row per model and
// effort, from mypriors.com's public tool API into src/data/frontiercode.json.
// Rows keep only models the Artificial Analysis data already names, under its
// family ids, so build-plans can join them with names, labs and prices.
//
// Usage: node scripts/import-frontiercode.ts

import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { EFFORTS } from "../src/domain/model.ts";

const ROOT = new URL("..", import.meta.url);
const API = "https://mypriors.com/api/tools/get_benchmark";
const BENCHMARK = "frontiercode-2.0-main";
/** More than the leaderboard holds, so one request returns every row. */
const ROW_LIMIT = 1000;

/** Priors model ids whose normalized form isn't our family id. */
const FAMILY_ALIASES: Record<string, string> = {
	// Priors lists "Gemini 4 Argon" among this model's aliases.
	"gemini-4": "gemini-4-argon",
};

const Leaderboard = z.object({
	benchmark: z.object({ name: z.string(), url: z.url() }),
	total: z.number(),
	rows: z.array(
		z.object({
			modelId: z.string(),
			effort: z.enum(EFFORTS),
			value: z.number(),
			costUsd: z.number().nonnegative().nullable(),
			outputTokens: z.number().nullable(),
		}),
	),
});

async function fetchLeaderboard() {
	const response = await fetch(API, {
		method: "POST",
		body: JSON.stringify({ benchmark: BENCHMARK, limit: ROW_LIMIT }),
	});
	if (!response.ok) throw new Error(`${API}: HTTP ${response.status}`);
	const leaderboard = Leaderboard.parse(await response.json());
	if (leaderboard.rows.length !== leaderboard.total)
		throw new Error(
			`Got ${leaderboard.rows.length} of ${leaderboard.total} rows`,
		);
	return leaderboard;
}

async function knownFamilies(): Promise<Set<string>> {
	const path = new URL("src/data/benchmarks.json", ROOT);
	const { models } = JSON.parse(await readFile(path, "utf8")) as {
		models: { family: string }[];
	};
	return new Set(models.map((m) => m.family));
}

/**
 * Our family id for a Priors model id: dashes for dots, and without the "aa-"
 * Priors gives models it only knows from Artificial Analysis.
 */
function normalizedId(modelId: string): string {
	return modelId.replace(/^aa-/, "").replaceAll(".", "-");
}

const ROUND = (value: number | null, digits: number) =>
	value === null ? null : Number(value.toFixed(digits));

const [leaderboard, families] = await Promise.all([
	fetchLeaderboard(),
	knownFamilies(),
]);
const skipped = new Set<string>();
const seen = new Set<string>();
const rows = leaderboard.rows.flatMap((row) => {
	const family = FAMILY_ALIASES[row.modelId] ?? normalizedId(row.modelId);
	if (!families.has(family)) {
		skipped.add(row.modelId);
		return [];
	}
	const key = `${family}@${row.effort}`;
	if (seen.has(key)) throw new Error(`Two rows for ${key}`);
	seen.add(key);
	return [
		{
			family,
			effort: row.effort,
			score: ROUND(row.value, 2),
			costPerTaskUsd: ROUND(row.costUsd, 5),
			tokensPerTask: row.outputTokens,
		},
	];
});
const output = {
	fetchedAt: new Date().toISOString(),
	name: leaderboard.benchmark.name,
	url: leaderboard.benchmark.url,
	source: `Cognition's ${leaderboard.benchmark.name} via mypriors.com`,
	rows,
};
await writeFile(
	new URL("src/data/frontiercode.json", ROOT),
	`${JSON.stringify(output, null, 2)}\n`,
);
console.log(
	`Wrote ${rows.length} of ${leaderboard.total} rows; no family for ${[...skipped].join(", ")}`,
);
