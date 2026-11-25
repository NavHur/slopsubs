// Each plan's benchmarked families, sidebar group, chart label and tier
// multiple. import-benchmarks keeps the AA models these name; build-plans builds from them.

import { CLAUDE_TIMES_PRO } from "./claude-caps.ts";
import { MUSE_TIMES_EVERYDAY } from "./muse-caps.ts";
import type { Tier } from "./tier-ladder.ts";

// Codex serves GPT-6.2 Astra and Sol on Plus and every Pro tier alongside the
// models they succeed (learn.chatgpt.com/docs/pricing, 2026-11-17).
const OPENAI = [
	"gpt-6-2-astra",
	"gpt-6-2-sol",
	"gpt-6-astra",
	"gpt-6-1-sol",
	"gpt-6-1-terra",
	"gpt-6-luna",
];
const CLAUDE = ["claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"];
// Monthly usage on Go and Go Plus (opencode.ai/docs/go, 2026-11-06), in dollars
// at Go's token prices; go-plans.ts converts the off-list ones.
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
	// Raised on the Console Go page (opencode.ai/console/go, rechecked 2026-11-23).
	"glm-5-3": [200, 400],
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

// The benchmarked models each credit plan serves, from the vendors' model
// pages (accessed 2026-11-15). A deprecated family stays while its vendor still names it.
/** Copilot's models on every plan; Pro+ and Max add the premium ones. */
const COPILOT_PRO = [
	"claude-sonnet-5-5",
	"claude-haiku-5-5",
	"gpt-6-1-terra",
	"gpt-6-luna",
	"gpt-5-6-luna",
	"gemini-3-8-flash",
	"gemini-4-hydrogen",
	"grok-4-7",
	"kimi-k3",
];
const COPILOT_PREMIUM = [
	"claude-opus-5-5",
	"claude-fable-5-2",
	"gpt-6-astra",
	"gpt-6-1-sol",
	"gemini-4-argon",
	"gemini-4-carbon",
	"gemini-4-neon",
	...COPILOT_PRO,
];
const OLLAMA_CLOUD = [
	"glm-5-3",
	"glm-5-3-flash",
	"glm-5-2",
	"kimi-k3-1-pro",
	"kimi-k3",
	"kimi-k2-7-code",
	"deepseek-v4-pro",
	"minimax-m3",
	"minimax-m3-1-flash",
	"mimo-v2-6-pro",
	"mimo-v2-6-flash",
	"mistral-large-4",
	"muse-spark-open",
	"gpt-oss-120b",
	"gpt-oss-20b",
	"nemotron-3-ultra-550b-a55b",
];
const JETBRAINS_AI = [
	"claude-opus-5-5",
	"claude-sonnet-5-5",
	"gpt-6-1-sol",
	"gpt-6-luna",
	"gpt-5-6-luna",
	"gemini-3-8-flash",
];
const WARP_MODELS = [
	"gpt-6-astra",
	"gpt-6-1-sol",
	"gpt-6-1-terra",
	"gpt-6-luna",
	"gpt-5-6-luna",
	...CLAUDE,
	"claude-fable-5-2",
	"gemini-4-argon",
	"gemini-3-8-flash",
	"grok-4-7",
	"glm-5-3",
	"glm-5-3-flash",
	"kimi-k3",
	"minimax-m3",
	"qwen3-8-max",
];

const CLAUDE_CODE = { lab: "anthropic", vendor: "Claude Code" };
const CODEX = { lab: "openai", vendor: "Codex", families: OPENAI };
const GO = { lab: "opencode", vendor: "OpenCode Go", families: OPENCODE_GO };
const COPILOT = { lab: "github", vendor: "Copilot" };
const OLLAMA = { lab: "ollama", vendor: "Ollama", families: OLLAMA_CLOUD };
const JETBRAINS = {
	lab: "jetbrains",
	vendor: "JetBrains AI",
	families: JETBRAINS_AI,
};
const WARP = { lab: "warp", vendor: "Warp", families: WARP_MODELS };
const MIMO = {
	lab: "xiaomi",
	vendor: "MiMo",
	families: ["mimo-v2-6-pro", "mimo-v2-6-flash"],
};
const ZAI = {
	lab: "zai",
	vendor: "GLM Coding Plan",
	families: ["glm-5-3", "glm-5-3-flash"],
};
/** Google AI Pro, and Ultra at "5x" and "20x higher usage limits vs. AI Pro".
 * Ultra adds Carbon (antigravity.google/docs/models, 2026-11-23). */
const GOOGLE = { lab: "google", vendor: "Antigravity" };
const GOOGLE_PRO = [
	"gemini-4-neon",
	"gemini-4-argon",
	"gemini-4-hydrogen",
	"gemini-3-8-flash",
	"claude-sonnet-5-5",
	"claude-opus-5-5",
];
const GOOGLE_ULTRA = ["gemini-4-carbon", ...GOOGLE_PRO];
const KIMI_PLUS = ["kimi-k3", "kimi-k3-1-pro"];
/** Pro and up add K2.7 Code HighSpeed. */
const KIMI = {
	lab: "kimi",
	vendor: "Kimi Code",
	families: [...KIMI_PLUS, "kimi-k2-7-code"],
};
/** M Plan Go, Explore "3x Go usage" and Build "7.5x Go usage". */
const MINIMAX = {
	lab: "minimax",
	vendor: "MiniMax Code",
	families: ["minimax-m3-1-flash"],
};
const minimaxTier = (times: number): Tier => ({ ladder: "minimax-m", times });
/** The pool covers Grok models only; third-party models bill at API list
 * price, so they are not part of the plan. Premium, Super and Ultra give
 * "4x", "15x" and "50x more usage compared to Plus". */
