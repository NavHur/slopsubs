import type { CostRow } from "#/domain/ranges";
import type { Pricing } from "#/domain/value";
import { familyColor, familyName } from "#/lib/families";
import { formatUsd } from "#/lib/format";
import { RangeChart, type RangeRow, type RangeUnits } from "./RangeChart";

const COST_UNITS: RangeUnits = {
	format: formatUsd,
	axisLabel: "Effective cost per task (USD, log scale)",
	spoken: "per task",
};

function pricingNote(pricing: Pricing): string {
	return pricing.kind === "plan" ? pricing.plan.label : "API";
}

function costRow({ seriesId, family, pricing, efforts }: CostRow): RangeRow {
	return {
		id: seriesId,
		label: familyName(family),
		note: pricingNote(pricing),
		color: familyColor(family),
		hollow: pricing.kind === "plan" && pricing.allowance.basis === "estimated",
		dots: efforts.map(({ benchmark, value }) => ({
			id: benchmark.id,
			label: benchmark.effortLabel,
			value,
		})),
	};
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
