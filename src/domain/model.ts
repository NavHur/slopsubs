import { Schema } from "effect";
import {
	AA_EVAL_IDS,
	BENCHMARK_IDS,
	type BenchmarkId,
	EFFORTS,
} from "./enums.ts";
import { IsoDate, UtcTimestamp, UrlString } from "./wire-schemas.ts";

const Effort = Schema.Literals(EFFORTS);
export type Effort = typeof Effort.Type;

const FamilyId = Schema.NonEmptyString.pipe(Schema.brand("FamilyId"));
export type FamilyId = typeof FamilyId.Type;

const PlanId = Schema.NonEmptyString.pipe(Schema.brand("PlanId"));
export type PlanId = typeof PlanId.Type;

const Percentage = Schema.Finite.check(
	Schema.isBetween({ minimum: 0, maximum: 100 }),
);
const PositiveUsd = Schema.Finite.check(Schema.isGreaterThan(0));
const Usd = Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0));

/** One model at one reasoning effort, as one benchmark scored it. */
const BenchmarkPoint = Schema.Struct({
	id: Schema.String,
	family: FamilyId,
	name: Schema.String,
	lab: Schema.String,
	labName: Schema.String,
	deprecated: Schema.Boolean,
	effort: Effort,
	effortLabel: Schema.String,
	effortOrder: Schema.Finite,
	score: Schema.NullOr(Schema.Finite),
	costPerTaskUsd: Schema.NullOr(Usd),
	tokensPerTask: Schema.NullOr(Schema.Finite),
	/** Wall-clock time to finish one task, where the benchmark measured it. */
	secondsPerTask: Schema.NullOr(Schema.Finite),
	inputPricePerMTokUsd: Schema.NullOr(Usd),
	outputPricePerMTokUsd: Schema.NullOr(Usd),
});
export type BenchmarkPoint = typeof BenchmarkPoint.Type;

/** The frontier families' size tier and chart colour, by family id. */
const Frontier = Schema.Record(
	Schema.String,
	Schema.Struct({
		tier: Schema.Literals(["Small", "Medium", "Large"]),
		color: Schema.String,
	}),
);
export type Frontier = typeof Frontier.Type;

/** Artificial Analysis's Intelligence Index, as imported. */
export const BenchmarkDataset = Schema.Struct({
	fetchedAt: UtcTimestamp,
	source: Schema.String,
	frontier: Frontier,
	models: Schema.mutable(Schema.Array(BenchmarkPoint)),
});
export type BenchmarkDataset = typeof BenchmarkDataset.Type;

/** One FrontierCode 2.0 result, keyed by Artificial Analysis family id. */
export const FrontierCodeRow = Schema.Struct({
	family: FamilyId,
	effort: Effort,
	score: Schema.Finite,
	costPerTaskUsd: Schema.NullOr(Usd),
	tokensPerTask: Schema.NullOr(Schema.Finite),
});
export type FrontierCodeRow = typeof FrontierCodeRow.Type;

/** Cognition's FrontierCode 2.0 leaderboard, as imported. */
export const FrontierCodeDataset = Schema.Struct({
	fetchedAt: UtcTimestamp,
	source: Schema.String,
	rows: Schema.mutable(Schema.Array(FrontierCodeRow)),
});
export type FrontierCodeDataset = typeof FrontierCodeDataset.Type;

/** One Artificial Analysis Intelligence Index eval result, by release slug. */
export const AaEvalRow = Schema.Struct({
	family: FamilyId,
	effort: Effort,
	eval: Schema.Literals(AA_EVAL_IDS),
	score: Schema.Finite,
	costPerTaskUsd: Schema.NullOr(Usd),
	tokensPerTask: Schema.NullOr(Schema.Finite),
	secondsPerTask: Schema.NullOr(Schema.Finite),
});
export type AaEvalRow = typeof AaEvalRow.Type;

/** The nine Intelligence Index evals, as imported from the AA website. */
export const AaEvalsDataset = Schema.Struct({
	fetchedAt: UtcTimestamp,
	source: Schema.String,
	evals: Schema.mutable(Schema.Array(Schema.Literals(AA_EVAL_IDS))),
	rows: Schema.mutable(Schema.Array(AaEvalRow)),
});
export type AaEvalsDataset = typeof AaEvalsDataset.Type;

const Leaderboard = Schema.Struct({
	fetchedAt: UtcTimestamp,
	models: Schema.mutable(Schema.Array(BenchmarkPoint)),
});
export type Leaderboard = typeof Leaderboard.Type;

