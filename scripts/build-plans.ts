// Builds src/data/plans.json from research/plans/, and the trimmed
// chart-benchmarks.json from the imported leaderboards.

import { Clock, Data, Effect, Schema } from "effect";
import { AA_EVAL_IDS } from "../src/domain/enums.ts";
import type { AaEvalId } from "../src/domain/eval-units.ts";
import {
	evalPoints,
	frontierCodePoints,
	LeaderboardDataError,
} from "../src/domain/leaderboards.ts";
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
import { UrlString } from "../src/domain/wire-schemas.ts";
import { CLAUDE_ULTRA } from "./claude-caps.ts";
import { creditAllowance, creditPromotions } from "./credit-plans.ts";
import { CREDIT_PLANS } from "./credit-vendors.ts";
import { readJsonFile, TextFiles } from "./effects/files.ts";
import { type GoTier, goPlan } from "./go-plans.ts";
import { GO_PRICING, OPENCODE_DOCS } from "./go-pricing.ts";
import type { TokenRates } from "./list-price.ts";
import { MUSE_EVERYDAY } from "./muse-caps.ts";
import { PLAN_FAMILIES } from "./plan-families.ts";
import { type KnownTier, type Ladder, ladderCap } from "./tier-ladder.ts";
import { WEEKLY_CREDIT_PLANS, weeklyCreditCap } from "./weekly-credit-caps.ts";

const ROOT = new URL("..", import.meta.url);

/** Max effort on Muse Spark is only served by Meta's own API. */
const OPENCODE_MAX_EFFORT = {
	"muse-spark-1-3": "xhigh",
	"muse-spark-1-2": "xhigh",
} as const;

const GO_TIERS: Partial<Record<string, GoTier>> = {
	"opencode-go": 0,
	"opencode-go-plus": 1,
};

/** Each tier ladder's reported tier, which its other tiers scale from. A
 * ladder without one ships its plans unmeasured. */
const KNOWN_TIERS: Partial<Record<Ladder, KnownTier>> = {
	claude: CLAUDE_ULTRA,
	"muse-code": MUSE_EVERYDAY,
};

// Theo (t3.gg), "OpenAI is getting desperate", 2026-11-02, 5:08: "on the $500
// plan, you now get around $10.5,000 of usage. And on the $200 plan... 4.3K".
const THEO = {
	by: "Theo",
	url: "https://www.youtube.com/watch?v=Hq2c7pww1Ds&t=308s",
};
// mypriors' plan builder, read 2026-11-23: each Google AI tier's own multiple.
const MYPRIORS = { by: "mypriors", url: "https://mypriors.com/builder" };
const WEEKS_PER_MONTH = 52 / 12;
const CODEX_PRO_MULTIPLE = 21;

/** Who reported a plan's multiple: the API-priced dollars a month each dollar
 * of its price (or of `listPriceUsd`) buys, on every model the plan serves. */
type ReportedMultiple = {
	by: string;
	url: string;
	multiple: number;
	/** The list price the multiple is of, for a plan sold below it: the same
	 * plan at a deal price has the same usage, not a multiple of its own. */
	listPriceUsd?: number;
};

const GOOGLE_PRO_LIST_PRICE_USD = 19.99;
const GOOGLE_PRO_MULTIPLE = { ...MYPRIORS, multiple: 23 };
const GOOGLE_PRO_DEAL = {
	...GOOGLE_PRO_MULTIPLE,
	listPriceUsd: GOOGLE_PRO_LIST_PRICE_USD,
};

/**
 * Theo's 21x on every Codex Pro tier (2026-11-02), with Plus at half: Pro 100,
 * 200 and 500 give 10x, 20x and 50x Plus's usage, so a Pro dollar buys twice
 * what a Plus dollar does.
 */
