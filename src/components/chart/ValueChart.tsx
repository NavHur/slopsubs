import {
	type RefObject,
	useCallback,
	useEffect,
	useEffectEvent,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import type { FamilyId } from "#/domain/model";
import type { ValuePoint } from "#/domain/value";
import type { BenchmarkView } from "#/lib/benchmarks";
import { paretoFrontier, spreadLabels } from "#/lib/chart";
import { familyColor } from "#/lib/families";
import { isTextEntryTarget } from "#/lib/textEntry";
import { useElementSize } from "#/lib/useElementSize";
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
import { highlightedModel, NO_HIGHLIGHT, updateHighlight } from "./highlight";
import { PointTooltip } from "./PointTooltip";
import { usePointDetails } from "./pointDetails";
import { buildSeries, groupByModel, modelEnd, type Series } from "./series";

/**
 * Escape meant for the chart, not for a text field or for the sheet that made
 * the chart inert.
 */
function isChartEscape(event: KeyboardEvent, chart: HTMLElement | null) {
	return (
		event.key === "Escape" &&
		!isTextEntryTarget(event.target) &&
		!chart?.closest("[inert]")
	);
}

/** Something Escape closes while it is `open`. */
type Dismissable = { open: boolean; close: () => void };

/**
 * While any layer is open, Escape meant for the chart closes the first open
 * one, so the layers peel off in order.
 */
function useChartEscape(
	chart: RefObject<HTMLElement | null>,
	layers: readonly Dismissable[],
) {
	const closeFirst = useEffectEvent(() => layers.find((l) => l.open)?.close());
	const enabled = layers.some((l) => l.open);
	useEffect(() => {
		if (!enabled) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (isChartEscape(event, chart.current)) closeFirst();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [enabled, chart]);
}

/**
 * A line fades unless it holds the shown point or, with none shown, belongs to
 * the highlighted model.
 */
function isDimmed(
	series: Series,
	activePoint: ValuePoint | null,
	highlighted: FamilyId | null,
) {
	if (activePoint) return activePoint.seriesId !== series.id;
	return highlighted !== null && highlighted !== series.modelId;
}

/** Shared label and legend highlight. */
function useModelHighlight(plotted: ReadonlySet<FamilyId>) {
	const [highlight, dispatch] = useReducer(updateHighlight, NO_HIGHLIGHT);
	const [prunedFor, setPrunedFor] = useState(plotted);
	if (prunedFor !== plotted) {
		// Forget models that left the chart before this render commits.
		setPrunedFor(plotted);
		dispatch({ type: "prune", plotted });
	}
	return [highlight, dispatch] as const;
}

/** useElementSize's ref, plus a ref object so handlers can read the element. */
function useChartRef() {
	const [sizeRef, size] = useElementSize<HTMLDivElement>();
	const element = useRef<HTMLDivElement | null>(null);
	const ref = useCallback(
		(node: HTMLDivElement | null) => {
			element.current = node;
			return sizeRef(node);
		},
		[sizeRef],
	);
	return { ref, element, size };
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
	// The shown point is projected once; the guides, pills and tooltip share it.
	const active = details && {
		...details,
		readouts: pointReadouts(details.point, { x, y }, layout, width, benchmark),
	};

	return (
		<div ref={ref} className="relative lg:min-h-0 lg:flex-1">
			{/* biome-ignore lint/a11y/useSemanticElements: an SVG root cannot be a fieldset; role=img would hide the buttons inside */}
			<svg
				width={width}
				height={height}
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
					readouts={active?.readouts}
					axisLabel={benchmark.axisLabel}
				/>
				{showPareto && (
					<ParetoLine points={paretoFrontier(points)} x={x} y={y} />
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
						activePoint={activePoint}
						dimmed={isDimmed(s, activePoint, highlighted)}
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
