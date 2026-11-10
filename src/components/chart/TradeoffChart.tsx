import { useMemo } from "react";
import type { TimedPoint } from "#/domain/tradeoffs";
import type { BenchmarkView } from "#/lib/benchmarks";
import { useChartEscape } from "./chartEscape";
import { ModelLegend } from "./ChartParts";
import { highlightedModel, useModelHighlight } from "./highlight";
import { usePointDetails } from "./pointDetails";
import { PointTooltip } from "./PointTooltip";
import type { Angles } from "./projection";
import { buildSeries, groupByModel, type PricingStyle } from "./series";
import { TradeoffModelColumn } from "./TradeoffModelColumn";
import { EffortLines, SceneFrame, TradeoffPoint } from "./TradeoffParts";
import {
	hasModelColumn,
	tradeoffScene,
	tradeoffViewport,
} from "./tradeoffScene";
import { useCameraControls } from "./useCameraControls";
import { useChartRef } from "./useChartRef";

/**
 * Every option's cost, time and score in one turnable cube. Options another
 * beats on all three fade, so the ones worth weighing stand out. Drag or use
 * the arrow keys to turn it; the camera's angles belong to the caller, so the
 * view presets and the PNG export share them.
 */
export function TradeoffChart({
	points,
	pricing,
	angles,
	onAnglesChange,
	view,
}: {
	/** Every point under `pricing`. */
	points: readonly [TimedPoint, ...TimedPoint[]];
	pricing: PricingStyle;
	angles: Angles;
	onAnglesChange: (angles: Angles) => void;
	/** The benchmark the points score on. */
	view: BenchmarkView;
}) {
	const { ref, element, size } = useChartRef();
	const { width } = size;
	const viewport = useMemo(() => tradeoffViewport(width), [width]);
	const scene = useMemo(
		() => tradeoffScene(points, angles, viewport),
		[points, angles, viewport],
	);
	const [details, dispatch] = usePointDetails(points);
	const shown = details && scene.points.find((p) => p.point === details.point);
	const models = useMemo(() => groupByModel(buildSeries(points)), [points]);
	const plotted = useMemo(() => new Set(models.map((m) => m.id)), [models]);
	const [highlight, dispatchHighlight] = useModelHighlight(plotted);
	const activeModel =
		details?.point.benchmark.family ?? highlightedModel(highlight);
	useChartEscape(element, [
		{ open: details !== null, close: () => dispatch({ type: "close" }) },
		{
			open: highlight.pinned !== null,
			close: () => dispatchHighlight({ type: "clear" }),
		},
	]);
	const camera = useCameraControls(angles, onAnglesChange);
	return (
		<div ref={ref} data-chart-width={width} className="relative">
			{/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dragging or arrow keys turn the chart; its points stay buttons, which role=application would hide from browse mode */}
			<svg
				width={width}
				height={viewport.height}
				// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- an SVG root cannot be a fieldset; role=img would hide the buttons inside
				role="group"
				aria-roledescription="3D chart"
				aria-label={`Cost, time and ${view.scoreLabel} per task. Arrow keys turn the chart.`}
				// oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the chart turns with the arrow keys, so it takes focus
				tabIndex={0}
				{...camera.handlers}
				className={`block touch-pan-y select-none outline-none focus-visible:outline-1 focus-visible:outline-line ${camera.dragging ? "cursor-grabbing" : "cursor-grab"}`}
			>
				<SceneFrame scene={scene} view={view} />
				<EffortLines
					steps={scene.efforts}
					pricing={pricing}
					activeModel={activeModel}
				/>
				{scene.points.map((p) => (
					<TradeoffPoint
						key={`${p.point.seriesId}/${p.point.benchmark.id}`}
						scenePoint={p}
						pricing={pricing}
						active={p === shown || p.point === details?.selected}
						activeModel={activeModel}
						onDetails={dispatch}
						view={view}
					/>
				))}
				<TradeoffModelColumn
					scene={scene}
					viewport={viewport}
					models={models}
					activeModel={activeModel}
					pinnedModel={highlight.pinned}
					onHighlight={dispatchHighlight}
				/>
			</svg>
			{details && shown && (
				<PointTooltip
					point={details.point}
					selected={details.selected}
					anchor={shown.at}
					bounds={viewport}
					pinned={details.pinned}
					onClose={() => dispatch({ type: "close" })}
					view={view}
				/>
			)}
			{!hasModelColumn(width) && (
				<ModelLegend
					models={models}
					activeModel={activeModel}
					pinnedModel={highlight.pinned}
					onHighlight={dispatchHighlight}
				/>
			)}
		</div>
	);
}