const REPORTED_MULTIPLES: Record<string, ReportedMultiple> = {
	"chatgpt-plus": { ...THEO, multiple: CODEX_PRO_MULTIPLE / 2 },
	"chatgpt-pro-100": { ...THEO, multiple: CODEX_PRO_MULTIPLE },
	"chatgpt-pro-200": { ...THEO, multiple: CODEX_PRO_MULTIPLE },
	"chatgpt-pro-500": { ...THEO, multiple: CODEX_PRO_MULTIPLE },
	"google-ai-pro": GOOGLE_PRO_MULTIPLE,
	"google-ai-pro-deal-4-99": GOOGLE_PRO_DEAL,
	"google-ai-pro-deal-9-99": GOOGLE_PRO_DEAL,
	"google-ai-pro-annual": GOOGLE_PRO_DEAL,
	"google-ai-ultra-5x": { ...MYPRIORS, multiple: 24 },
	"google-ai-ultra-20x": { ...MYPRIORS, multiple: 49 },
};

/** The plan's weekly cap from a reported multiple of its price (or of its
 * `listPriceUsd`), the same on each model, or null with no reported multiple. */
function multipleCap(
	planId: string,
	monthlyPriceUsd: number,
	families: readonly string[],
): ReportedCap | null {
	const reported = REPORTED_MULTIPLES[planId];
	if (reported === undefined) return null;
	const pricedAtUsd = reported.listPriceUsd ?? monthlyPriceUsd;
	const monthlyApiUsd = pricedAtUsd * reported.multiple;
	const weekly = monthlyApiUsd / WEEKS_PER_MONTH;
	return {
		weeklyCapApiUsdByFamily: Object.fromEntries(
			families.map((family) => [family, weekly]),
		),
		by: reported.by,
		url: reported.url,
		basis: `${reported.by}: ${reported.multiple}x the ${reported.listPriceUsd === undefined ? "price" : `$${reported.listPriceUsd} list price`}, $${Math.round(monthlyApiUsd).toLocaleString("en-US")} a month of API-priced inference`,
	};
}

const ResearchPlan = Schema.Struct({
	vendor: Schema.String,
	planId: Schema.String,
	label: Schema.String,
	monthlyPriceUsd: Schema.Finite,
	harnesses: Schema.mutable(Schema.Array(Schema.String)),
	limits: Schema.String,
	allowanceKind: AllowanceKind,
	/** Only plans on sale ship; the others stay in research with the reason. */
	availability: Schema.Literals(["on-sale", "closed", "discontinued"]),
	thirdPartyHarnessAllowed: Schema.Union([
		Schema.Boolean,
		Schema.Literal("unclear"),
	]),
	sources: Schema.NonEmptyArray(
		Schema.Struct({ url: UrlString, accessed: Schema.String }),
	),
	confidence: Schema.Literals(["primary", "secondary", "unverified"]),
});

type ResearchPlan = typeof ResearchPlan.Type;

class PlanDataError extends Data.TaggedError("PlanDataError")<{
	message: string;
}> {}

/** Every researched plan, from one file per vendor, in file-name order. */
const readResearch = Effect.gen(function* () {
	const files = yield* TextFiles;
	const dir = new URL("research/plans/", ROOT);
	const names = (yield* files.list(dir))
		.map((entry) => entry.name)
		.filter((name) => name.endsWith(".json"))
		.sort();
	const rows = yield* Effect.forEach(
		names,
		(name) => readJsonFile(Schema.Array(ResearchPlan), new URL(name, dir)),
		{ concurrency: 4 },
	);
	return rows.flat();
});

function checkResearch(research: readonly ResearchPlan[]) {
	const missing = Object.keys(PLAN_FAMILIES).filter(
		(id) => !research.some((p) => p.planId === id),
	);
	if (missing.length)
		throw new PlanDataError({
			message: `Plans not in research: ${missing.join(", ")}`,
		});
	const offSale = research.filter(
		(p) => p.planId in PLAN_FAMILIES && p.availability !== "on-sale",
	);
	if (offSale.length)
		throw new PlanDataError({
			message: `Plans no longer on sale can't ship: ${offSale.map((p) => `${p.planId} (${p.availability})`).join(", ")}`,
		});
}

type ListRates = (family: string) => TokenRates;

