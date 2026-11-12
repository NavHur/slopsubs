// Builds src/data/plans.json from research/plans/, and the trimmed
// chart-benchmarks.json from the imported leaderboards.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { AA_EVAL_IDS } from "../src/domain/enums.ts";
import type { AaEvalId } from "../src/domain/eval-units.ts";
import { evalPoints, frontierCodePoints } from "../src/domain/leaderboards.ts";
import {
	AaEvalsDataset,
	BenchmarkDataset,
	type BenchmarkPoint,
	ChartData,
	FrontierCodeDataset,
	Plans,
	type Promotion,
	type PublishedAllowance,
	type ReportedCap,
} from "../src/domain/model.ts";
import { claudeCap } from "./claude-caps.ts";
import { OPENCODE_GO_USD, PLAN_FAMILIES } from "./plan-families.ts";

const ROOT = new URL("..", import.meta.url);

/** Go's docs, the source of its allowances, prices and promos. */
const OPENCODE_DOCS = "https://opencode.ai/docs/go#usage-limits";

/** Go's regular [input, output] $/MTok where it differs from the list price. */
const GO_OFF_LIST_PRICES: Record<string, [input: number, output: number]> = {
	"gemini-4-argon": [4, 20],
	// The Contributor variants, billed far below Meta's list price.
	"muse-spark-1-3": [0.1, 0.2],
	"muse-spark-1-2": [0.1, 0.2],
	"longcat-2-0": [0.3, 1.2],
	"mimo-v2-5-pro": [0.435, 0.87],
	"mimo-v2-5-0424": [0.14, 0.28],
	hy3: [0.14, 0.58],
};

/**
 * Limited-time discounts on Go's token prices. A discount stretches the same
 * monthly dollars over more tokens, so the allowance counts it while it runs.
 */
const GO_PROMOS: Record<
	string,
	{ prices: [input: number, output: number]; promotion: Promotion }
> = {
	"gemini-4-argon": {
		prices: [2, 10],
		promotion: {
			summary: "Go bills Gemini 4 Argon at 50% off, doubling its usage",
			endsOn: "2026-11-30",
			url: OPENCODE_DOCS,
		},
	},
};
const OPENCODE_PROMOTIONS = Object.fromEntries(
	Object.entries(GO_PROMOS).map(([family, p]) => [family, p.promotion]),
);
const today = new Date().toISOString().slice(0, 10);
for (const [family, { promotion }] of Object.entries(GO_PROMOS)) {
	if (promotion.endsOn < today)
		throw new Error(
			`GO_PROMOS["${family}"] ended on ${promotion.endsOn}; delete it and rebuild the plans.`,
		);
}

/** Artificial Analysis's blend: three input tokens per output token. */
function blendedPrice(input: number, output: number): number {
	return (3 * input + output) / 4;
}

/** Max effort on Muse Spark is only served by Meta's own API. */
const OPENCODE_MAX_EFFORT = {
	"muse-spark-1-3": "xhigh",
	"muse-spark-1-2": "xhigh",
} as const;

const PUBLISHED_ALLOWANCES: Record<string, 0 | 1> = {
	"opencode-go": 0,
	"opencode-go-plus": 1,
};

/** Plans are grouped by the harness people buy them for. */
const VENDORS: Record<string, string> = {
	anthropic: "Claude Code",
	openai: "Codex",
	opencode: "OpenCode Go",
};

/** Vendor names too long for a chart label. */
const SHORT_LABELS: Record<string, string> = {
	"opencode-go": "OpenCode Go",
	"opencode-go-plus": "OpenCode Go Plus",
};

// Theo (t3.gg), "OpenAI is getting desperate", 2026-11-02, 5:08: "on the $500
// plan, you now get around $10.5,000 of usage. And on the $200 plan... 4.3K".
const THEO = "https://www.youtube.com/watch?v=Hq2c7pww1Ds&t=308s";
const WEEKS_PER_MONTH = 52 / 12;
const CODEX_PRO_MULTIPLIER = 21;
/** Pro 100, 200 and 500 give 10x, 20x and 50x Plus's usage, so a Pro dollar
 * buys twice what a Plus dollar does. */
