// Builds src/data/plans.json (and the trimmed chart-benchmarks.json the site
// ships) from research/plans.json, keeping the plans
// the site covers (Claude Code, Codex and OpenCode Go tiers) and mapping
// their models onto benchmarked families.
//
// Usage: node scripts/build-plans.ts

import { readFile, writeFile } from "node:fs/promises";
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
// promos. Go bills at list prices, so these are API-equivalent dollars; the
// exception is Gemini 4 Argon, billed at twice its list price.
const OPENCODE_DOCS = "https://opencode.ai/docs/go#usage-limits";
const ARGON_LIST_RATIO = 10 / 20;
const OPENCODE_GO_USD: Record<string, [go: number, goPlus: number]> = {
	"kimi-k3": [15, 60],
	"kimi-k2-7-code": [60, 180],
	"gemini-4-argon": [30 * ARGON_LIST_RATIO, 120 * ARGON_LIST_RATIO],
	"step-5-preview": [15, 60],
	"minimax-m3": [60, 180],
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

function openCodeAllowance(tier: 0 | 1): PublishedAllowance {
	return {
		apiUsdPerMonthByFamily: Object.fromEntries(
			Object.entries(OPENCODE_GO_USD).map(([family, usd]) => [
				family,
				usd[tier],
			]),
		),
		url: OPENCODE_DOCS,
		basis: "OpenCode's published monthly usage for each model",
	};
}

const PUBLISHED_ALLOWANCES: Record<string, PublishedAllowance> = {
	"opencode-go": openCodeAllowance(0),
	"opencode-go-plus": openCodeAllowance(1),
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

const research = z
	.array(ResearchPlan)
	.parse(await readJson("research/plans.json"));
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
				publishedAllowance: PUBLISHED_ALLOWANCES[p.planId] ?? null,
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