/** The family's list [input, output] $/MTok, from the benchmark catalog. */
function listRates(
	models: readonly BenchmarkPoint[],
	family: string,
): TokenRates {
	const list = models.find(
		(m) => m.family === family && m.inputPricePerMTokUsd !== null,
	);
	if (!list?.inputPricePerMTokUsd || !list.outputPricePerMTokUsd)
		throw new PlanDataError({
			message: `${family}: no list price to value its allowance at`,
		});
	return [list.inputPricePerMTokUsd, list.outputPricePerMTokUsd];
}

/** The vendor's own statement of each model's monthly usage: OpenCode Go's
 * per-model dollars, or a credit plan's credit valued at list price. */
function publishedAllowance(
	planId: string,
	priceUsd: number,
	families: readonly string[],
	listRates: ListRates,
): PublishedAllowance | null {
	const credit = CREDIT_PLANS[planId];
	if (credit) return creditAllowance(credit, priceUsd, families, listRates);
	const tier = GO_TIERS[planId];
	if (tier === undefined) return null;
	return {
		apiUsdPerMonthByFamily: goPlan(GO_PRICING, tier, families, listRates)
			.apiUsdPerMonthByFamily,
		url: OPENCODE_DOCS,
		basis:
			"OpenCode's published monthly usage for each model, at list prices, with current promos",
	};
}

/** A weekly credit quota's estimated cap, for plans billed in credits. */
function creditCap(
	p: ResearchPlan,
	families: readonly string[],
	listRates: ListRates,
): ReportedCap | null {
	const plan = WEEKLY_CREDIT_PLANS[p.planId];
	if (!plan) return null;
	requireCited(p, plan.url, "weekly credits");
	return weeklyCreditCap(plan, families, listRates);
}

/** The limited-time promotions a plan's allowance counts, by family. */
function promotions(
	planId: string,
	families: readonly string[],
	listRates: ListRates,
): Record<string, Promotion> {
	const credit = CREDIT_PLANS[planId];
	if (credit) return creditPromotions(credit, families);
	const tier = GO_TIERS[planId];
	if (tier === undefined) return {};
	return goPlan(GO_PRICING, tier, families, listRates).promotionByFamily;
}

/** A plan has a credit exactly when its research row says credit, and the
 * credit cites a page that row lists. */
function requireSourcedCredit(
	p: ResearchPlan,
	allowance: PublishedAllowance | null,
): void {
	if (p.planId in CREDIT_PLANS && p.allowanceKind !== "credit")
		throw new PlanDataError({
			message: `${p.planId}: it has a credit, but its research row says ${p.allowanceKind}`,
		});
	if (p.allowanceKind !== "credit") return;
	if (!allowance)
		throw new PlanDataError({
			message: `${p.planId}: a credit plan needs its sourced credit`,
		});
	requireCited(p, allowance.url, "credit");
}

/** Refuses a figure whose page the plan's research row does not list. */
function requireCited(p: ResearchPlan, url: string, figure: string): void {
	if (!p.sources.some((source) => source.url === url))
		throw new PlanDataError({
			message: `${p.planId}: its ${figure} figure cites ${url}, which its research row does not list`,
		});
}

function planRows(
	research: readonly ResearchPlan[],
	models: readonly BenchmarkPoint[],
) {
	checkResearch(research);
	const benchmarked = new Set<string>(models.map((m) => m.family));
	const rates: ListRates = (family) => listRates(models, family);
	return research
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
				throw new PlanDataError({
					message: `${p.planId}: unbenchmarked ${unknown.join(", ")}`,
				});
			const label = entry.shortLabel ?? p.label;
			const allowance = publishedAllowance(
				p.planId,
				p.monthlyPriceUsd,
				families,
				rates,
			);
			requireSourcedCredit(p, allowance);
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
					multipleCap(p.planId, p.monthlyPriceUsd, families) ??
					creditCap(p, families, rates) ??
					ladderCap(KNOWN_TIERS, entry.tier, label, families),
				publishedAllowance: allowance,
				weeklyShareByFamily,
				maxEffortByFamily: lab === "opencode" ? OPENCODE_MAX_EFFORT : {},
				promotionByFamily: promotions(p.planId, families, rates),
			};
		});
}

