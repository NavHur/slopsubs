import { z } from "zod";
import { benchmarks, plans } from "#/data";
import {
	type BenchmarkDataset,
	type Effort,
	type FamilyId,
	type PlanId,
	USAGE_PROFILES,
} from "#/domain/model";

/** Reasoning efforts the Models panel can hide; "default" always shows. */
export const REASONING_LEVELS = [
	"none",
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
] as const satisfies readonly Effort[];
export type ReasoningLevel = (typeof REASONING_LEVELS)[number];

/** Chart state, kept in the URL so every view is shareable. */
export const ViewSearch = z.object({
	profile: z.enum(["maxed", "heavy", "light"]).default("maxed"),
	scale: z.enum(["log", "linear"]).default("log"),
	pareto: z.boolean().default(false),
	api: z.boolean().default(true),
	plans: z.array(z.string()).optional(),
	families: z.array(z.string()).optional(),
	hideReasoning: z.array(z.enum(REASONING_LEVELS)).optional(),
});
export type ViewSearch = z.infer<typeof ViewSearch>;

export function profileOf(view: ViewSearch) {
	const profile = USAGE_PROFILES.find((p) => p.id === view.profile);
	if (!profile) throw new Error(`Unknown usage profile ${view.profile}`);
	return profile;
}

// SAFETY: frontier keys are family ids from the same dataset.
const FRONTIER = Object.keys(benchmarks.frontier) as FamilyId[];

/** Families a plan covers, frontier first, in dataset order. */
export const COVERED_FAMILIES: FamilyId[] = [
	...new Set(plans.flatMap((p) => p.families)),
].sort((a, b) => rank(a) - rank(b));

function rank(family: FamilyId): number {
	const index = FRONTIER.indexOf(family);
	return index === -1 ? FRONTIER.length : index;
}

/** The plans people compare first: each harness's headline tier. */
const DEFAULT_PLANS = ["claude-max-20x", "chatgpt-pro-200", "opencode-go"];

export function selectedPlans(view: ViewSearch): PlanId[] {
	const chosen = view.plans ?? DEFAULT_PLANS;
	return plans.filter((p) => chosen.includes(p.id)).map((p) => p.id);
}

/** Popular models shown by default alongside the frontier. */
const DEFAULT_EXTRA_FAMILIES: string[] = ["muse-spark-1-3"];

const DEFAULT_FAMILIES = COVERED_FAMILIES.filter(
	(f) => FRONTIER.includes(f) || DEFAULT_EXTRA_FAMILIES.includes(f),
);

export function selectedFamilies(view: ViewSearch): FamilyId[] {
	return view.families
		? COVERED_FAMILIES.filter((f) => view.families?.includes(f))
		: DEFAULT_FAMILIES;
}

/** A non-reasoning variant is a different mode, so it starts hidden. */
const DEFAULT_HIDDEN_REASONING: ReasoningLevel[] = ["none"];

export function hiddenReasoning(view: ViewSearch): ReasoningLevel[] {
	return view.hideReasoning ?? DEFAULT_HIDDEN_REASONING;
}

/** The URL patch that restores the default models and reasoning efforts. */
export const DEFAULT_MODELS_VIEW = {
	families: undefined,
	hideReasoning: undefined,
} satisfies Partial<ViewSearch>;

export function isDefaultModelsView(view: ViewSearch): boolean {
	return (
		sameMembers(selectedFamilies(view), DEFAULT_FAMILIES) &&
		sameMembers(hiddenReasoning(view), DEFAULT_HIDDEN_REASONING)
	);
}

function sameMembers<T>(a: readonly T[], b: readonly T[]): boolean {
	return a.length === b.length && a.every((x) => b.includes(x));
}

export type FrontierTier = BenchmarkDataset["frontier"][string]["tier"];
export const FRONTIER_TIERS: readonly FrontierTier[] = [
	"Small",
	"Medium",
	"Large",
];

export function frontierTier(family: FamilyId): FrontierTier | null {
	return benchmarks.frontier[family]?.tier ?? null;
}

export const FRONTIER_FAMILIES = COVERED_FAMILIES.filter(
	(f) => frontierTier(f) !== null,
);
export const NOTABLE_FAMILIES = COVERED_FAMILIES.filter(
	(f) => frontierTier(f) === null,
);

/** Whether every family in `group` is selected. */
export function allSelected<T>(selected: readonly T[], group: readonly T[]) {
	return group.length > 0 && group.every((x) => selected.includes(x));
}

/** Deselects the group when all of it is selected, else selects all of it. */
export function toggledGroup<T>(selected: readonly T[], group: readonly T[]) {
	return allSelected(selected, group)
		? selected.filter((x) => !group.includes(x))
		: [...new Set([...selected, ...group])];
}

export function toggled<T>(list: readonly T[], item: T): T[] {
	return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}
