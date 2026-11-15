// The benchmarked families each plan includes. import-benchmarks reads them
// to decide which AA models to keep, and build-plans to build each plan.

import { CLAUDE_TIMES_PRO } from "./claude-caps.ts";
import type { Tier } from "./tier-ladder.ts";

const OPENAI = ["gpt-6-astra", "gpt-6-1-sol", "gpt-6-1-terra", "gpt-6-luna"];
const CLAUDE = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];
// Monthly usage on Go and Go Plus (opencode.ai/docs/go, 2026-11-06), in dollars
// at Go's token prices; build-plans converts the off-list ones.
export const OPENCODE_GO_USD: Record<string, [go: number, goPlus: number]> = {
	"kimi-k3-1-pro": [15, 60],
	"kimi-k3": [15, 60],
	"kimi-k2-7-code": [60, 180],
	"gemini-4-argon": [30, 120],
	"step-5-preview": [15, 60],
	"minimax-m3-1-flash": [20, 80],
	"minimax-m3": [60, 180],
	"muse-spark-1-3": [60, 120],
	"muse-spark-1-2": [60, 120],
	"claude-haiku-5-5": [15, 60],
	"gpt-6-luna": [15, 60],
	"gpt-5-6-luna": [15, 60],
	"qwen3-7-plus": [60, 180],
	"qwen3-8-max": [15, 60],
	"glm-5-3": [15, 120],
	"glm-5-2": [60, 180],
	"glm-5-3-flash": [60, 180],
	"longcat-2-0": [60, 240],
	"mimo-v2-6-pro": [15, 60],
	"mimo-v2-6-flash": [60, 120],
	"mimo-v2-5-pro": [15, 60],
	"mimo-v2-5-0424": [60, 120],
	hy3: [60, 240],
	// Go serves V4.1 Flash's 1017 build since 2026-10-19 (research/plans/opencode.json).
	// At peak prices, which match the list; off-peak usage goes twice as far.
	"deepseek-v4-1-flash-1017": [100, 200],
	"deepseek-v4-pro": [15, 60],
	"grok-4-7": [15, 60],
};
const OPENCODE_GO = Object.keys(OPENCODE_GO_USD);

/** "Fable included, up to half your weekly limit" (claude.com/pricing). */
const FABLE_HALF = { "claude-fable-5-2": 0.5 };

/** How a plan is shown and which of its models the site benchmarks. */
export type PlanEntry = {
	/** The plan provider's id, such as "anthropic"; not every model it includes
	 * comes from that lab. */
	lab: string;
	/** The harness people buy the plan for, which groups it in the list. */
	vendor: string;
	/** A chart label, where the researched label is too long for one. */
	shortLabel?: string;
	families: string[];
	includedApiCreditUsd?: number;
	weeklyShareByFamily?: Record<string, number>;
	/** The vendor's published usage multiple against its base tier. */
	tier?: Tier;
};

const CLAUDE_CODE = { lab: "anthropic", vendor: "Claude Code" };
const CODEX = { lab: "openai", vendor: "Codex", families: OPENAI };
const GO = { lab: "opencode", vendor: "OpenCode Go", families: OPENCODE_GO };
const claudeTier = (times: number): Tier => ({ ladder: "claude", times });

/** Benchmarked families each plan includes. */
export const PLAN_FAMILIES: Record<string, PlanEntry> = {
	"claude-pro": {
		...CLAUDE_CODE,
		families: CLAUDE,
		tier: claudeTier(CLAUDE_TIMES_PRO.pro),
	},
	// Max and Ultra include Fable at half the weekly limit, plus API credit
	// (claude.com/pricing, 2026-11-09). Fable 5.2 replaced the legacy 5.1.
	"claude-max-5x": {
		...CLAUDE_CODE,
		families: [...CLAUDE, "claude-fable-5-2"],
		includedApiCreditUsd: 100,
		weeklyShareByFamily: FABLE_HALF,
		tier: claudeTier(CLAUDE_TIMES_PRO.max),
	},
	"claude-max-20x": {
		...CLAUDE_CODE,
		families: [...CLAUDE, "claude-fable-5-2"],
		includedApiCreditUsd: 200,
		weeklyShareByFamily: FABLE_HALF,
		tier: claudeTier(CLAUDE_TIMES_PRO.ultra),
	},
	"chatgpt-plus": CODEX,
	"chatgpt-pro-100": CODEX,
	"chatgpt-pro-200": CODEX,
	"chatgpt-pro-500": CODEX,
	"opencode-go": { ...GO, shortLabel: "OpenCode Go" },
	"opencode-go-plus": { ...GO, shortLabel: "OpenCode Go Plus" },
};
