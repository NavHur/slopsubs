import {
	type RefObject,
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import type { FamilyId } from "#/domain/model";
import type { ValuePoint } from "#/domain/value";
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
import { Crosshair } from "./Crosshair";
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
import { buildSeries, groupByModel, modelEnd } from "./series";

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

/** Shared label and legend highlight; Escape clears a pinned model. */
function useModelHighlight(
	chart: RefObject<HTMLElement | null>,
	plotted: ReadonlySet<FamilyId>,
) {
	const [highlight, dispatch] = useReducer(updateHighlight, NO_HIGHLIGHT);
	const [prunedFor, setPrunedFor] = useState(plotted);
	if (prunedFor !== plotted) {
		// Forget models that left the chart before this render commits.
		setPrunedFor(plotted);
		dispatch({ type: "prune", plotted });
	}
	const hasPin = highlight.pinned !== null;
	useEffect(() => {
		if (!hasPin) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (isChartEscape(event, chart.current)) dispatch({ type: "clear" });
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [hasPin, chart]);
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
}: {
	points: readonly ValuePoint[];
	scale: AxisScale;
	showPareto: boolean;
	showLabels: boolean;
}) {
	const { ref, element, size } = useChartRef();
	const { width } = size;
	const [hovered, setHovered] = useState<ValuePoint | null>(null);
	const series = useMemo(() => buildSeries(points), [points]);
	const models = useMemo(() => groupByModel(series), [series]);
	const plotted = useMemo(() => new Set(models.map((m) => m.id)), [models]);
	const [shown, dispatchHighlight] = useModelHighlight(element, plotted);
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
					anchorY: px(y(modelEnd(m).intelligence)),
				})),
				gap: LABEL_GAP,
				top: margin.top,
				bottom: height - margin.bottom,
			})
		: [];
	const highlighted = highlightedModel(shown);
	const activeModel = hovered?.benchmark.family ?? highlighted;
	const dim = (id: string, modelId: FamilyId) =>
		hovered
			? hovered.seriesId !== id
			: highlighted !== null && highlighted !== modelId;

	return (
		<div ref={ref} className="relative lg:min-h-0 lg:flex-1">
			{/* biome-ignore lint/a11y/useSemanticElements: an SVG root cannot be a fieldset; role=img would hide the buttons inside */}
			<svg
				width={width}
				height={height}
				role="group"
				aria-label="Effective cost per task versus intelligence index"
				className="block select-none"
			>
				<Axes
					x={x}
					y={y}
					right={right}
					ticks={xTicks(x, scale)}
					scale={scale}
					layout={layout}
				/>
				{showPareto && (
					<ParetoLine points={paretoFrontier(points)} x={x} y={y} />
				)}
				{hovered && (
					<Crosshair
						point={hovered}
						color={familyColor(hovered.benchmark.family)}
						x={x}
						y={y}
						layout={layout}
						width={width}
					/>
				)}
				{series.map((s) => (
					<SeriesLine
						key={s.id}
						series={s}
						x={x}
						y={y}
						hovered={hovered}
						dimmed={dim(s.id, s.modelId)}
						onHover={setHovered}
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
			{hovered && (
				<PointTooltip
					point={hovered}
					anchor={{ x: x(hovered.costPerTaskUsd), y: y(hovered.intelligence) }}
					bounds={{ width, height }}
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
