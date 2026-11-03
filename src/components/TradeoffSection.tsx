import { useMemo, useState } from "react";
import {
	type Angles,
	presetAt,
	VIEW_PRESETS,
	type ViewPreset,
} from "#/components/chart/projection";
import {
	buildSeries,
	type PricingId,
	type PricingStyle,
	pricingIdOf,
	pricingStyles,
} from "#/components/chart/series";
import { TradeoffChart } from "#/components/chart/TradeoffChart";
import {
	type TimedPoint,
	timedPoints,
	tradeoffFrontier,
} from "#/domain/tradeoffs";
import type { ValuePoint } from "#/domain/value";
import type { BenchmarkView } from "#/lib/benchmarks";
import { ChartSection } from "./ChartSection";
import { Segmented } from "./Segmented";

const PRESET_OPTIONS = [
	{ value: "perspective", label: "3D" },
	{ value: "cost-score", label: "Cost × score" },
	{ value: "time-score", label: "Time × score" },
	{ value: "top", label: "Above" },
	{ value: "under", label: "Below" },
] as const satisfies readonly { value: ViewPreset; label: string }[];

/** The pricing a visitor picked while it is still on the chart, else API
 * prices, which cover every model, else the first plan. */
function shownPricing(
	pricings: readonly PricingStyle[],
	picked: PricingId | null,
): PricingStyle | undefined {
	return (
		pricings.find((p) => p.id === picked) ??
		pricings.find((p) => p.isApi) ??
		pricings[0]
	);
}

function isNonEmpty<T>(items: readonly T[]): items is readonly [T, ...T[]] {
	return items.length > 0;
}

/** Why the chart has nothing to show. */
function emptyMessage(points: readonly ValuePoint[], view: BenchmarkView) {
	if (points.length === 0)
		return "Nothing to plot. Pick a model, or measure a plan.";
	return `No plotted model has a time per task on ${view.tabLabel}. Pick another benchmark to weigh time too.`;
}

/** How many options survive, and what the faded ones mean. */
function TradeoffKey({
	points,
	pricing,
	className = "",
}: {
	points: readonly TimedPoint[];
	pricing: PricingStyle;
	className?: string;
}) {
	const worth = tradeoffFrontier(points).size;
	const prices = pricing.isApi ? "API prices" : `${pricing.label} prices`;
	// One text node: the PNG export draws each node apart, trimming its spaces.
	return (
		<p className={`text-[13px] text-muted ${className}`}>
			{`${prices}: ${worth} of ${points.length} options worth weighing. Faded ones are beaten on cost, time and score by another.`}
		</p>
	);
}

/**
 * The trade-off chart's section: each option's cost, time and score under
 * one pricing at a time, since plans cover different models and prices.
 */
export function TradeoffSection({
	points,
	view,
}: {
	points: readonly ValuePoint[];
	/** The benchmark the points score on. */
	view: BenchmarkView;
}) {
	const timed = useMemo(() => timedPoints(points), [points]);
	const pricings = useMemo(
		() => [...pricingStyles(buildSeries(timed)).values()],
		[timed],
	);
	const [picked, setPicked] = useState<PricingId | null>(null);
	const pricing = shownPricing(pricings, picked);
	const shown = useMemo(
		() => timed.filter((p) => pricingIdOf(p.pricing) === pricing?.id),
		[timed, pricing?.id],
	);
	const [angles, setAngles] = useState<Angles>(VIEW_PRESETS.perspective);
	const plotted = pricing && isNonEmpty(shown) ? { pricing, shown } : null;

	const exportChart = async () => {
		if (!plotted) return;
		const { downloadChartPng } = await import("#/lib/exportPng");
		await downloadChartPng({
			chart: (
				<TradeoffChart
					points={plotted.shown}
					pricing={plotted.pricing}
					angles={angles}
					onAnglesChange={() => {}}
					view={view}
				/>
			),
			legend: <TradeoffKey points={plotted.shown} pricing={plotted.pricing} />,
			title: `Cost, time and ${view.tabLabel} score`,
			fileName: `slopsubs-tradeoffs-${view.id}-${plotted.pricing.id}.png`,
			height: "content",
		});
	};

	return (
		<ChartSection
			id="tradeoffs"
			title="Cost, time and score"
			canExport={plotted !== null}
			onExport={exportChart}
			controls={
				pricings.length > 1 &&
				pricing && (
					<Segmented
						label="Prices to plot"
						options={pricings.map((p) => ({ value: p.id, label: p.label }))}
						value={pricing.id}
						onChange={setPicked}
					/>
				)
			}
		>
			{plotted ? (
				<>
					<TradeoffKey
						points={plotted.shown}
						pricing={plotted.pricing}
						className="mb-3 max-w-[72ch] leading-5"
					/>
					<div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1">
						<Segmented<ViewPreset | "turned">
							label="Camera angle"
							options={PRESET_OPTIONS}
							value={presetAt(angles) ?? "turned"}
							onChange={(preset) => {
								if (preset !== "turned") setAngles(VIEW_PRESETS[preset]);
							}}
						/>
						<span className="text-[12px] text-subtle">
							Drag, or focus the chart and use the arrow keys, to turn it
						</span>
					</div>
					<TradeoffChart
						points={plotted.shown}
						pricing={plotted.pricing}
						angles={angles}
						onAnglesChange={setAngles}
						view={view}
					/>
				</>
			) : (
				<p className="py-10 text-center text-sm text-muted">
					{emptyMessage(points, view)}
				</p>
			)}
		</ChartSection>
	);
}