const LEADERBOARD_SHAPE = Object.fromEntries(
	BENCHMARK_IDS.map((id) => [id, Leaderboard]),
) as Record<BenchmarkId, typeof Leaderboard>;

/** What the site ships: each benchmark's points for the families on plans. */
export const ChartData = Schema.Struct({
	frontier: Frontier,
	leaderboards: Schema.Struct(LEADERBOARD_SHAPE),
});
export type ChartData = typeof ChartData.Type;

/**
 * A weekly cap estimated without usage samples: published by someone else, or
 * read off our own gauge by hand. Used until samples measure it.
 */
const ReportedCap = Schema.Struct({
	/**
	 * API-equivalent spend on each model that fills the weekly cap once. Models
	 * differ: a model that fills the gauge faster gets fewer API dollars.
	 */
	weeklyCapApiUsdByFamily: Schema.Record(FamilyId, PositiveUsd),
	by: Schema.String,
	url: UrlString,
	/** How the figure was reached, shown next to it. */
	basis: Schema.String,
});
export type ReportedCap = typeof ReportedCap.Type;

/**
 * A vendor's own statement of how much API-priced usage each model gets per
 * month, for plans whose allowance differs by model.
 */
const PublishedAllowance = Schema.Struct({
	apiUsdPerMonthByFamily: Schema.Record(Schema.String, PositiveUsd),
	url: UrlString,
	basis: Schema.String,
});
export type PublishedAllowance = typeof PublishedAllowance.Type;

/** A limited-time offer a plan's value counts while it runs. */
const Promotion = Schema.Struct({
	/** What the offer is, shown next to the plan's figures. */
	summary: Schema.String,
	endsOn: IsoDate,
	url: UrlString,
});
export type Promotion = typeof Promotion.Type;

/**
 * How a plan's allowance works: a credit plan grants a fixed amount of usage a
 * month at the vendor's rates, in dollars or its own credits; a rate-window
 * plan caps usage per 5-hour window or week.
 */
export const AllowanceKind = Schema.Literals(["credit", "rate-window"]);

/** A flat-rate subscription usable for agentic coding. */
const Plan = Schema.Struct({
	id: PlanId,
	vendor: Schema.String,
	lab: Schema.String,
	label: Schema.String,
	monthlyPriceUsd: PositiveUsd,
	harnesses: Schema.mutable(Schema.Array(Schema.String)).check(
		Schema.isMinLength(1),
	),
	families: Schema.mutable(Schema.Array(FamilyId)).check(Schema.isMinLength(1)),
	limits: Schema.String,
	allowanceKind: AllowanceKind,
	/** Pay-per-token credit bundled with the plan, usable from any harness. */
	includedApiCreditUsd: Usd,
	thirdPartyHarnessAllowed: Schema.Union([
		Schema.Boolean,
		Schema.Literal("unclear"),
	]),
	confidence: Schema.Literals(["primary", "secondary", "unverified"]),
	sourceUrl: UrlString,
	reportedCap: Schema.NullOr(ReportedCap),
	publishedAllowance: Schema.NullOr(PublishedAllowance),
	/**
	 * Fraction of the weekly cap a family may use, where below the whole cap:
	 * Claude Max and Ultra give Fable "up to half your weekly limit". It limits
	 * the family's tasks a week, not its price, which comes from the family's
	 * own weekly cap.
	 */
	weeklyShareByFamily: Schema.Record(
		Schema.String,
		Schema.Finite.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(1)),
	),
	/** Highest effort the plan serves for a family, where below its maximum. */
	maxEffortByFamily: Schema.Record(Schema.String, Effort),
	/** Promotions included in the plan's value, by family. */
	promotionByFamily: Schema.Record(Schema.String, Promotion),
});
export type Plan = typeof Plan.Type;
export const Plans = Schema.mutable(Schema.Array(Plan));

/**
 * API-equivalent spend observed while a plan's weekly-cap gauge moved from
 * `startUsedPercent` to `endUsedPercent`, inside one weekly window.
 */
const LimitSample = Schema.Struct({
	plan: PlanId,
	from: UtcTimestamp,
	to: UtcTimestamp,
	startUsedPercent: Percentage,
	endUsedPercent: Percentage,
	apiUsd: Usd,
	apiUsdByFamily: Schema.Record(Schema.String, Usd),
	host: Schema.String,
}).check(
	Schema.makeFilter(
		(s) =>
			s.endUsedPercent > s.startUsedPercent ||
			"endUsedPercent must exceed startUsedPercent",
	),
);
export type LimitSample = typeof LimitSample.Type;
export const LimitSamples = Schema.mutable(Schema.Array(LimitSample));