const CODEX_PLUS_MULTIPLIER = CODEX_PRO_MULTIPLIER / 2;

/**
 * API-priced dollars a month per subscription dollar: Theo's 21x on every
 * Codex Pro tier (2026-11-02), with Plus at half.
 */
const CODEX_MULTIPLIERS: Record<string, number> = {
	"chatgpt-plus": CODEX_PLUS_MULTIPLIER,
	"chatgpt-pro-100": CODEX_PRO_MULTIPLIER,
	"chatgpt-pro-200": CODEX_PRO_MULTIPLIER,
	"chatgpt-pro-500": CODEX_PRO_MULTIPLIER,
};

/** Theo's Codex weekly cap for each of the plan's models, or null for a plan
 * he did not report. */
function codexCap(
	planId: string,
	monthlyPriceUsd: number,
	families: readonly string[],
): ReportedCap | null {
	const multiplier = CODEX_MULTIPLIERS[planId];
	if (multiplier === undefined) return null;
	const monthlyApiUsd = monthlyPriceUsd * multiplier;
	const weekly = monthlyApiUsd / WEEKS_PER_MONTH;
	return {
		weeklyCapApiUsdByFamily: Object.fromEntries(
			families.map((family) => [family, weekly]),
		),
		by: "Theo",
		url: THEO,
		basis: `Theo: ${multiplier}x the price, $${monthlyApiUsd.toLocaleString("en-US")} a month of API-priced inference`,
	};
}

const ResearchPlan = z.object({
	vendor: z.string(),
	planId: z.string(),
	label: z.string(),
	monthlyPriceUsd: z.number(),
	harnesses: z.array(z.string()),
	limits: z.string(),
	thirdPartyHarnessAllowed: z.union([z.boolean(), z.literal("unclear")]),
	sources: z.array(z.object({ url: z.url(), accessed: z.string() })).min(1),
	confidence: z.enum(["primary", "secondary", "unverified"]),
});

async function readJson(path: string): Promise<unknown> {
	return JSON.parse(await readFile(new URL(path, ROOT), "utf8"));
}

/** One vendor's plans; a failure names the file. */
async function readVendorFile(
	dir: string,
	name: string,
): Promise<z.infer<typeof ResearchPlan>[]> {
	try {
		return z.array(ResearchPlan).parse(await readJson(dir + name));
	} catch (cause) {
		const message = cause instanceof Error ? cause.message : String(cause);
		throw new Error(`${dir}${name}: ${message}`, { cause });
	}
}

/** Every researched plan, from one file per vendor, in file-name order. */
async function readResearch(): Promise<z.infer<typeof ResearchPlan>[]> {
	const dir = "research/plans/";
	const files = (await readdir(new URL(dir, ROOT)))
		.filter((name) => name.endsWith(".json"))
		.sort();
	const rows = await Promise.all(
		files.map((name) => readVendorFile(dir, name)),
	);
	return rows.flat();
}

const research = await readResearch();
const dataset = BenchmarkDataset.parse(
	await readJson("src/data/benchmarks.json"),
);
const { models } = dataset;
const benchmarked = new Set<string>(models.map((m) => m.family));

const missing = Object.keys(PLAN_FAMILIES).filter(
	(id) => !research.some((p) => p.planId === id),
);
if (missing.length)
	throw new Error(`Plans not in research: ${missing.join(", ")}`);

/** Converts a Go-priced dollar allowance into list-priced (API) dollars. */
function listPricedUsd(family: string, goUsd: number): number {
	const goPrice = GO_PROMOS[family]?.prices ?? GO_OFF_LIST_PRICES[family];
	if (!goPrice) return goUsd;
	const list = models.find(
		(m) => m.family === family && m.inputPricePerMTokUsd !== null,
	);
	if (!list?.inputPricePerMTokUsd || !list.outputPricePerMTokUsd)
		throw new Error(`${family}: no list price to convert Go's allowance`);
	return (
		goUsd *
		(blendedPrice(list.inputPricePerMTokUsd, list.outputPricePerMTokUsd) /
			blendedPrice(...goPrice))
	);
}

