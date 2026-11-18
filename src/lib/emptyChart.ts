/**
 * What a chart with no points says. With no plan checked the API toggle has
 * nothing to compare against, so the fix is a plan, not a model.
 */
export function nothingToPlot(plansChecked: boolean): string {
	return plansChecked
		? "Nothing to plot. Pick a model, or measure a plan."
		: "Nothing to plot. Check a plan to compare it with API prices.";
}

/** The ranked-cost empty state: API prices alone cannot fill it, so it asks for a plan or a model. */
export function nothingToRank(plansChecked: boolean): string {
	return plansChecked
		? "Nothing to rank. Pick a model, or measure a plan."
		: "Select a plan to rank its costs.";
}
