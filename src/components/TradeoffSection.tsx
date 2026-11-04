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
import { type TimedPoint, timedPoints } from "#/domain/tradeoffs";
import type { ValuePoint } from "#/domain/value";
import type { BenchmarkView } from "#/lib/benchmarks";
import { ChartSection } from "./ChartSection";
import { Segmented } from "./Segmented";
import { type Plotted, TradeoffKey, tradeoffPng } from "./TradeoffKey";

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

/** Why the chart has nothing to show. */
function emptyMessage(points: readonly ValuePoint[], view: BenchmarkView) {
	if (points.length === 0)
		return "Nothing to plot. Pick a model, or measure a plan.";
	return `No plotted model has a time per task on ${view.tabLabel}. Pick another benchmark to weigh time too.`;
}

/** The key, camera presets and turnable chart for the pricing on show. */
function TradeoffPlot({
	plotted,
	angles,
	onAnglesChange,
	view,
}: {
	plotted: Plotted;
	angles: Angles;
	onAnglesChange: (angles: Angles) => void;
	view: BenchmarkView;
}) {
	return (
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
						if (preset !== "turned") onAnglesChange(VIEW_PRESETS[preset]);
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
				onAnglesChange={onAnglesChange}
				view={view}
			/>
		</>
	);
}

/** Switches the pricing when more than one covers the chart. */
function PricingControl({
	pricings,
	value,
	onChange,
}: {
	pricings: readonly PricingStyle[];
	value: PricingId;
	onChange: (id: PricingId) => void;
}) {
	if (pricings.length < 2) return null;
	return (
		<Segmented
			label="Prices to plot"
			options={pricings.map((p) => ({ value: p.id, label: p.label }))}
			value={value}
			onChange={onChange}
		/>
	);
}

/** The points of the pricing on show, or null when none can be drawn. */
function plottedFor(
	pricing: PricingStyle | undefined,
	shown: readonly TimedPoint[],
): Plotted | null {
	return pricing && isNonEmpty(shown) ? { pricing, shown } : null;
}

function isNonEmpty<T>(items: readonly T[]): items is readonly [T, ...T[]] {
	return items.length > 0;
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
	const plotted = plottedFor(pricing, shown);

	const exportChart = async () => {
		if (!plotted) return;
		const { downloadChartPng } = await import("#/lib/exportPng");
		await downloadChartPng(tradeoffPng(plotted, angles, view));
	};

	return (
		<ChartSection
			id="tradeoffs"
			title="Cost, time and score"
			canExport={plotted !== null}
			onExport={exportChart}
			controls={
				pricing && (
					<PricingControl
						pricings={pricings}
						value={pricing.id}
						onChange={setPicked}
					/>
				)
			}
		>
			{plotted ? (
				<TradeoffPlot
					plotted={plotted}
					angles={angles}
					onAnglesChange={setAngles}
					view={view}
				/>
			) : (
				<p className="py-10 text-center text-sm text-muted">
					{emptyMessage(points, view)}
				</p>
			)}
		</ChartSection>
	);
}
