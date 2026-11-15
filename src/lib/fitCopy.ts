import type { PlanFit, PlanShort, Recommendation } from "#/domain/recommend";
import { familyName } from "./families";
import type { FitInputs } from "./fit";
import { formatCount, formatUsd } from "./format";

type Ranked = Extract<Recommendation, { kind: "ranked" }>;

/** Shares that round to 0% or 100% without being either. */
const SLIVER = 0.005;

/** "40%", rounded the way a gauge reads; "<1%" and ">99%" at the ends. */
export function formatShare(share: number): string {
	if (share > 0 && share < SLIVER) return "<1%";
	if (share < 1 && share > 1 - SLIVER) return ">99%";
	return `${Math.round(share * 100)}%`;
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
	const effort = inputs.unit === "tasks" ? ` at ${inputs.effort} effort` : "";
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

/** The section's one-line answer. */
export function verdictHeadline(result: Ranked): string {
	const [cheapest] = result.fits;
	if (!cheapest) {
		const [closest] = result.short;
		return closest
			? `No single plan covers this week. ${closest.plan.label} comes closest, at ${formatShare(closest.coverage)} of it and ${formatUsd(closest.shortUsdPerMonth)} a month short.`
			: "No plan we can size covers these models.";
	}
	if (result.apiCheaper) {
		return `Paying per token is cheaper: about ${formatUsd(result.apiUsdPerMonth)} a month, against ${formatUsd(cheapest.plan.monthlyPriceUsd)} for ${cheapest.plan.label}.`;
	}
	return `${cheapest.plan.label} fits with ${formatShare(1 - cheapest.capUse)} headroom.`;
}

/**
 * The per-token baseline under the verdict, with where it and the plans
 * cross: "Paying per token would cost about $1,083 a month, and is cheaper
 * only below about $4.62 of API usage a week." When the verdict already says
 * paying per token wins, it gives the usage a plan starts to pay off at.
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
		? `${perMonth}, and is cheaper only below about ${amount} a week.`
		: `${perMonth}.`;
}

/** The model an "Any flagship" week runs on, or nothing for chosen models. */
function anyModelPart(families: PlanFit["families"], any: boolean): string[] {
	return any && families.length === 1
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
		...anyModelPart(short.families, any),
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
	return `${benchmarkName} has no ${inputs.effort}-effort cost for ${names}, so a week of its tasks can't be priced. Try another effort or benchmark, or enter API dollars.`;
}
