// Imports Artificial Analysis per-eval Intelligence Index scores, cost, tokens
// and time from a model page's Next.js flight payload into src/data/aa-evals.json.

import { writeFile } from "node:fs/promises";
import {
	extractEvals,
	flightFromHtml,
	resolveRows,
	type ResolvedRow,
	type Skips,
} from "../src/domain/aa-evals.ts";
import { AA_EVAL_IDS } from "../src/domain/enums.ts";
import { loadAaPage } from "./aa-page.ts";
import { loadCatalogByFamily } from "./catalog-by-family.ts";

const ROOT = new URL("..", import.meta.url);
const OUTPUT = new URL("src/data/aa-evals.json", ROOT);

function parseArgs(argv: string[]): { html?: string } {
	const args: { html?: string } = {};
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--html") args.html = argv[++i];
		else throw new Error(`Unknown argument ${argv[i]}`);
	}
	return args;
}

function logSummary(rows: ResolvedRow[], skips: Skips): void {
	const models = new Set(rows.map((r) => `${r.family}@${r.effort}`));
	console.log(
		`Wrote ${rows.length} eval rows for ${models.size} model variants`,
	);
	if (skips.families.size)
		console.log(`No catalog family for ${[...skips.families].join(", ")}`);
	if (skips.efforts.size)
		console.log(`No catalog effort for ${[...skips.efforts].join(", ")}`);
	if (skips.mappedToDefault.size)
		console.log(
			`Mapped to the sole default variant: ${[...skips.mappedToDefault].join(", ")}`,
		);
}

async function main() {
	const { html } = parseArgs(process.argv.slice(2));
	const raw = extractEvals(flightFromHtml(await loadAaPage(html)));
	if (!raw.length) throw new Error("No eval rows extracted from website");
	const { rows, skips } = resolveRows(raw, await loadCatalogByFamily(ROOT));
	if (!rows.length) throw new Error("No eval rows matched the catalog");
	const output = {
		fetchedAt: new Date().toISOString(),
		source: "Artificial Analysis website (model page flight payload)",
		evals: [...AA_EVAL_IDS],
		rows,
	};
	await writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`);
	logSummary(rows, skips);
}

await main();
