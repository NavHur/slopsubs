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

/** How much of the weekly cap a subscriber actually uses. */
export type UsageProfile = {
	id: "maxed" | "heavy" | "light";
	label: string;
	weeklyCapShare: number;
};

export const USAGE_PROFILES = [
	{ id: "maxed", label: "Maxed", weeklyCapShare: 1 },
	{ id: "heavy", label: "Heavy", weeklyCapShare: 0.6 },
	{ id: "light", label: "Light", weeklyCapShare: 0.2 },
] as const satisfies readonly UsageProfile[];
