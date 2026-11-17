import * as z from "zod/mini";
import { frontier, plans, samples } from "#/data";
import type { Effort, FamilyId } from "#/domain/model";
import type { SizedPlan, Workload } from "#/domain/recommend";
import { planCapacity } from "#/domain/value";

/**
 * The models the "Which plan fits" section offers: frontier models some plan
 * covers, in the dataset's order. Read from the data, not view.ts, which
 * imports this module.
 */
// ceiling: frontier families only, to keep the picker to a few chips; add
// notable families behind a search if visitors ask for them.
export const FIT_FAMILIES: readonly FamilyId[] =
	// SAFETY: frontier keys are family ids from the same dataset.
	(Object.keys(frontier) as FamilyId[]).filter((f) =>
		plans.some((p) => p.families.includes(f)),
	);

/** "Any flagship": each plan's largest frontier model. */
export const ANY_FAMILIES: readonly FamilyId[] = FIT_FAMILIES.filter(
	(f) => frontier[f]?.tier === "Large",
);

export const FIT_UNITS = ["apiUsd", "tasks"] as const;
export type FitUnit = (typeof FIT_UNITS)[number];

/** The efforts a week can be costed at, as the benchmarks name them. */
export const FIT_EFFORTS = [
	"low",
	"medium",
	"high",
	"xhigh",
	"max",
] as const satisfies readonly Effort[];

/** The quiz's starting amount for a week, in each unit. */
export const DEFAULT_AMOUNT: Record<FitUnit, number> = {
	apiUsd: 250,
	tasks: 50,
};
const DEFAULT_FAMILY = "claude-opus-5-5" as FamilyId;
if (!FIT_FAMILIES.includes(DEFAULT_FAMILY)) {
	throw new Error(`Default plan-fit model ${DEFAULT_FAMILY} is not on a plan`);
}

const knownFamily = (item: unknown): item is string =>
	FIT_FAMILIES.some((f) => f === item);

const Positive = z.number().check(z.positive());

function optionalValid<T extends z.ZodMiniType>(schema: T) {
	return z.catch(z.optional(schema), undefined);
}

/**
 * The section's inputs in the URL, one `fit` param. Each field falls back on
 * its own, so a link from an older or newer version still loads.
 */
export const FitSearch = z.object({
	any: optionalValid(z.boolean()),
	/** Plain strings: structural sharing reads a brand as String's methods. */
	models: optionalValid(
		z.pipe(
			z.array(z.unknown()),
			z.transform((items) => {
				const kept = [...new Set(items.filter(knownFamily))];
				return kept.length > 0 ? kept : undefined;
			}),
		),
	),
	/** Each model's percent of the week; unset models get an equal part. */
	weights: optionalValid(z.record(z.string(), Positive)),
	unit: optionalValid(z.enum(FIT_UNITS)),
	amount: optionalValid(Positive),
	effort: optionalValid(z.enum(FIT_EFFORTS)),
	budget: optionalValid(Positive),
});
export type FitSearch = z.infer<typeof FitSearch>;

/** The inputs with every default filled in, as the section shows them. */
export type FitInputs = {
	any: boolean;
	models: FamilyId[];
	weights: Record<string, number>;
	unit: FitUnit;
	amount: number;
	effort: (typeof FIT_EFFORTS)[number];
	budget: number | null;
};

export function fitInputs(fit: FitSearch | undefined): FitInputs {
	const unit = fit?.unit ?? "apiUsd";
	return {
		any: fit?.any ?? false,
		// SAFETY: the schema keeps only ids from FIT_FAMILIES.
		models: (fit?.models as FamilyId[] | undefined) ?? [DEFAULT_FAMILY],
		weights: fit?.weights ?? {},
		unit,
		amount: fit?.amount ?? DEFAULT_AMOUNT[unit],
		effort: fit?.effort ?? "high",
		budget: fit?.budget ?? null,
	};
}

export function fitWorkload(inputs: FitInputs): Workload {
	return {
		models: inputs.any
			? { kind: "any", families: ANY_FAMILIES }
			: {
					kind: "chosen",
					weights: inputs.models.map((family) => ({
						family,
						weight: modelWeight(inputs, family),
					})),
				},
		usage:
			inputs.unit === "tasks"
				? {
						unit: "tasks",
						tasksPerWeek: inputs.amount,
						effort: inputs.effort,
					}
				: { unit: "apiUsd", apiUsdPerWeek: inputs.amount },
		monthlyBudgetUsd: inputs.budget,
	};
}

/**
 * The URL patch that toggles a model: picking one while "Any flagship" is on
 * switches to that model alone. Null when it would leave no model, since an
 * empty week has no answer.
 */
export function modelToggle(
	inputs: Pick<FitInputs, "any" | "models" | "weights">,
	family: FamilyId,
): Partial<FitSearch> | null {
	if (inputs.any) return { any: false, models: [family], weights: undefined };
	if (!inputs.models.includes(family)) {
		return { models: [...inputs.models, family] };
	}
	const models = inputs.models.filter((f) => f !== family);
	// A removed model's share leaves with it, so re-picking it starts equal.
	const { [family]: _removed, ...weights } = inputs.weights;
	return models.length > 0 ? { models, weights } : null;
}

/** A model's percent of the week: as set, or an equal part when unset. */
export function modelWeight(
	inputs: Pick<FitInputs, "models" | "weights">,
	family: FamilyId,
): number {
	return inputs.weights[family] ?? 100 / inputs.models.length;
}

/** The URL patch for a new unit: its own default amount comes with it. */
export function unitChange(unit: FitUnit): Partial<FitSearch> {
	return { unit, amount: DEFAULT_AMOUNT[unit] };
}

/** Every plan with its capacity, worked out once. */
export const SIZED_PLANS: readonly SizedPlan[] = plans.map((plan) => ({
	plan,
	capacity: planCapacity(plan, samples),
}));
