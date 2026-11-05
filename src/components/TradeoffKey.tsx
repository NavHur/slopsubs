import type { Angles } from "#/components/chart/projection";
import type { PricingStyle } from "#/components/chart/series";
import { TradeoffChart } from "#/components/chart/TradeoffChart";
import { type TimedPoint, tradeoffFrontier } from "#/domain/tradeoffs";
import type { BenchmarkView } from "#/lib/benchmarks";
import type { downloadChartPng } from "#/lib/exportPng";

/** The points drawn under the one pricing on show. */
export type Plotted = {
	pricing: PricingStyle;
	shown: readonly [TimedPoint, ...(readonly TimedPoint[])];
};

function priceName(pricing: PricingStyle) {
	return pricing.isApi ? "API prices" : `${pricing.label} prices`;
}

/** How many options survive, and what the faded ones mean. */
export function TradeoffKey({
	points,
	pricing,
	className = "",
}: {
	points: readonly TimedPoint[];
	pricing: PricingStyle;
	className?: string;
}) {
	const worth = tradeoffFrontier(points).size;
	return (
		<p className={`text-[13px] text-muted ${className}`}>
			{`${priceName(pricing)}: ${worth} of ${points.length} options worth weighing, drawn filled. Hollow ones are beaten on cost, time and score by another.`}
		</p>
	);
}

/**
 * The same key for the PNG header, which draws each text node as one line
 * without wrapping and trims its spaces: so one short line per node.
 */
function TradeoffExportKey({
	points,
	pricing,
}: {
	pricing: PricingStyle;
	points: readonly TimedPoint[];
}) {
	const worth = tradeoffFrontier(points).size;
	return (
		<div className="text-[13px] leading-5 text-muted">
			<span className="block">{priceName(pricing)}</span>
			<span className="block">{`${worth} of ${points.length} options worth weighing`}</span>
			<span className="block">Filled: worth weighing</span>
			<span className="block">Hollow: beaten on all three by another</span>
		</div>
	);
}

/** What `downloadChartPng` takes to export the trade-off chart. */
export function tradeoffPng(
	{ pricing, shown }: Plotted,
	angles: Angles,
	view: BenchmarkView,
): Parameters<typeof downloadChartPng>[0] {
	return {
		chart: (
			<TradeoffChart
				points={shown}
				pricing={pricing}
				angles={angles}
				onAnglesChange={() => {}}
				view={view}
			/>
		),
		legend: <TradeoffExportKey points={shown} pricing={pricing} />,
		title: `Cost, time and ${view.tabLabel} score`,
		fileName: `slopsubs-tradeoffs-${view.id}-${pricing.id}.png`,
		height: "content",
	};
}
