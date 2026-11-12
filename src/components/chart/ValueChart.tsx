import type { ScaleLinear } from "d3-scale";
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
import { Crosshair, pointReadouts, shownCrosshairs } from "./Crosshair";
import {
	type AxisScale,
	type ChartLayout,
	chartLayout,
	LABEL_GAP,
	makeScales,
	px,
	xTicks,
} from "./geometry";
import { highlightedModel, useModelHighlight } from "./highlight";
import { type LitModels, litModels } from "./litModels";
import { usePointDetails } from "./pointDetails";
import { PointTooltip } from "./PointTooltip";
import {
	buildSeries,
	groupByModel,
	type ModelGroup,
	modelEnd,
	type Series,
} from "./series";
import { useChartRef } from "./useChartRef";

/**
 * The shown Pareto frontier, and the series and models with a point on it;
 * all empty while the frontier is hidden.
 */
type Frontier = {
	points: ValuePoint[];
	seriesIds: ReadonlySet<string>;
	models: LitModels;
};

function shownFrontier(
	points: readonly ValuePoint[],
	shown: boolean,
): Frontier {
	const frontier = shown ? paretoFrontier(points) : [];
	return {
		points: frontier,
		seriesIds: new Set(frontier.map((p) => p.seriesId)),
		models: [...new Set(frontier.map((p) => p.benchmark.family))],
	};
}

/**
 * A line fades unless it holds a shown point (the hovered one and any it is
 * compared with); with none shown, unless it belongs to the highlighted
 * model; with neither, unless it reaches the shown Pareto frontier.
 */
function isDimmed(
	series: Series,
	shownPoints: readonly ValuePoint[],
	highlighted: FamilyId | null,
	frontier: Frontier,
) {
	if (shownPoints.length > 0) {
		return !shownPoints.some((p) => p.seriesId === series.id);
	}
	if (highlighted !== null) return highlighted !== series.modelId;
	return frontier.seriesIds.size > 0 && !frontier.seriesIds.has(series.id);
}

/** Where each model's name sits beside the plot, spread so none overlap. */
function endLabels(
	models: readonly ModelGroup[],
	y: ScaleLinear<number, number>,
	{ endLabels: shown, height, margin }: ChartLayout,
) {
	if (!shown) return [];
	return spreadLabels({
		anchors: models.map((m) => ({
			id: m.id,
			anchorY: px(y(modelEnd(m).score)),
		})),
		gap: LABEL_GAP,
		top: margin.top,
		bottom: height - margin.bottom,
	});
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
	const series = useMemo(() => buildSeries(points), [points]);
	const models = useMemo(() => groupByModel(series), [series]);
	const plotted = useMemo(() => new Set(models.map((m) => m.id)), [models]);
	const frontier = useMemo(
		() => shownFrontier(points, showPareto),
		[points, showPareto],
	);
	const [shown, dispatchHighlight] = useModelHighlight(plotted);
	useChartEscape(element, [
		{
			open: details !== null,
			close: () => dispatchDetails({ type: "close" }),
		},
		{
			open: shown.pinned !== null,
			close: () => dispatchHighlight({ type: "clear" }),
		},
	]);
	const layout = chartLayout(size, { labels: showLabels });
	const { height } = layout;

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
	const labels = endLabels(models, y, layout);
	const highlighted = highlightedModel(shown);
	const lit = litModels(details, highlighted, frontier.models);
	// Shown points are projected once; the guides, pills and tooltip share them.
	const crosshairs = shownCrosshairs(
		details,
		(point) => pointReadouts(point, { x, y }, layout, width, benchmark),
		{ width, height },
	);
	const shownPoints = crosshairs.map((c) => c.point);
	const tooltipAnchor = crosshairs.at(-1)?.readouts.at;

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
					readouts={crosshairs.map((c) => c.readouts)}
					axisLabel={benchmark.axisLabel}
				/>
				{showPareto && <ParetoLine points={frontier.points} x={x} y={y} />}
				{crosshairs.map((c) => (
					<Crosshair
						key={c.solid ? "selected" : "shown"}
						readouts={c.readouts}
						layout={layout}
						color={familyColor(c.point.benchmark.family)}
						solid={c.solid}
					/>
				))}
				{series.map((s) => (
					<SeriesLine
						key={s.id}
						series={s}
						x={x}
						y={y}
						shownPoints={shownPoints}
						dimmed={isDimmed(s, shownPoints, highlighted, frontier)}
						onDetails={dispatchDetails}
						benchmark={benchmark}
					/>
				))}
				<ModelTags
					labels={labels}
					models={models}
					x={x}
					right={right}
					lit={lit}
					pinnedModel={shown.pinned}
					onHighlight={dispatchHighlight}
				/>
			</svg>
			{details && tooltipAnchor && (
				<PointTooltip
					point={details.point}
					selected={details.selected}
					anchor={tooltipAnchor}
					bounds={{ width, height }}
					pinned={details.pinned}
					onClose={() => dispatchDetails({ type: "close" })}
					view={benchmark}
				/>
			)}
			{layout.compact && (
				<ModelLegend
					models={models}
					lit={lit}
					pinnedModel={shown.pinned}
					onHighlight={dispatchHighlight}
				/>
			)}
		</div>
	);
}
