// What a data refresh changed, in the terms a reviewer checks: models added or
// removed, scores that moved, list prices, and plan value multiples.

import { BENCHMARK_IDS, type BenchmarkId } from "./enums";
import type {
	AaEvalsDataset,
	BenchmarkDataset,
	BenchmarkPoint,
	ChartData,
	FamilyId,
	FrontierCodeDataset,
	LimitSample,
	Plan,
	PlanId,
} from "./model";
import { planCapacity, valueMultiple, weeklyAllowance } from "./value";

/** Score moves smaller than this many points are rounding, not news. */
const MIN_SCORE_DELTA = 0.1;
/** Binary float error: 70.1 - 70 is 0.0999999..., not 0.1. */
const FLOAT_TOLERANCE = 1e-9;
/** Value multiples within this fraction of each other count as unchanged. */
const MIN_VALUE_RATIO_DELTA = 0.001;

/** The generated files a refresh rewrites, by snapshot field. */
export const GENERATED_FILES = {
	benchmarks: "benchmarks.json",
	aaEvals: "aa-evals.json",
	frontierCode: "frontiercode.json",
	chart: "chart-benchmarks.json",
	plans: "plans.json",
} as const;
export type GeneratedField = keyof typeof GENERATED_FILES;
export type GeneratedFile = (typeof GENERATED_FILES)[GeneratedField];

/**
 * Every generated data file, parsed, plus the samples plan values use. `raw`
 * holds each file's JSON as written, since parsing drops fields the schema
 * does not name.
 */
export type DataSnapshot = {
	benchmarks: BenchmarkDataset;
	aaEvals: AaEvalsDataset;
	frontierCode: FrontierCodeDataset;
	chart: ChartData;
	plans: readonly Plan[];
	samples: readonly LimitSample[];
	raw: Readonly<Record<GeneratedField, unknown>>;
};

export type FamilyChange = { family: FamilyId; name: string };

/** A null side is a point that appeared or lost its score. */
export type ScoreChange = {
	benchmark: BenchmarkId;
	family: FamilyId;
	name: string;
	effortLabel: string;
	before: number | null;
	after: number | null;
};

type ListPrice = { input: number | null; output: number | null };

export type PriceChange = {
	family: FamilyId;
	name: string;
	before: ListPrice;
	after: ListPrice;
};

/** A plan's value multiple for one family; null where it had none. */
export type ValueChange = {
	planId: PlanId;
	label: string;
	family: FamilyId;
	/** The family's display name. */
	name: string;
	before: number | null;
	after: number | null;
};

export type DataChanges = {
	/** Families in the benchmarks.json catalog: Slopalytics points, plus AA-only
	 * models on a plan. */
	familiesAdded: FamilyChange[];
	familiesRemoved: FamilyChange[];
	/** Shipped scores that moved by at least MIN_SCORE_DELTA, and points that
	 * appeared or lost their score. */
	scores: ScoreChange[];
	/** List prices of the families the site ships. */
	prices: PriceChange[];
	planValues: ValueChange[];
	/** Files whose content changed beyond their fetch timestamps. */
	changedFiles: GeneratedFile[];
	/** Files whose only change is their fetch timestamps. */
	refetchedFiles: GeneratedFile[];
};

/** Whether anything beyond fetch timestamps changed. */
export function hasDataChanges(changes: DataChanges): boolean {
	return changes.changedFiles.length > 0;
}

export function summarizeDataChanges(
	before: DataSnapshot,
	after: DataSnapshot,
): DataChanges {
	const families = familyChanges(before.benchmarks, after.benchmarks);
	const catalogChanged = new Set(
		[...families.familiesAdded, ...families.familiesRemoved].map(
			(f) => f.family,
		),
	);
	return {
		...families,
		scores: BENCHMARK_IDS.flatMap((id) =>
			scoreChanges(id, before.chart, after.chart, catalogChanged),
		),
		prices: priceChanges(before.chart, after.chart),
		planValues: valueChanges(before, after),
		...fileChanges(before, after),
	};
}

function familyNames(dataset: BenchmarkDataset): Map<FamilyId, string> {
	return new Map(dataset.models.map((m) => [m.family, m.name]));
}

function missingFrom(
	from: Map<FamilyId, string>,
	other: Map<FamilyId, string>,
): FamilyChange[] {
	return [...from]
		.filter(([family]) => !other.has(family))
		.map(([family, name]) => ({ family, name }));
}

function familyChanges(before: BenchmarkDataset, after: BenchmarkDataset) {
	const old = familyNames(before);
	const fresh = familyNames(after);
	return {
		familiesAdded: missingFrom(fresh, old),
		familiesRemoved: missingFrom(old, fresh),
	};
}

function byPoint(points: readonly BenchmarkPoint[]) {
	return new Map(points.map((p) => [`${p.family}@${p.effort}`, p]));
}

