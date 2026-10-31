import type { CostRow } from "#/domain/ranges";
import type { Pricing } from "#/domain/value";
import { formatUsd } from "#/lib/format";
import {
	modelRow,
	RangeChart,
	type RangeRow,
	type RangeUnits,
} from "./RangeChart";

const COST_UNITS: RangeUnits = {
	format: formatUsd,
	axisLabel: "Effective cost per task (USD, log scale)",
	spoken: "per task",
};

function pricingNote(pricing: Pricing): string {
	return pricing.kind === "plan" ? pricing.plan.label : "API";
}

function costRow(row: CostRow): RangeRow {
	const { pricing } = row;
	return modelRow(row, {
		note: pricingNote(pricing),
		hollow: pricing.kind === "plan" && pricing.allowance.basis === "estimated",
	});
}

/** Every model on every selected plan and at API prices, cheapest first. */
export function RankedChart({ rows }: { rows: readonly CostRow[] }) {
	return (
		<RangeChart
			groups={[{ id: "ranked", rows: rows.map(costRow) }]}
			units={COST_UNITS}
		/>
	);
}
