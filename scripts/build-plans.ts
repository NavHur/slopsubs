// Builds src/data/plans.json (and the trimmed chart-benchmarks.json the site
// ships) from research/plans.json, keeping the plans
// that meter usage in windows (the ones a weekly-cap measurement can value)
// and mapping their models onto benchmarked families.
// Credit-based plans (Copilot, Ollama, JetBrains, Warp) are left out: their
// value is the credit itself, not a cap to measure.
//
// Usage: node scripts/build-plans.ts

import { readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { BenchmarkDataset, Plans } from "../src/domain/model.ts";

const ROOT = new URL("..", import.meta.url);

const OPENAI = ["gpt-6-astra", "gpt-6-1-sol", "gpt-6-luna"];
const GOOGLE = ["gemini-4-argon", "gemini-3-8-flash", "gemini-3-1-pro-preview"];
const CLAUDE = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];
const XAI = ["grok-4-7"];
const ZAI = ["glm-5-3", "glm-5-3-flash"];
const KIMI = ["kimi-k3"];
const MIMO = ["mimo-v2-6-pro", "mimo-v2-6-flash"];

/** Vendor names too long for a chart label. */
const SHORT_LABELS: Record<string, string> = {
	"kimi-plus": "Kimi Plus",
	"x-subscription-plus": "X Plus",
	"x-subscription-premium": "X Premium",
	"x-subscription-super": "X Super",
	"x-subscription-ultra": "X Ultra",
	"zai-glm-coding-lite": "GLM Coding Lite",
	"zai-glm-coding-pro": "GLM Coding Pro",
	"zai-glm-coding-max": "GLM Coding Max",
	"mimo-token-lite": "MiMo Lite",
	"mimo-token-standard": "MiMo Standard",
	"mimo-token-pro": "MiMo Pro",
	"mimo-token-max": "MiMo Max",
	"alibaba-coding-plan-pro": "Qwen Coding Pro",
};

/** Benchmarked families each window-metered plan includes. */
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
	"google-ai-pro": { lab: "google", families: GOOGLE },
	"google-ai-ultra-5x": { lab: "google", families: GOOGLE },
	"google-ai-ultra-20x": { lab: "google", families: GOOGLE },
	"x-subscription-plus": { lab: "xai", families: XAI },
	"x-subscription-premium": { lab: "xai", families: XAI },
	"x-subscription-super": { lab: "xai", families: XAI },
	"x-subscription-ultra": { lab: "xai", families: XAI },
	"zai-glm-coding-lite": { lab: "zai", families: ZAI },
	"zai-glm-coding-pro": { lab: "zai", families: ZAI },
	"zai-glm-coding-max": { lab: "zai", families: ZAI },
	"kimi-plus": { lab: "kimi", families: KIMI },
	"kimi-pro": { lab: "kimi", families: KIMI },
	"kimi-max": { lab: "kimi", families: KIMI },
	"kimi-ultra": { lab: "kimi", families: KIMI },
	"mimo-token-lite": { lab: "xiaomi", families: MIMO },
	"mimo-token-standard": { lab: "xiaomi", families: MIMO },
	"mimo-token-pro": { lab: "xiaomi", families: MIMO },
	"mimo-token-max": { lab: "xiaomi", families: MIMO },
	"alibaba-coding-plan-pro": { lab: "alibaba", families: ["qwen3-7-plus"] },
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
				vendor: p.vendor,
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
