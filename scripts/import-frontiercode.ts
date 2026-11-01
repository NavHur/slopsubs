// Imports Cognition's FrontierCode 2.0 leaderboard into src/data/frontiercode.json,
// under Artificial Analysis family ids.

import { writeFile } from "node:fs/promises";
import { z } from "zod";
import { EFFORTS } from "../src/domain/model.ts";
import { roundedOrNull } from "../src/domain/rounding.ts";
import { loadCatalogByFamily } from "./catalog-by-family.ts";

const ROOT = new URL("..", import.meta.url);
const SOURCE = "https://cognition.com/data/frontier-code-2.0/data.json";

/** Cognition names whose normalized form isn't our family id. */
const FAMILY_ALIASES: Record<string, string> = {
	// Cognition's "Muse Wonder 1.0" is the family we chart as muse-wonder.
	"muse-wonder-1-0": "muse-wonder",
};

const Result = z.object({
	correct: z.number(),
	new_score: z.number(),
	tokens: z.number().nullable(),
	cost: z.number().nonnegative().nullable(),
});

const Leaderboard = z.object({
	data: z.record(z.string(), z.record(z.string(), z.object({ main: Result }))),
});

/** "GPT-6.1 Sol" -> "gpt-6-1-sol", the slug our catalog uses. */
function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`${SOURCE}: HTTP ${response.status}`);
const leaderboard = Leaderboard.parse(await response.json());

const families = await loadCatalogByFamily(ROOT);
const skippedFamilies = new Set<string>();
const skippedEfforts = new Set<string>();
const seen = new Set<string>();
const rows = [];
for (const [name, efforts] of Object.entries(leaderboard.data)) {
	const family = FAMILY_ALIASES[slugify(name)] ?? slugify(name);
	for (const [effort, subsets] of Object.entries(efforts)) {
		const known = EFFORTS.find((e) => e === effort);
		if (!known) {
			skippedEfforts.add(`${name} (${effort})`);
			continue;
		}
		if (!families.has(family)) {
			skippedFamilies.add(name);
			continue;
		}
		const key = `${family}@${known}`;
		if (seen.has(key)) throw new Error(`Two rows for ${key}`);
		seen.add(key);
		rows.push({
			family,
			effort: known,
			score: roundedOrNull(subsets.main.new_score * 100, 2),
			costPerTaskUsd: roundedOrNull(subsets.main.cost, 5),
			tokensPerTask: subsets.main.tokens,
		});
	}
}
const output = {
	fetchedAt: new Date().toISOString(),
	source: "Cognition's FrontierCode 2.0",
	rows,
};
await writeFile(
	new URL("src/data/frontiercode.json", ROOT),
	`${JSON.stringify(output, null, 2)}\n`,
);
console.log(`Wrote ${rows.length} rows`);
if (skippedFamilies.size)
	console.log(`No family for ${[...skippedFamilies].join(", ")}`);
if (skippedEfforts.size)
	console.log(`No effort for ${[...skippedEfforts].join(", ")}`);