/** A plan's value counts its promotions only while they run. */
function checkPromotions(plans: typeof Plans.Type, today: string) {
	for (const plan of plans)
		for (const [family, promotion] of Object.entries(plan.promotionByFamily))
			if (promotion.endsOn < today)
				throw new PlanDataError({
					message: `${plan.id}: the ${family} promotion ended on ${promotion.endsOn}; delete it and rebuild the plans.`,
				});
}

// Filter out uncovered rows before resolving them against the catalog.
function chartData({
	plans,
	dataset,
	frontierCode,
	aaEvals,
}: {
	plans: typeof Plans.Type;
	dataset: BenchmarkDataset;
	frontierCode: FrontierCodeDataset;
	aaEvals: AaEvalsDataset;
}) {
	const { models } = dataset;
	const covered = new Set<string>(plans.flatMap((p) => p.families));
	const onPlans = <T extends { family: string }>(points: readonly T[]) =>
		points.filter((m) => covered.has(m.family));
	const evalBoard = (evalSlug: AaEvalId) => ({
		fetchedAt: aaEvals.fetchedAt,
		models: evalPoints(onPlans(aaEvals.rows), models, evalSlug),
	});
	const evalBoards = Object.fromEntries(
		AA_EVAL_IDS.map((id) => [id, evalBoard(id)]),
	) as Record<AaEvalId, ReturnType<typeof evalBoard>>;
	return {
		frontier: dataset.frontier,
		leaderboards: {
			intelligence: { fetchedAt: dataset.fetchedAt, models: onPlans(models) },
			frontiercode: {
				fetchedAt: frontierCode.fetchedAt,
				models: frontierCodePoints(onPlans(frontierCode.rows), models),
			},
			...evalBoards,
		},
	};
}

/** Known input inconsistencies stop the build. Keep unexpected exceptions as defects. */
function checkPlanData<A>(evaluate: () => A) {
	return Effect.try({
		try: evaluate,
		catch: (cause) => {
			if (
				cause instanceof PlanDataError ||
				cause instanceof LeaderboardDataError
			)
				return cause;
			throw cause;
		},
	});
}

const main = Effect.gen(function* () {
	const files = yield* TextFiles;
	const data = new URL("src/data/", ROOT);
	const { research, dataset, frontierCode, aaEvals } = yield* Effect.all(
		{
			research: readResearch,
			dataset: readJsonFile(BenchmarkDataset, new URL("benchmarks.json", data)),
			frontierCode: readJsonFile(
				FrontierCodeDataset,
				new URL("frontiercode.json", data),
			),
			aaEvals: readJsonFile(AaEvalsDataset, new URL("aa-evals.json", data)),
		},
		{ concurrency: 4 },
	);

	const plans = yield* Schema.decodeUnknownEffect(Plans)(
		yield* checkPlanData(() => planRows(research, dataset.models)),
	);
	const today = new Date(yield* Clock.currentTimeMillis)
		.toISOString()
		.slice(0, 10);
	yield* checkPlanData(() => checkPromotions(plans, today));
	const chart = yield* Schema.decodeUnknownEffect(ChartData)(
		yield* checkPlanData(() =>
			chartData({ plans, dataset, frontierCode, aaEvals }),
		),
	);

	yield* files.write(
		new URL("plans.json", data),
		`${JSON.stringify(plans, null, 2)}\n`,
	);
	yield* files.write(
		new URL("chart-benchmarks.json", data),
		`${JSON.stringify(chart)}\n`,
	);
	const counts = Object.entries(chart.leaderboards).map(
		([id, board]) => `${board.models.length} ${id}`,
	);
	console.log(
		`Wrote ${plans.length} plans and ${counts.join(", ")} chart benchmark points`,
	);
});

await Effect.runPromise(main.pipe(Effect.provide(TextFiles.layer)));
