// Builds src/data/plans.json (and the trimmed chart-benchmarks.json the site
// ships) from the research in research/plans/, keeping the plans
// the site covers (Claude Code, Codex and OpenCode Go tiers) and mapping
// their models onto benchmarked families.
//
// Usage: node scripts/build-plans.ts

import { readdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import {
	BenchmarkDataset,
	Plans,
	type PublishedAllowance,
	type ReportedCap,
} from "../src/domain/model.ts";

const ROOT = new URL("..", import.meta.url);

const OPENAI = ["gpt-6-astra", "gpt-6-1-sol", "gpt-6-luna"];
const CLAUDE = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];
// Monthly usage by model on OpenCode Go and Go Plus (opencode.ai/docs/go,
// 2026-10-17), for the benchmarked part of its lineup, without limited-time
// promos. The dollars are at Go's token prices, which match list prices
// except where GO_OFF_LIST_PRICES says otherwise.
const OPENCODE_DOCS = "https://opencode.ai/docs/go#usage-limits";
const OPENCODE_GO_USD: Record<string, [go: number, goPlus: number]> = {
	"kimi-k3": [15, 60],
	"kimi-k2-7-code": [60, 180],
	"gemini-4-argon": [30, 120],
	"step-5-preview": [15, 60],
	"minimax-m3": [60, 180],
	"muse-spark-1-3": [60, 120],
	"claude-haiku-5-5": [15, 60],
	"gpt-6-luna": [15, 60],
	"qwen3-7-plus": [60, 180],
	"qwen3-8-max": [15, 60],
	"glm-5-3": [15, 120],
	"glm-5-3-flash": [60, 180],
	"mimo-v2-6-pro": [15, 60],
	"mimo-v2-6-flash": [60, 120],
	// At peak prices, which match the list; off-peak usage goes twice as far.
	"deepseek-v4-1-flash": [80, 160],
	"deepseek-v4-pro": [15, 60],
	"grok-4-7": [15, 60],
};
const OPENCODE_GO = Object.keys(OPENCODE_GO_USD);

/** Go's [input, output] $/MTok where it differs from the list price. */
const GO_OFF_LIST_PRICES: Record<string, [input: number, output: number]> = {
	"gemini-4-argon": [4, 20],
	// The Contributor variant, billed far below Meta's list price.
	"muse-spark-1-3": [0.1, 0.2],
};

/** Artificial Analysis's blend: three input tokens per output token. */
function blendedPrice(input: number, output: number): number {
	return (3 * input + output) / 4;
}

/** Max effort on Muse Spark is only served by Meta's own API. */
const OPENCODE_MAX_EFFORT = { "muse-spark-1-3": "xhigh" } as const;

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

/** Benchmarked families each plan includes. */
const PLAN_FAMILIES: Record<
	string,
	{ lab: string; families: string[]; includedApiCreditUsd?: number }
> = {
	"claude-pro": { lab: "anthropic", families: CLAUDE },
	// Max plans include Fable, capped at half the weekly limit, and monthly
	// Claude Platform API credit (claude.com/pricing, 2026-10-17).
	"claude-max-5x": {
		lab: "anthropic",
		families: [...CLAUDE, "claude-fable-5-1"],
		includedApiCreditUsd: 100,
	},
	"claude-max-20x": {
		lab: "anthropic",
		families: [...CLAUDE, "claude-fable-5-1"],
		includedApiCreditUsd: 200,
	},
	"chatgpt-plus": { lab: "openai", families: OPENAI },
	"chatgpt-pro-100": { lab: "openai", families: OPENAI },
	"chatgpt-pro-200": { lab: "openai", families: OPENAI },
	"chatgpt-pro-500": { lab: "openai", families: OPENAI },
	"opencode-go": { lab: "opencode", families: OPENCODE_GO },
	"opencode-go-plus": { lab: "opencode", families: OPENCODE_GO },
};