function publishedAllowance(planId: string): PublishedAllowance | null {
	const tier = PUBLISHED_ALLOWANCES[planId];
	if (tier === undefined) return null;
	return {
		apiUsdPerMonthByFamily: Object.fromEntries(
			Object.entries(OPENCODE_GO_USD).map(([family, usd]) => [
				family,
				listPricedUsd(family, usd[tier]),
			]),
		),
		url: OPENCODE_DOCS,
		basis:
			"OpenCode's published monthly usage for each model, at list prices, with current promos",
	};
}

const plans = Plans.parse(
	research
		.filter((p) => p.planId in PLAN_FAMILIES)
		.map((p) => {
			const {
				lab,
				families,
				includedApiCreditUsd = 0,
				weeklyShareByFamily = {},
			} = PLAN_FAMILIES[p.planId];
			const unknown = families.filter((f) => !benchmarked.has(f));
			if (unknown.length)
				throw new Error(`${p.planId}: unbenchmarked ${unknown.join(", ")}`);
			return {
				id: p.planId,
				vendor: VENDORS[lab] ?? p.vendor,
				lab,
				label: SHORT_LABELS[p.planId] ?? p.label,
				monthlyPriceUsd: p.monthlyPriceUsd,
				harnesses: p.harnesses,
				families,
				limits: p.limits,
				includedApiCreditUsd,
				thirdPartyHarnessAllowed: p.thirdPartyHarnessAllowed,
				confidence: p.confidence,
				sourceUrl: p.sources[0].url,
				reportedCap:
					lab === "anthropic"
						? claudeCap(p.monthlyPriceUsd, families)
						: codexCap(p.planId, p.monthlyPriceUsd, families),
				publishedAllowance: publishedAllowance(p.planId),
				weeklyShareByFamily,
				maxEffortByFamily: lab === "opencode" ? OPENCODE_MAX_EFFORT : {},
				promotionByFamily: lab === "opencode" ? OPENCODE_PROMOTIONS : {},
			};
		}),
);

await writeFile(
	new URL("src/data/plans.json", ROOT),
	`${JSON.stringify(plans, null, 2)}\n`,
);

// The site ships only the benchmark points some plan covers.
const covered = new Set<string>(plans.flatMap((p) => p.families));
const onPlans = (points: BenchmarkPoint[]) =>
	points.filter((m) => covered.has(m.family));
const frontierCode = FrontierCodeDataset.parse(
	await readJson("src/data/frontiercode.json"),
);
const aaEvals = AaEvalsDataset.parse(await readJson("src/data/aa-evals.json"));
const evalBoard = (evalSlug: AaEvalId) => ({
	fetchedAt: aaEvals.fetchedAt,
	models: onPlans(evalPoints(aaEvals.rows, models, evalSlug)),
});
const evalBoards = Object.fromEntries(
	AA_EVAL_IDS.map((id) => [id, evalBoard(id)]),
) as Record<AaEvalId, ReturnType<typeof evalBoard>>;
const chart = ChartData.parse({
	frontier: dataset.frontier,
	leaderboards: {
		intelligence: { fetchedAt: dataset.fetchedAt, models: onPlans(models) },
		frontiercode: {
			fetchedAt: frontierCode.fetchedAt,
			models: onPlans(frontierCodePoints(frontierCode.rows, models)),
		},
		...evalBoards,
	},
});
await writeFile(
	new URL("src/data/chart-benchmarks.json", ROOT),
	`${JSON.stringify(chart)}\n`,
);
const counts = Object.entries(chart.leaderboards).map(
	([id, board]) => `${board.models.length} ${id}`,
);
console.log(
	`Wrote ${plans.length} plans and ${counts.join(", ")} chart benchmark points`,
);
