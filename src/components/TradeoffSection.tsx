import * as Effect from "effect/Effect";
import { useMemo, useState } from "react";
import { PricingKey } from "#/components/chart/PricingKey";
import {
	type Angles,
	presetAt,
	VIEW_PRESETS,
	type ViewPreset,
} from "#/components/chart/projection";
import { TradeoffChart } from "#/components/chart/TradeoffChart";
import { type TimedPoint, timedPoints } from "#/domain/tradeoffs";
import type { ValuePoint } from "#/domain/value";
import type { BenchmarkView } from "#/lib/benchmarks";
import { exportChartPng } from "#/lib/chart-export";
import { nothingToPlot } from "#/lib/emptyChart";
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

/** Why the chart has nothing to show. */
function emptyMessage(
	points: readonly ValuePoint[],
	view: BenchmarkView,
	plansChecked: boolean,
) {
	if (points.length === 0) return nothingToPlot(plansChecked);
	return `No plotted model has a time per task on ${view.tabLabel}. Pick another benchmark to weigh time too.`;
}

/** The key, camera presets and turnable chart. */
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
					Drag, or focus the chart and use the arrow keys, to turn it. Click
					model names to pick out several.
				</span>
			</div>
			<TradeoffChart
				points={plotted.shown}
				pricings={plotted.pricings}
				angles={angles}
				onAnglesChange={onAnglesChange}
				view={view}
			/>
			{/* From lg the side panel shows each plan's marker; the PNG draws its own key. */}
			<PricingKey
				pricings={[...plotted.pricings.values()]}
				className="mt-3 lg:hidden"
			/>
		</>
	);
}

/** The points to draw and how each pricing draws, or null when none can be
 * drawn. */
function plottedFor(
	pricings: Plotted["pricings"],
	shown: readonly TimedPoint[],
): Plotted | null {
	return isNonEmpty(shown) ? { pricings, shown } : null;
}

function isNonEmpty<T>(items: readonly T[]): items is readonly [T, ...T[]] {
	return items.length > 0;
}

/**
 * The trade-off chart's section: each option's cost, time and score, under
 * every pricing the side panel turns on, told apart by marker and line.
 */
export function TradeoffSection({
	points,
	pricings,
	view,
	plansChecked,
}: {
	points: readonly ValuePoint[];
	/** The styles the side panel uses, built from every point, not only timed
	 * ones. */
	pricings: Plotted["pricings"];
	/** The benchmark the points score on. */
	view: BenchmarkView;
	/** Whether any plan is checked, which the empty chart's message turns on. */
	plansChecked: boolean;
}) {
	const timed = useMemo(() => timedPoints(points), [points]);
	const [angles, setAngles] = useState<Angles>(VIEW_PRESETS.perspective);
	const plotted = plottedFor(pricings, timed);

	const exportChart = () =>
		plotted ? exportChartPng(tradeoffPng(plotted, angles, view)) : Effect.void;

	return (
		<ChartSection
			id="tradeoffs"
			title="Cost, time and score"
			canExport={plotted !== null}
			onExport={exportChart}
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
					{emptyMessage(points, view, plansChecked)}
				</p>
			)}
		</ChartSection>
	);
}
