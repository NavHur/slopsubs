import type { FamilyId, Plan } from "./model";
import { WEEKS_PER_MONTH, type WeeklyAllowance } from "./value";

/** One family's weekly API-priced need and its allowance on a plan. */
export type FamilyNeed = {
	family: FamilyId;
	apiUsdPerWeek: number;
	allowance: WeeklyAllowance;
};

/** How a sized plan meets a workload. */
export type PlanFitOutcome =
	| {
			kind: "fits";
			/** Share of the weekly cap the week uses, 0 to 1, at its tightest. */
			capUse: number;
			/** Bundled API credit the overflow spends each month. */
			creditUsdPerMonth: number;
	  }
	| {
			kind: "short";
			/** The family whose limit runs out first. */
			binding: FamilyId;
			/** Share of the week's API-priced need the plan covers, 0 to 1. */
			coverage: number;
			/** API-priced need left over once the cap and credit are spent. */
			shortUsdPerMonth: number;
	  };

/**
 * Whether the plan's weekly cap, then its bundled credit, covers the week.
 *
 * Families on one plan share its weekly gauge: a dollar of a family fills
 * 1 ÷ its whole cap of it, so a family with a smaller cap (Fable on Claude
 * Max) fills it faster, and the week fits while the families' gauge use sums
 * to at most 1. A family held to a share of the cap must also stay within its
 * allowance. What goes past either limit spills into the monthly API credit.
 */
export function planFit(
	plan: Plan,
	needs: readonly FamilyNeed[],
): PlanFitOutcome {
	const capUse = Math.max(gaugeUse(needs), ...needs.map(shareUse));
	if (capUse <= 1) return { kind: "fits", capUse, creditUsdPerMonth: 0 };
	const overflowUsdPerMonth = weeklyOverflow(needs) * WEEKS_PER_MONTH;
	if (overflowUsdPerMonth <= plan.includedApiCreditUsd) {
		return { kind: "fits", capUse: 1, creditUsdPerMonth: overflowUsdPerMonth };
	}
	const shortUsdPerMonth = overflowUsdPerMonth - plan.includedApiCreditUsd;
	const needUsdPerMonth =
		needs.reduce((sum, n) => sum + n.apiUsdPerWeek, 0) * WEEKS_PER_MONTH;
	return {
		kind: "short",
		binding: bindingFamily(needs),
		coverage: 1 - shortUsdPerMonth / needUsdPerMonth,
		shortUsdPerMonth,
	};
}

function gaugeUse(needs: readonly FamilyNeed[]): number {
	return needs.reduce((sum, n) => sum + familyGauge(n), 0);
}

/** The part of the shared gauge the family's week fills. */
function familyGauge(need: FamilyNeed): number {
	return need.apiUsdPerWeek / need.allowance.capApiUsd;
}

/** The family's use of its own allowance: its share of the cap. */
function shareUse(need: FamilyNeed): number {
	return need.apiUsdPerWeek / need.allowance.apiUsd;
}

/**
 * The fewest API-priced dollars a week that must leave the cap for the rest
 * to fit: first what each family needs past its share, then, while the gauge
 * still overflows, the dollars that fill it fastest (smallest cap first).
 */
function weeklyOverflow(needs: readonly FamilyNeed[]): number {
	const kept = needs.map((n) => ({
		cap: n.allowance.capApiUsd,
		usd: Math.min(n.apiUsdPerWeek, n.allowance.apiUsd),
	}));
	const pastShare = needs.reduce(
		(sum, n, i) => sum + n.apiUsdPerWeek - kept[i].usd,
		0,
	);
	let excessGauge = kept.reduce((sum, k) => sum + k.usd / k.cap, 0) - 1;
	let moved = 0;
	for (const { cap, usd } of kept.toSorted((a, b) => a.cap - b.cap)) {
		if (excessGauge <= 0) break;
		const take = Math.min(usd, excessGauge * cap);
		moved += take;
		excessGauge -= take / cap;
	}
	return pastShare + moved;
}

/** The family past its share by the most, else the one filling the most gauge. */
function bindingFamily(needs: readonly FamilyNeed[]): FamilyId {
	const pastShare = needs.filter((n) => shareUse(n) > 1);
	const candidates = pastShare.length > 0 ? pastShare : needs;
	const measure = pastShare.length > 0 ? shareUse : familyGauge;
	return candidates.reduce((a, b) => (measure(b) > measure(a) ? b : a)).family;
}
