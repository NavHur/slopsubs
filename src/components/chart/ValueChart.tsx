import { useMemo, useState } from "react";
import type { FamilyId } from "#/domain/model";
import type { ValuePoint } from "#/domain/value";
import { paretoFrontier, spreadLabels } from "#/lib/chart";
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
import { buildSeries, groupByModel, modelEnd, pricingKey } from "./series";

/** Room left of the desktop key for the y-axis title it shares a row with. */
const KEY_TITLE_ROOM_PX = 130;

export function ValueChart({
	points,
	scale,
	showPareto,
}: {
	points: readonly ValuePoint[];
	scale: AxisScale;
	showPareto: boolean;
}) {
	const [ref, size] = useElementSize<HTMLDivElement>();
	const { width } = size;
	const [hovered, setHovered] = useState<ValuePoint | null>(null);
	const [focusModel, setFocusModel] = useState<FamilyId | null>(null);
	const series = useMemo(() => buildSeries(points), [points]);
	const models = useMemo(() => groupByModel(series), [series]);
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
	const activeModel = hovered?.benchmark.family ?? focusModel;
	const dim = (id: string, modelId: FamilyId) =>
		hovered
			? hovered.seriesId !== id
			: focusModel !== null && focusModel !== modelId;
	const pricings = pricingKey(series);

	return (
		<div ref={ref} className="relative lg:min-h-0 lg:flex-1">
			<svg
				width={width}
				height={height}
				role="img"
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
					onFocus={setFocusModel}
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
						onFocus={setFocusModel}
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
