// Builds src/data/plans.json from research/plans/, and the trimmed
// chart-benchmarks.json from the imported leaderboards.

import { readdir, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { AA_EVAL_IDS } from "../src/domain/enums.ts";
import type { AaEvalId } from "../src/domain/eval-units.ts";
import { evalPoints, frontierCodePoints } from "../src/domain/leaderboards.ts";
import {
	AaEvalsDataset,
	AllowanceKind,
	BenchmarkDataset,
	type BenchmarkPoint,
	ChartData,
	FrontierCodeDataset,
	Plans,
	type Promotion,
	type PublishedAllowance,
	type ReportedCap,
} from "../src/domain/model.ts";
import { CLAUDE_ULTRA } from "./claude-caps.ts";
import { listPriced, type TokenRates } from "./list-price.ts";
import {
	OPENCODE_GO_USD,
	PLAN_FAMILIES,
	type PlanEntry,
} from "./plan-families.ts";
import { type KnownTier, type Ladder, scaledCap } from "./tier-ladder.ts";

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

/** Max effort on Muse Spark is only served by Meta's own API. */
const OPENCODE_MAX_EFFORT = {
	"muse-spark-1-3": "xhigh",
	"muse-spark-1-2": "xhigh",
} as const;

const PUBLISHED_ALLOWANCES: Record<string, 0 | 1> = {
	"opencode-go": 0,
	"opencode-go-plus": 1,
};

/** Each tier ladder's reported tier, which its other tiers scale from. A
 * ladder without one ships its plans unmeasured. */
const KNOWN_TIERS: Partial<Record<Ladder, KnownTier>> = {
	claude: CLAUDE_ULTRA,
};

/** The known tier's caps scaled to the plan's own multiple, if its ladder has
 * a known tier. */
function tierCap(
	entry: PlanEntry,
	label: string,
	families: readonly string[],
): ReportedCap | null {
	const known = entry.tier && KNOWN_TIERS[entry.tier.ladder];
	if (!entry.tier || !known) return null;
	return scaledCap(known, { label, times: entry.tier.times }, families);
}

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
	allowanceKind: AllowanceKind,
	/** Only plans on sale ship; the others stay in research with the reason. */
	availability: z.enum(["on-sale", "closed", "discontinued"]),
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
const offSale = research.filter(
	(p) => p.planId in PLAN_FAMILIES && p.availability !== "on-sale",
);
if (offSale.length)
	throw new Error(
		`Plans no longer on sale can't ship: ${offSale.map((p) => `${p.planId} (${p.availability})`).join(", ")}`,
	);

/** The family's list [input, output] $/MTok, from the benchmark catalog. */
function listRates(family: string): TokenRates {
	const list = models.find(
		(m) => m.family === family && m.inputPricePerMTokUsd !== null,
	);
	if (!list?.inputPricePerMTokUsd || !list.outputPricePerMTokUsd)
		throw new Error(`${family}: no list price to value its allowance at`);
	return [list.inputPricePerMTokUsd, list.outputPricePerMTokUsd];
}

/** Converts a Go-priced dollar allowance into list-priced (API) dollars. */
function listPricedUsd(family: string, goUsd: number): number {
	const goPrice = GO_PROMOS[family]?.prices ?? GO_OFF_LIST_PRICES[family];
	return goPrice ? listPriced(goUsd, goPrice, listRates(family)) : goUsd;
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

/** The limited-time discounts a plan's allowance counts, by family. */
function promotions(lab: string): Record<string, Promotion> {
	return lab === "opencode" ? OPENCODE_PROMOTIONS : {};
}

const plans = Plans.parse(
	research
		.filter((p) => p.planId in PLAN_FAMILIES)
		.map((p) => {
			const entry = PLAN_FAMILIES[p.planId];
			const {
				lab,
				vendor,
				families,
				includedApiCreditUsd = 0,
				weeklyShareByFamily = {},
			} = entry;
			const unknown = families.filter((f) => !benchmarked.has(f));
			if (unknown.length)
				throw new Error(`${p.planId}: unbenchmarked ${unknown.join(", ")}`);
			const label = entry.shortLabel ?? p.label;
			const allowance = publishedAllowance(p.planId);
			if (p.allowanceKind === "credit" && !allowance)
				throw new Error(`${p.planId}: a credit plan needs its sourced credit`);
			return {
				id: p.planId,
				vendor,
				lab,
				label,
				monthlyPriceUsd: p.monthlyPriceUsd,
				harnesses: p.harnesses,
				families,
				limits: p.limits,
				allowanceKind: p.allowanceKind,
				includedApiCreditUsd,
				thirdPartyHarnessAllowed: p.thirdPartyHarnessAllowed,
				confidence: p.confidence,
				sourceUrl: p.sources[0].url,
				reportedCap:
					codexCap(p.planId, p.monthlyPriceUsd, families) ??
					tierCap(entry, label, families),
				publishedAllowance: allowance,
				weeklyShareByFamily,
				maxEffortByFamily: lab === "opencode" ? OPENCODE_MAX_EFFORT : {},
				promotionByFamily: promotions(lab),
			};
		}),
);

// A plan's value counts its promotions only while they run.
const today = new Date().toISOString().slice(0, 10);
for (const plan of plans)
	for (const [family, promotion] of Object.entries(plan.promotionByFamily))
		if (promotion.endsOn < today)
			throw new Error(
				`${plan.id}: the ${family} promotion ended on ${promotion.endsOn}; delete it and rebuild the plans.`,
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
