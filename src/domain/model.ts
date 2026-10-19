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

/** One model at one reasoning effort, as benchmarked by Artificial Analysis. */
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
	intelligence: z.number().nullable(),
	costPerTaskUsd: Usd.nullable(),
	tokensPerTask: z.number().nullable(),
	inputPricePerMTokUsd: Usd.nullable(),
	outputPricePerMTokUsd: Usd.nullable(),
});
export type BenchmarkPoint = z.infer<typeof BenchmarkPoint>;

export const BenchmarkDataset = z.object({
	fetchedAt: z.iso.datetime(),
	source: z.string(),
	frontier: z.record(
		z.string(),
		z.object({ tier: z.enum(["Small", "Medium", "Large"]), color: z.string() }),
	),
	models: z.array(BenchmarkPoint),
});
export type BenchmarkDataset = z.infer<typeof BenchmarkDataset>;

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
	/** Highest effort the plan serves for a family, where below its maximum. */
	maxEffortByFamily: z.record(z.string(), Effort),
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
