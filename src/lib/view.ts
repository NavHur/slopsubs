import { z } from "zod";
import { benchmarks, plans } from "#/data";
import { type FamilyId, type PlanId, USAGE_PROFILES } from "#/domain/model";

/** Chart state, kept in the URL so every view is shareable. */
export const ViewSearch = z.object({
	profile: z.enum(["maxed", "heavy", "light"]).default("maxed"),
	scale: z.enum(["log", "linear"]).default("log"),
	pareto: z.boolean().default(false),
	api: z.boolean().default(true),
	plans: z.array(z.string()).optional(),
	families: z.array(z.string()).optional(),
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

export function selectedFamilies(view: ViewSearch): FamilyId[] {
	return view.families
		? COVERED_FAMILIES.filter((f) => view.families?.includes(f))
		: COVERED_FAMILIES.filter(
				(f) => FRONTIER.includes(f) || DEFAULT_EXTRA_FAMILIES.includes(f),
			);
}

export function toggled<T>(list: readonly T[], item: T): T[] {
	return list.includes(item) ? list.filter((x) => x !== item) : [...list, item];
}