const X = { lab: "xai", vendor: "Cursor and Grok", families: ["grok-4-7"] };
const xTier = (times: number): Tier => ({ ladder: "x-subscription", times });
const claudeTier = (times: number): Tier => ({ ladder: "claude", times });
/** Wonder Full, on Power and Maximum, isn't sold on the API, so it has no
 * list price to value. Ember isn't on the plan page, but Muse Code serves it. */
const MUSE = {
	lab: "meta",
	vendor: "Muse Code",
	families: ["muse-wonder", "muse-spark-1-3", "muse-ember"],
};
const museTier = (times: number): Tier => ({ ladder: "muse-code", times });

/** Each plan's families, and how it is grouped, labelled and scaled. */
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
	"copilot-pro": {
		...COPILOT,
		shortLabel: "Copilot Pro",
		families: COPILOT_PRO,
	},
	"copilot-pro-plus": {
		...COPILOT,
		shortLabel: "Copilot Pro+",
		families: COPILOT_PREMIUM,
	},
	"copilot-max": {
		...COPILOT,
		shortLabel: "Copilot Max",
		families: COPILOT_PREMIUM,
	},
	"ollama-pro": { ...OLLAMA, shortLabel: "Ollama Pro" },
	"ollama-max": { ...OLLAMA, shortLabel: "Ollama Max" },
	"jetbrains-ai-pro": JETBRAINS,
	"jetbrains-ai-ultimate": JETBRAINS,
	"warp-build": WARP,
	"warp-max": WARP,
	"mimo-token-lite": { ...MIMO, shortLabel: "MiMo Lite" },
	"mimo-token-standard": { ...MIMO, shortLabel: "MiMo Standard" },
	"mimo-token-pro": { ...MIMO, shortLabel: "MiMo Pro" },
	"mimo-token-max": { ...MIMO, shortLabel: "MiMo Max" },
	"zai-glm-coding-lite": { ...ZAI, shortLabel: "GLM Coding Lite" },
	"zai-glm-coding-pro": { ...ZAI, shortLabel: "GLM Coding Pro" },
	"zai-glm-coding-max": { ...ZAI, shortLabel: "GLM Coding Max" },
	// Each tier's cap comes from its own reported multiple (build-plans.ts).
	"google-ai-pro": { ...GOOGLE, families: GOOGLE_PRO },
	// The same Pro plan at promotional prices, so the same usage.
	"google-ai-pro-deal-4-99": { ...GOOGLE, families: GOOGLE_PRO },
	"google-ai-pro-deal-9-99": { ...GOOGLE, families: GOOGLE_PRO },
	"google-ai-pro-annual": { ...GOOGLE, families: GOOGLE_PRO },
	"google-ai-ultra-5x": { ...GOOGLE, families: GOOGLE_ULTRA },
	"google-ai-ultra-20x": { ...GOOGLE, families: GOOGLE_ULTRA },
	// Kimi's tier multiples are secondary only, so its plans carry none.
	"kimi-plus": { ...KIMI, shortLabel: "Kimi Plus", families: KIMI_PLUS },
	"kimi-pro": KIMI,
	"kimi-max": KIMI,
	"kimi-ultra": KIMI,
	"minimax-m-plan-go": {
		...MINIMAX,
		shortLabel: "MiniMax Go",
		tier: minimaxTier(1),
	},
	"minimax-m-plan-explore": {
		...MINIMAX,
		shortLabel: "MiniMax Explore",
		tier: minimaxTier(3),
	},
	"minimax-m-plan-build": {
		...MINIMAX,
		shortLabel: "MiniMax Build",
		tier: minimaxTier(7.5),
	},
	"muse-code-everyday": {
		...MUSE,
		shortLabel: "Muse Everyday",
		tier: museTier(MUSE_TIMES_EVERYDAY.everyday),
	},
	"muse-code-high": {
		...MUSE,
		shortLabel: "Muse High",
		tier: museTier(MUSE_TIMES_EVERYDAY.high),
	},
	"muse-code-power": {
		...MUSE,
		shortLabel: "Muse Power",
		tier: museTier(MUSE_TIMES_EVERYDAY.power),
	},
	"muse-code-maximum": {
		...MUSE,
		shortLabel: "Muse Maximum",
		tier: museTier(MUSE_TIMES_EVERYDAY.maximum),
	},
	"x-subscription-plus": { ...X, shortLabel: "X Plus", tier: xTier(1) },
	"x-subscription-premium": {
		...X,
		shortLabel: "X Premium",
		tier: xTier(4),
	},
	"x-subscription-super": { ...X, shortLabel: "X Super", tier: xTier(15) },
	"x-subscription-ultra": { ...X, shortLabel: "X Ultra", tier: xTier(50) },
};