// Theo (t3.gg), "Does the $200 Codex plan suck now?", 2026-10-07.
const THEO = "https://www.youtube.com/watch?v=nYA0yASgaZI";
const at = (seconds: number) => `${THEO}&t=${seconds}s`;
const WEEKS_PER_MONTH = 52 / 12;
const MAX_20X_WEEKLY = 8000 / WEEKS_PER_MONTH;
const PRO_200_WEEKLY = 573.86;

/** Published weekly caps, used until a plan has measured samples. */
const REPORTED_CAPS: Record<string, ReportedCap> = {
	"claude-max-20x": {
		weeklyCapApiUsd: MAX_20X_WEEKLY,
		by: "Theo",
		url: at(28),
		basis: "Theo: $200 in, $8,000 a month of API-priced inference out",
	},
	// Theo gives no figure for the smaller Claude tiers; Anthropic sizes Max
	// 20x and 5x at 20 and 5 times Pro's per-session allowance.
	"claude-max-5x": {
		weeklyCapApiUsd: MAX_20X_WEEKLY / 4,
		by: "Theo",
		url: at(28),
		basis: "A quarter of Theo's Max 20x figure (Max 5x vs 20x of Pro)",
	},
	"claude-pro": {
		weeklyCapApiUsd: MAX_20X_WEEKLY / 20,
		by: "Theo",
		url: at(28),
		basis: "A twentieth of Theo's Max 20x figure (Max 20x is 20x Pro)",
	},
	"chatgpt-pro-200": {
		weeklyCapApiUsd: PRO_200_WEEKLY,
		by: "Theo",
		url: at(1037),
		basis: "Theo measured $573.86 of API-priced usage in one weekly cap",
	},
	// "The 20x plan is now 10x, but you can get the 25x plan" (24:34), in
	// multiples of Plus.
	"chatgpt-plus": {
		weeklyCapApiUsd: PRO_200_WEEKLY / 10,
		by: "Theo",
		url: at(1474),
		basis: "A tenth of Theo's Pro 200 figure (Pro 200 is now 10x Plus)",
	},
	"chatgpt-pro-500": {
		weeklyCapApiUsd: PRO_200_WEEKLY * 2.5,
		by: "Theo",
		url: at(1474),
		basis: "2.5x Theo's Pro 200 figure (Pro 500 is 25x Plus, Pro 200 10x)",
	},
	// Theo gives no Pro 100 figure; OpenAI launched it at 5x Plus.
	"chatgpt-pro-100": {
		weeklyCapApiUsd: (PRO_200_WEEKLY / 10) * 5,
		by: "Theo",
		url: at(1474),
		basis: "5x Theo's Plus figure (OpenAI launched Pro 100 at 5x Plus)",
	},
};

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

/** Every researched plan, from one file per vendor, in file-name order. */
async function readResearch(): Promise<unknown[]> {
	const dir = "research/plans/";
	const files = (await readdir(new URL(dir, ROOT)))
		.filter((name) => name.endsWith(".json"))
		.sort();
	const rows = await Promise.all(files.map((name) => readJson(dir + name)));
	return rows.flatMap((r) => z.array(z.unknown()).parse(r));
}

const research = z.array(ResearchPlan).parse(await readResearch());
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
	const goPrice = GO_OFF_LIST_PRICES[family];
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
		basis: "OpenCode's published monthly usage for each model, at list prices",
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
				reportedCap: REPORTED_CAPS[p.planId] ?? null,
				publishedAllowance: publishedAllowance(p.planId),
				maxEffortByFamily: lab === "opencode" ? OPENCODE_MAX_EFFORT : {},
				promotionByFamily: {},
			};
		}),
);

await writeFile(
	new URL("src/data/plans.json", ROOT),
	`${JSON.stringify(plans, null, 2)}\n`,
);

// The site ships only the benchmark points some plan covers.
const covered = new Set<string>(plans.flatMap((p) => p.families));
const chartModels = models.filter((m) => covered.has(m.family));
await writeFile(
	new URL("src/data/chart-benchmarks.json", ROOT),
	`${JSON.stringify({ ...dataset, models: chartModels })}\n`,
);
console.log(
	`Wrote ${plans.length} plans and ${chartModels.length} chart benchmark points`,
);
