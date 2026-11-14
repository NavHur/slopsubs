import { PricingKey } from "#/components/chart/PricingKey";
import type { Angles } from "#/components/chart/projection";
import type { PricingId, PricingStyle } from "#/components/chart/series";
import { TradeoffChart } from "#/components/chart/TradeoffChart";
import { type TimedPoint, tradeoffFrontier } from "#/domain/tradeoffs";
import type { BenchmarkView } from "#/lib/benchmarks";
import type { downloadChartPng } from "#/lib/exportPng";

/** The points to draw, and how each pricing among them draws. */
export type Plotted = {
	pricings: ReadonlyMap<PricingId, PricingStyle>;
	shown: readonly [TimedPoint, ...(readonly TimedPoint[])];
};

/** How many options survive, and what the faded ones mean. */
export function TradeoffKey({
	points,
	className = "",
}: {
	points: readonly TimedPoint[];
	className?: string;
}) {
	const worth = tradeoffFrontier(points).size;
	return (
		<p className={`text-[13px] text-muted ${className}`}>
			{`${worth} of ${points.length} options worth weighing, drawn filled. Hollow ones are beaten on cost, time and score by another.`}
		</p>
	);
}

/**
 * The same key for the PNG header, which draws each text node as one line
 * without wrapping and trims its spaces: so one short line per node.
 */
function TradeoffExportKey({ points }: { points: readonly TimedPoint[] }) {
	const worth = tradeoffFrontier(points).size;
	return (
		<div className="text-[13px] leading-5 text-muted">
			<span className="block">{`${worth} of ${points.length} options worth weighing`}</span>
			<span className="block">Filled: worth weighing</span>
			<span className="block">Hollow: beaten on all three by another</span>
		</div>
	);
}

/** What `downloadChartPng` takes to export the trade-off chart. */
export function tradeoffPng(
	{ pricings, shown }: Plotted,
	angles: Angles,
	view: BenchmarkView,
): Parameters<typeof downloadChartPng>[0] {
	return {
		chart: (
			<TradeoffChart
				points={shown}
				pricings={pricings}
				angles={angles}
				onAnglesChange={() => {}}
				view={view}
			/>
		),
		legend: (
			<div className="flex flex-col items-end gap-1">
				<TradeoffExportKey points={shown} />
				<PricingKey pricings={[...pricings.values()]} className="justify-end" />
			</div>
		),
		title: `Cost, time and ${view.tabLabel} score`,
		fileName: `slopsubs-tradeoffs-${view.id}.png`,
		height: "content",
	};
}
