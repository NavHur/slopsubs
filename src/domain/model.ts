import { z } from "zod";

export const EFFORTS = [
	"none",
	"minimal",
	"low",
	"medium",
	"default",
	"high",
	"xhigh",
	"max",
] as const;
const Effort = z.enum(EFFORTS);
export type Effort = z.infer<typeof Effort>;

const FamilyId = z.string().min(1).brand<"FamilyId">();
export type FamilyId = z.infer<typeof FamilyId>;

const PlanId = z.string().min(1).brand<"PlanId">();
export type PlanId = z.infer<typeof PlanId>;

const Usd = z.number().nonnegative();

/** One model at one reasoning effort, as one benchmark scored it. */
const BenchmarkPoint = z.object({
	id: z.string(),
	family: FamilyId,
	name: z.string(),
	lab: z.string(),
	labName: z.string(),
	deprecated: z.boolean(),
	effort: Effort,
	effortLabel: z.string(),
	effortOrder: z.number(),
	score: z.number().nullable(),
	costPerTaskUsd: Usd.nullable(),
	tokensPerTask: z.number().nullable(),
	/** Wall-clock time to finish one task, where the benchmark measured it. */
	secondsPerTask: z.number().nullable(),
	inputPricePerMTokUsd: Usd.nullable(),
	outputPricePerMTokUsd: Usd.nullable(),
});
export type BenchmarkPoint = z.infer<typeof BenchmarkPoint>;

/**
 * Slopalytics' coding score for one catalog point: Terminal-Bench 4.0 and
 * FrontierCode 2.0 weighted equally, costed on those evals alone.
 */
const CodingScore = z.object({
	score: z.number(),
	costPerTaskUsd: Usd.nullable(),
	tokensPerTask: z.number().nullable(),
});

/** A catalog point, with its coding score where it was run on the evals. */
const CatalogPoint = BenchmarkPoint.extend({
	coding: CodingScore.nullable(),
});
export type CatalogPoint = z.infer<typeof CatalogPoint>;

/** The frontier families' size tier and chart colour, by family id. */
const Frontier = z.record(
	z.string(),
	z.object({ tier: z.enum(["Small", "Medium", "Large"]), color: z.string() }),
);
export type Frontier = z.infer<typeof Frontier>;

/** Artificial Analysis's Intelligence Index, as imported. */
export const BenchmarkDataset = z.object({
	fetchedAt: z.iso.datetime(),
	source: z.string(),
	frontier: Frontier,
	models: z.array(CatalogPoint),
});
export type BenchmarkDataset = z.infer<typeof BenchmarkDataset>;

/** One FrontierCode 2.0 result, keyed by Artificial Analysis family id. */
export const FrontierCodeRow = z.object({
	family: FamilyId,
	effort: Effort,
	score: z.number(),
	costPerTaskUsd: Usd.nullable(),
	tokensPerTask: z.number().nullable(),
});
export type FrontierCodeRow = z.infer<typeof FrontierCodeRow>;

/** Cognition's FrontierCode 2.0 leaderboard, as imported. */
export const FrontierCodeDataset = z.object({
	fetchedAt: z.iso.datetime(),
	source: z.string(),
	rows: z.array(FrontierCodeRow),
});

/** The benchmarks the chart can plot, in tab order. */
export const BENCHMARK_IDS = ["intelligence", "frontiercode"] as const;
export type BenchmarkId = (typeof BENCHMARK_IDS)[number];

/** What the chart can plot: each tab, and the coding score "Code only" swaps in. */
export const LEADERBOARD_IDS = [...BENCHMARK_IDS, "coding"] as const;
export type LeaderboardId = (typeof LEADERBOARD_IDS)[number];

const Leaderboard = z.object({
	fetchedAt: z.iso.datetime(),
	models: z.array(BenchmarkPoint),
});
export type Leaderboard = z.infer<typeof Leaderboard>;

/** What the site ships: each benchmark's points for the families on plans. */
export const ChartData = z.object({
	frontier: Frontier,
	leaderboards: z.object({
		intelligence: Leaderboard,
		frontiercode: Leaderboard,
		coding: Leaderboard,
	} satisfies Record<LeaderboardId, typeof Leaderboard>),
});

/** A weekly cap someone else published, used until we measure our own. */
const ReportedCap = z.object({
	/** API-equivalent spend that fills the weekly cap once. */
	weeklyCapApiUsd: Usd.positive(),
	by: z.string(),
	url: z.url(),
	/** How the figure was reached, shown next to it. */
	basis: z.string(),
});
export type ReportedCap = z.infer<typeof ReportedCap>;

/**
 * A vendor's own statement of how much API-priced usage each model gets per
 * month, for plans whose allowance differs by model.
 */
const PublishedAllowance = z.object({
	apiUsdPerMonthByFamily: z.record(z.string(), Usd.positive()),
	url: z.url(),
	basis: z.string(),
});
export type PublishedAllowance = z.infer<typeof PublishedAllowance>;

/** A limited-time discount a plan's value counts while it runs. */
const Promotion = z.object({
	/** What the discount is, shown next to the plan's figures. */
	summary: z.string(),
	endsOn: z.iso.date(),
	url: z.url(),
});
export type Promotion = z.infer<typeof Promotion>;

/** A flat-rate subscription usable for agentic coding. */
const Plan = z.object({
	id: PlanId,
	vendor: z.string(),
	lab: z.string(),
	label: z.string(),
	monthlyPriceUsd: Usd.positive(),
	harnesses: z.array(z.string()).min(1),
	families: z.array(FamilyId).min(1),
	limits: z.string(),
	/** Pay-per-token credit bundled with the plan, usable from any harness. */
	includedApiCreditUsd: Usd,
	thirdPartyHarnessAllowed: z.union([z.boolean(), z.literal("unclear")]),
	confidence: z.enum(["primary", "secondary", "unverified"]),
	sourceUrl: z.url(),
	reportedCap: ReportedCap.nullable(),
	publishedAllowance: PublishedAllowance.nullable(),
	/**
	 * Fraction of the weekly cap a family may use, where below the whole cap:
	 * Claude Max and Ultra give Fable "up to half your weekly limit".
	 */
	weeklyShareByFamily: z.record(z.string(), z.number().gt(0).lte(1)),
	/** Highest effort the plan serves for a family, where below its maximum. */
	maxEffortByFamily: z.record(z.string(), Effort),
	/** Promotions included in the plan's value, by family. */
	promotionByFamily: z.record(z.string(), Promotion),
});
export type Plan = z.infer<typeof Plan>;
export const Plans = z.array(Plan);

/**
 * API-equivalent spend observed while a plan's weekly-cap gauge moved from
 * `startUsedPercent` to `endUsedPercent`, inside one weekly window.
 */
const LimitSample = z
	.object({
		plan: PlanId,
		from: z.iso.datetime(),
		to: z.iso.datetime(),
		startUsedPercent: z.number().min(0).max(100),
		endUsedPercent: z.number().min(0).max(100),
		apiUsd: Usd,
		apiUsdByFamily: z.record(z.string(), Usd),
		host: z.string(),
	})
	.refine((s) => s.endUsedPercent > s.startUsedPercent, {
		message: "endUsedPercent must exceed startUsedPercent",
	});
export type LimitSample = z.infer<typeof LimitSample>;
export const LimitSamples = z.array(LimitSample);