/** Whether a score moved enough to list; a point gained or lost always does. */
function isScoreMove(was: number | null, now: number | null): boolean {
	if (was === null || now === null) return was !== now;
	return Math.abs(now - was) >= MIN_SCORE_DELTA - FLOAT_TOLERANCE;
}

/** A family added to or dropped from the catalog has its own catalog entry,
 * so its points are skipped here. */
function scoreChanges(
	benchmark: BenchmarkId,
	before: ChartData,
	after: ChartData,
	catalogChanged: ReadonlySet<FamilyId>,
): ScoreChange[] {
	const old = byPoint(before.leaderboards[benchmark].models);
	const fresh = byPoint(after.leaderboards[benchmark].models);
	return [...new Map([...old, ...fresh])].flatMap(([key, point]) => {
		const was = old.get(key)?.score ?? null;
		const now = fresh.get(key)?.score ?? null;
		if (catalogChanged.has(point.family) || !isScoreMove(was, now)) return [];
		const { family, name, effortLabel } = point;
		return [{ benchmark, family, name, effortLabel, before: was, after: now }];
	});
}

/** 2 for a price with both sides, 1 for one side, 0 for neither. */
function priceRank(price: ListPrice): number {
	return Number(price.input !== null) + Number(price.output !== null);
}

/** Each family's list price: one point's, the first with both prices, else one. */
function listPrices(chart: ChartData) {
	const prices = new Map<FamilyId, { name: string; price: ListPrice }>();
	for (const p of chart.leaderboards.intelligence.models) {
		const price = {
			input: p.inputPricePerMTokUsd,
			output: p.outputPricePerMTokUsd,
		};
		const seen = prices.get(p.family);
		if (!seen || priceRank(price) > priceRank(seen.price)) {
			prices.set(p.family, { name: p.name, price });
		}
	}
	return prices;
}

/** A family on one side of the intelligence board only is newly shipped or dropped. */
function priceChanges(before: ChartData, after: ChartData): PriceChange[] {
	const old = listPrices(before);
	return [...listPrices(after)].flatMap(([family, { name, price }]) => {
		const was = old.get(family)?.price;
		if (!was) return [];
		if (was.input === price.input && was.output === price.output) return [];
		return [{ family, name, before: was, after: price }];
	});
}

/** Every plan's value multiple per family, keyed "plan@family". */
function valueMultiples(snapshot: DataSnapshot) {
	const values = new Map<
		string,
		Omit<ValueChange, "before" | "after" | "name">
	>();
	const multiples = new Map<string, number>();
	for (const plan of snapshot.plans) {
		const capacity = planCapacity(plan, snapshot.samples);
		for (const family of plan.families) {
			const key = `${plan.id}@${family}`;
			values.set(key, { planId: plan.id, label: plan.label, family });
			const allowance = weeklyAllowance(plan, capacity, family);
			if (allowance) multiples.set(key, valueMultiple({ plan, allowance }));
		}
	}
	return { values, multiples };
}

function sameValue(a: number | null, b: number | null): boolean {
	if (a === null || b === null) return a === b;
	return Math.abs(a - b) <= MIN_VALUE_RATIO_DELTA * Math.max(a, b);
}

function valueChanges(
	before: DataSnapshot,
	after: DataSnapshot,
): ValueChange[] {
	const old = valueMultiples(before);
	const fresh = valueMultiples(after);
	const values = new Map([...old.values, ...fresh.values]);
	const names = new Map([
		...familyNames(before.benchmarks),
		...familyNames(after.benchmarks),
	]);
	return [...values].flatMap(([key, plan]) => {
		const was = old.multiples.get(key) ?? null;
		const now = fresh.multiples.get(key) ?? null;
		if (sameValue(was, now)) return [];
		const name = names.get(plan.family) ?? plan.family;
		return [{ ...plan, name, before: was, after: now }];
	});
}

/** The value as JSON with every fetch timestamp left out. */
function withoutTimestamps(value: unknown): string {
	return JSON.stringify(value, (key, field: unknown) =>
		key === "fetchedAt" ? undefined : field,
	);
}

/** Compares the files as written, so fields the schema drops still count. */
function fileChanges(
	{ raw: before }: DataSnapshot,
	{ raw: after }: DataSnapshot,
) {
	const files = Object.entries(GENERATED_FILES) as [
		GeneratedField,
		GeneratedFile,
	][];
	const changedBeyondTimestamps = ([field]: (typeof files)[number]) =>
		withoutTimestamps(before[field]) !== withoutTimestamps(after[field]);
	const textChanged = ([field]: (typeof files)[number]) =>
		JSON.stringify(before[field]) !== JSON.stringify(after[field]);
	return {
		changedFiles: files.filter(changedBeyondTimestamps).map(([, file]) => file),
		refetchedFiles: files
			.filter((f) => textChanged(f) && !changedBeyondTimestamps(f))
			.map(([, file]) => file),
	};
}
