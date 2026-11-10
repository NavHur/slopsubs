import { useMemo } from "react";
import type { FamilyId } from "#/domain/model";
import type { ValuePoint } from "#/domain/value";
import type { BenchmarkView } from "#/lib/benchmarks";
import { paretoFrontier, spreadLabels } from "#/lib/chart";
import { familyColor } from "#/lib/families";
import { useChartEscape } from "./chartEscape";
import {
	Axes,
	ModelLegend,
	ModelTags,
	ParetoLine,
	SeriesLine,
} from "./ChartParts";
import { Crosshair, pointReadouts } from "./Crosshair";
import {
	type AxisScale,
	chartLayout,
	LABEL_GAP,
	makeScales,
	px,
	xTicks,
} from "./geometry";
import { highlightedModel, useModelHighlight } from "./highlight";
import { usePointDetails } from "./pointDetails";
import { PointTooltip } from "./PointTooltip";
import { buildSeries, groupByModel, modelEnd, type Series } from "./series";
import { useChartRef } from "./useChartRef";

/**
 * A line fades unless it holds a shown point (the hovered one and any it is
 * compared with) or, with none shown, belongs to the highlighted model.
 */
function isDimmed(
	series: Series,
	shownPoints: readonly ValuePoint[],
	highlighted: FamilyId | null,
) {
	if (shownPoints.length > 0) {
		return !shownPoints.some((p) => p.seriesId === series.id);
	}
	return highlighted !== null && highlighted !== series.modelId;
}

export function ValueChart({
	points,
	scale,
	showPareto,
	showLabels,
	benchmark,
}: {
	points: readonly ValuePoint[];
	scale: AxisScale;
	showPareto: boolean;
	showLabels: boolean;
	/** The benchmark the points score on. */
	benchmark: BenchmarkView;
}) {
	const { ref, element, size } = useChartRef();
	const { width } = size;
	const [details, dispatchDetails] = usePointDetails(points);
	const activePoint = details?.point ?? null;
	const series = useMemo(() => buildSeries(points), [points]);
	const models = useMemo(() => groupByModel(series), [series]);
	const plotted = useMemo(() => new Set(models.map((m) => m.id)), [models]);
	const [shown, dispatchHighlight] = useModelHighlight(plotted);
	useChartEscape(element, [
		{
			open: activePoint !== null,
			close: () => dispatchDetails({ type: "close" }),
		},
		{
			open: shown.pinned !== null,
			close: () => dispatchHighlight({ type: "clear" }),
		},
	]);
	const layout = chartLayout(size, { labels: showLabels });
	const { height, margin } = layout;

	if (points.length === 0) {
		return (
			<div
				ref={ref}
				className="grid place-items-center text-sm text-muted lg:min-h-0 lg:flex-1"
				style={{ height }}
			>
				Nothing to plot. Pick a model, or measure a plan.
			</div>
		);
	}

	const { x, y, right } = makeScales(points, scale, width, layout);
	const labels = layout.endLabels
		? spreadLabels({
				anchors: models.map((m) => ({
					id: m.id,
					anchorY: px(y(modelEnd(m).score)),
				})),
				gap: LABEL_GAP,
				top: margin.top,
				bottom: height - margin.bottom,
			})
		: [];
	const highlighted = highlightedModel(shown);
	const activeModel = activePoint?.benchmark.family ?? highlighted;
	// Shown points are projected once; the guides, pills and tooltip share them.
	const readoutsOf = (point: ValuePoint) =>
		pointReadouts(point, { x, y }, layout, width, benchmark);
	const active = details && {
		...details,
		readouts: readoutsOf(details.point),
		selectedReadouts: details.selected && readoutsOf(details.selected),
	};
	const shownPoints = details
		? [details.point, details.selected].filter((p) => p !== null)
		: [];
	const shownReadouts = active
		? [active.readouts, active.selectedReadouts].filter((r) => r !== null)
		: [];

	return (
		<div
			ref={ref}
			data-chart-width={width}
			className="relative lg:min-h-0 lg:flex-1"
		>
			<svg
				width={width}
				height={height}
				// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- an SVG root cannot be a fieldset; role=img would hide the buttons inside
				role="group"
				aria-label={`Effective cost per task versus ${benchmark.scoreLabel}`}
				className="block select-none"
			>
				<Axes
					x={x}
					y={y}
					right={right}
					ticks={xTicks(x, scale)}
					scale={scale}
					layout={layout}
					readouts={shownReadouts}
					axisLabel={benchmark.axisLabel}
				/>
				{showPareto && (
					<ParetoLine points={paretoFrontier(points)} x={x} y={y} />
				)}
				{active?.selected && active.selectedReadouts && (
					<Crosshair
						readouts={active.selectedReadouts}
						layout={layout}
						color={familyColor(active.selected.benchmark.family)}
						solid
					/>
				)}
				{active && (
					<Crosshair
						readouts={active.readouts}
						layout={layout}
						color={familyColor(active.point.benchmark.family)}
					/>
				)}
				{series.map((s) => (
					<SeriesLine
						key={s.id}
						series={s}
						x={x}
						y={y}
						shownPoints={shownPoints}
						dimmed={isDimmed(s, shownPoints, highlighted)}
						onDetails={dispatchDetails}
						benchmark={benchmark}
					/>
				))}
				<ModelTags
					labels={labels}
					models={models}
					x={x}
					right={right}
					activeModel={activeModel}
					pinnedModel={shown.pinned}
					onHighlight={dispatchHighlight}
				/>
			</svg>
			{active && (
				<PointTooltip
					point={active.point}
					selected={active.selected}
					anchor={active.readouts.at}
					bounds={{ width, height }}
					pinned={active.pinned}
					onClose={() => dispatchDetails({ type: "close" })}
					view={benchmark}
				/>
			)}
			{layout.compact && (
				<ModelLegend
					models={models}
					activeModel={activeModel}
					pinnedModel={shown.pinned}
					onHighlight={dispatchHighlight}
				/>
			)}
		</div>
	);
}
