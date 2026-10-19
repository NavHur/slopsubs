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
import { isTextEntryTarget } from "#/lib/textEntry";
import { useElementSize } from "#/lib/useElementSize";
import {
	Axes,
	ModelLegend,
	ModelTags,
	ParetoLine,
	PointTooltip,
	PricingKey,
	SeriesLine,
} from "./ChartParts";
import {
	type AxisScale,
	chartLayout,
	LABEL_GAP,
	makeScales,
	px,
	xTicks,
} from "./geometry";
import {
	highlightedModel,
	NO_HIGHLIGHT,
	pinnedOnly,
	plottedHighlight,
	updateHighlight,
} from "./highlight";
import { buildSeries, groupByModel, modelEnd, pricingKey } from "./series";

/** Room left of the desktop key for the y-axis title it shares a row with. */
const KEY_TITLE_ROOM_PX = 130;

/** Escape meant for a text field, or for the sheet that made the chart inert. */
function escapeBelongsElsewhere(
	event: KeyboardEvent,
	chart: HTMLElement | null,
): boolean {
	return isTextEntryTarget(event.target) || Boolean(chart?.closest("[inert]"));
}

/** Shared label and legend highlight; Escape clears a pinned model. */
function useModelHighlight(chart: RefObject<HTMLElement | null>) {
	const [highlight, dispatch] = useReducer(updateHighlight, NO_HIGHLIGHT);
	const hasPin = highlight.pinned !== null;
	useEffect(() => {
		if (!hasPin) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			if (escapeBelongsElsewhere(event, chart.current)) return;
			dispatch({ type: "clear" });
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
}: {
	points: readonly ValuePoint[];
	scale: AxisScale;
	showPareto: boolean;
}) {
	const { ref, element, size } = useChartRef();
	const { width } = size;
	const [hovered, setHovered] = useState<ValuePoint | null>(null);
	const [highlight, dispatchHighlight] = useModelHighlight(element);
	const series = useMemo(() => buildSeries(points), [points]);
	const models = useMemo(() => groupByModel(series), [series]);
	const plotted = useMemo(() => new Set(models.map((m) => m.id)), [models]);
	const layout = chartLayout(size);
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
	const labels = layout.compact
		? []
		: spreadLabels({
				anchors: models.map((m) => ({
					id: m.id,
					anchorY: px(y(modelEnd(m).intelligence)),
				})),
				gap: LABEL_GAP,
				top: margin.top,
				bottom: height - margin.bottom,
			});
	const plottedState = plottedHighlight(highlight, plotted);
	const shown = layout.compact ? pinnedOnly(plottedState) : plottedState;
	const highlighted = highlightedModel(shown);
	const activeModel = hovered?.benchmark.family ?? highlighted;
	const dim = (id: string, modelId: FamilyId) =>
		hovered
			? hovered.seriesId !== id
			: highlighted !== null && highlighted !== modelId;
	const pricings = pricingKey(series);

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
					left={x(hovered.costPerTaskUsd)}
					top={y(hovered.intelligence)}
					containerWidth={width}
				/>
			)}
			{layout.compact ? (
				<>
					<PricingKey pricings={pricings} className="mt-3" />
					<ModelLegend
						models={models}
						activeModel={activeModel}
						pinnedModel={shown.pinned}
						onHighlight={dispatchHighlight}
					/>
				</>
			) : (
				<PricingKey
					pricings={pricings}
					className="absolute top-0 justify-end"
					style={{
						right: width - right,
						maxWidth: right - margin.left - KEY_TITLE_ROOM_PX,
					}}
				/>
			)}
		</div>
	);
}
