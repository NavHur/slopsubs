import type { Effort } from "#/domain/model";
import type { PlanFit, PlanShort, Recommendation } from "#/domain/recommend";
import { familyName } from "./families";
import type { FitInputs } from "./fit";
import { formatCount, formatUsd } from "./format";

type Ranked = Extract<Recommendation, { kind: "ranked" }>;

/** "40%", rounded the way a gauge reads; "<1%" and ">99%" for a share that
 * would round to 0% or 100% without being either. */
export function formatShare(share: number): string {
	const percent = Math.round(share * 100);
	if (share > 0 && percent === 0) return "<1%";
	if (share < 1 && percent === 100) return ">99%";
	return `${percent}%`;
}

/** "$250 of API usage" or "50 Intelligence Index tasks", for a week. */
export function formatAmount(
	inputs: Pick<FitInputs, "unit">,
	amount: number,
	benchmarkName: string,
): string {
	return inputs.unit === "apiUsd"
		? `${formatUsd(amount)} of API usage`
		: `${formatCount(amount)} ${benchmarkName} tasks`;
}

const effortClause = (effort: Effort) =>
	effort === "none" ? "with reasoning off" : `at ${effort} effort`;

const effortAdjective = (effort: Effort) =>
	effort === "none" ? "non-reasoning" : `${effort}-effort`;

/**
 * The quiz's answers in one line, above its result: "Opus 5.5 · $250 of API
 * usage a week · no budget".
 */
export function answersSummary(
	inputs: FitInputs,
	benchmarkName: string,
): string {
	const models = inputs.any
		? "Any flagship"
		: inputs.models.map(familyName).join(" and ");
	const effort =
		inputs.unit === "tasks" ? ` ${effortClause(inputs.effort)}` : "";
	const budget =
		inputs.budget === null
			? "no budget"
			: `up to ${formatUsd(inputs.budget)} a month`;
	return [
		models,
		`${formatAmount(inputs, inputs.amount, benchmarkName)} a week${effort}`,
		budget,
	].join(" · ");
}

/** "No single plan", or "No plan within your $50 budget" when one is set. */
function noPlanSubject(budgetUsd: number | null): string {
	return budgetUsd === null
		? "No single plan"
		: `No plan within your ${formatUsd(budgetUsd)} budget`;
}

/**
 * The over-budget plan the headline names when nothing within the budget fits,
 * with the budget it breaks; null when the headline names no such plan.
 */
export function namedOverBudget(result: Ranked): Ranked["cheapestOverBudget"] {
	return result.fits.length === 0 ? result.cheapestOverBudget : null;
}

/** The headline when no plan within the budget covers the week. */
function nothingFitsHeadline(result: Ranked): string {
	const { monthlyBudgetUsd } = result;
	const named = namedOverBudget(result);
	if (named) {
		const { budgetUsd, fit } = named;
		return `${noPlanSubject(budgetUsd)} covers this week. ${fit.plan.label} does, at ${formatUsd(fit.plan.monthlyPriceUsd)} a month.`;
	}
	const [closest] = result.short;
	if (closest) {
		return `${noPlanSubject(monthlyBudgetUsd)} covers this week. ${closest.plan.label} comes closest, at ${formatShare(closest.coverage)} of it and ${formatUsd(closest.shortUsdPerMonth)} a month short.`;
	}
	return monthlyBudgetUsd === null
		? "No plan we can size covers these models."
		: `${noPlanSubject(monthlyBudgetUsd)} covers these models.`;
}

/** The section's one-line answer. */
export function verdictHeadline(result: Ranked): string {
	const [cheapest] = result.fits;
	if (!cheapest) return nothingFitsHeadline(result);
	if (result.apiCheaper) {
		return `Paying per token is cheaper: about ${formatUsd(result.apiUsdPerMonth)} a month, against ${formatUsd(cheapest.plan.monthlyPriceUsd)} for ${cheapest.plan.label}.`;
	}
	return `${cheapest.plan.label} fits with ${formatShare(1 - cheapest.capUse)} headroom.`;
}

/**
 * The per-token baseline under the verdict, with where the cheaper side next
 * changes: "Paying per token would cost about $1,083 a month; it would win if
 * your usage fell to about $4.62 of API usage a week." When the verdict already
 * says paying per token wins, it gives the usage above which a plan pays off.
 */
export function baselineLine(
	result: Ranked,
	inputs: FitInputs,
	benchmarkName: string,
): string | null {
	const amount =
		result.breakEvenScale === null
			? null
			: formatAmount(
					inputs,
					inputs.amount * result.breakEvenScale,
					benchmarkName,
				);
	if (result.apiCheaper) {
		// The verdict already gives the per-token price.
		return amount && `A plan starts to pay off above about ${amount} a week.`;
	}
	const perMonth = `Paying per token would cost about ${formatUsd(result.apiUsdPerMonth)} a month`;
	return amount
		? `${perMonth}; it would win if your usage fell to about ${amount} a week.`
		: `${perMonth}.`;
}

/**
 * The model an "Any flagship" week runs on, or nothing for chosen models or a
 * model the line already names as `named`.
 */
function anyModelPart(
	families: PlanFit["families"],
	any: boolean,
	named?: PlanFit["families"][number],
): string[] {
	return any && families.length === 1 && families[0] !== named
		? [`runs ${familyName(families[0])}`]
		: [];
}

/** "27% headroom, plus $40 a month of included API credit", for a fit. */
export function fitDetail(fit: PlanFit, any: boolean): string {
	const credit =
		fit.creditUsdPerMonth > 0
			? [
					`plus ${formatUsd(fit.creditUsdPerMonth)} a month of included API credit`,
				]
			: [];
	return [
		...anyModelPart(fit.families, any),
		`${formatShare(1 - fit.capUse)} headroom`,
		...credit,
	].join(", ");
}

/** "Fable 5.2 runs out first", for a plan too small for the week. */
export function shortDetail(short: PlanShort, any: boolean): string {
	return [
		...anyModelPart(short.families, any, short.binding),
		`${familyName(short.binding)} runs out first`,
		`${formatUsd(short.shortUsdPerMonth)} a month short`,
	].join(", ");
}

/** Why the week can't be priced, naming the models without a result. */
export function unpricedLine(
	result: Extract<Recommendation, { kind: "unpriced" }>,
	inputs: FitInputs,
	benchmarkName: string,
): string {
	const names = result.families.map(familyName).join(", ");
	return `${benchmarkName} has no ${effortAdjective(inputs.effort)} cost for ${names}, so a week of its tasks can't be priced. Try another effort or benchmark, or enter API dollars.`;
}
