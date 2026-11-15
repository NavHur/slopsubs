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
/** Value multiples within this fraction of each other count as unchanged. */
const MIN_VALUE_RATIO_DELTA = 0.001;

/** Every generated data file, parsed, plus the samples plan values use. */
export type DataSnapshot = {
	benchmarks: BenchmarkDataset;
	aaEvals: AaEvalsDataset;
	frontierCode: FrontierCodeDataset;
	chart: ChartData;
	plans: readonly Plan[];
	samples: readonly LimitSample[];
};

/** The generated files a refresh rewrites, by snapshot field. */
export const GENERATED_FILES = {
	benchmarks: "benchmarks.json",
	aaEvals: "aa-evals.json",
	frontierCode: "frontiercode.json",
	chart: "chart-benchmarks.json",
	plans: "plans.json",
} as const satisfies Partial<Record<keyof DataSnapshot, string>>;
export type GeneratedFile =
	(typeof GENERATED_FILES)[keyof typeof GENERATED_FILES];

export type FamilyChange = { family: FamilyId; name: string };

export type ScoreChange = {
	benchmark: BenchmarkId;
	family: FamilyId;
	name: string;
	effortLabel: string;
	before: number;
	after: number;
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
	before: number | null;
	after: number | null;
};

export type DataChanges = {
	/** Families in AA's catalog, on a plan or not. */
	familiesAdded: FamilyChange[];
	familiesRemoved: FamilyChange[];
	/** Shipped scores that moved by at least MIN_SCORE_DELTA. */
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
	return {
		...families,
		scores: BENCHMARK_IDS.flatMap((id) =>
			scoreChanges(id, before.chart, after.chart),
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

function scoreChanges(
	benchmark: BenchmarkId,
	before: ChartData,
	after: ChartData,
): ScoreChange[] {
	const old = byPoint(before.leaderboards[benchmark].models);
	return after.leaderboards[benchmark].models.flatMap((point) => {
		const was = old.get(`${point.family}@${point.effort}`)?.score ?? null;
		if (was === null || point.score === null) return [];
		if (Math.abs(point.score - was) < MIN_SCORE_DELTA) return [];
		return [
			{
				benchmark,
				family: point.family,
				name: point.name,
				effortLabel: point.effortLabel,
				before: was,
				after: point.score,
			},
		];
	});
}

/** Each shipped family's list price, from its first priced point. */
function listPrices(chart: ChartData) {
	const prices = new Map<FamilyId, { name: string; price: ListPrice }>();
	for (const p of chart.leaderboards.intelligence.models) {
		if (prices.has(p.family) || p.inputPricePerMTokUsd === null) continue;
		prices.set(p.family, {
			name: p.name,
			price: { input: p.inputPricePerMTokUsd, output: p.outputPricePerMTokUsd },
		});
	}
	return prices;
}

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
	const values = new Map<string, Omit<ValueChange, "before" | "after">>();
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
	const keys = new Set([...old.values.keys(), ...fresh.values.keys()]);
	return [...keys].flatMap((key) => {
		const was = old.multiples.get(key) ?? null;
		const now = fresh.multiples.get(key) ?? null;
		if (sameValue(was, now)) return [];
		const plan = fresh.values.get(key) ?? old.values.get(key);
		if (!plan) throw new Error(`No plan for value key ${key}`);
		return [{ ...plan, before: was, after: now }];
	});
}

/** The value as JSON with every fetch timestamp left out. */
function withoutTimestamps(value: unknown): string {
	return JSON.stringify(value, (key, field: unknown) =>
		key === "fetchedAt" ? undefined : field,
	);
}

function fileChanges(before: DataSnapshot, after: DataSnapshot) {
	const files = Object.entries(GENERATED_FILES) as [
		keyof typeof GENERATED_FILES,
		GeneratedFile,
	][];
	const differs = ([field]: (typeof files)[number]) =>
		withoutTimestamps(before[field]) !== withoutTimestamps(after[field]);
	const moved = ([field]: (typeof files)[number]) =>
		JSON.stringify(before[field]) !== JSON.stringify(after[field]);
	return {
		changedFiles: files.filter(differs).map(([, file]) => file),
		refetchedFiles: files
			.filter((f) => moved(f) && !differs(f))
			.map(([, file]) => file),
	};
}
