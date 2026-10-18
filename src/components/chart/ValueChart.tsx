import { useMemo, useState } from "react";
import type { ValuePoint } from "#/domain/value";
import { paretoFrontier, spreadLabels } from "#/lib/chart";
import { familyColor, familyName } from "#/lib/families";
import { useElementSize } from "#/lib/useElementSize";
import {
	Axes,
	ParetoLine,
	PointTooltip,
	SeriesLegend,
	SeriesLine,
	SeriesTags,
} from "./ChartParts";
import {
	type AxisScale,
	chartLayout,
	LABEL_GAP,
	makeScales,
	px,
	type Series,
	xTicks,
} from "./geometry";

function pricingLabel(point: ValuePoint): string {
	return point.pricing.kind === "api" ? "API" : point.pricing.plan.label;
}

function seriesLabel(point: ValuePoint): string {
	return `${familyName(point.benchmark.family)} · ${pricingLabel(point)}`;
}

function groupSeries(points: readonly ValuePoint[]): Series[] {
	const groups = Map.groupBy(points, (p) => p.seriesId);
	return [...groups].map(([id, members]) => ({
		id,
		points: members,
		label: seriesLabel(members[0]),
		modelName: familyName(members[0].benchmark.family),
		pricingLabel: pricingLabel(members[0]),
		color: familyColor(members[0].benchmark.family),
		isApi: members[0].pricing.kind === "api",
	}));
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
	const [ref, size] = useElementSize<HTMLDivElement>();
	const { width } = size;
	const [hovered, setHovered] = useState<ValuePoint | null>(null);
	const [focusSeries, setFocusSeries] = useState<string | null>(null);
	const series = useMemo(() => groupSeries(points), [points]);
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
				anchors: series.map((s) => ({
					seriesId: s.id,
					anchorY: px(y(s.points[s.points.length - 1].intelligence)),
				})),
				gap: LABEL_GAP,
				top: margin.top,
				bottom: height - margin.bottom,
			});
	const activeSeries = hovered?.seriesId ?? focusSeries;
	const dim = (id: string) => activeSeries !== null && activeSeries !== id;

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
						dimmed={dim(s.id)}
						onHover={setHovered}
					/>
				))}
				<SeriesTags
					labels={labels}
					series={series}
					x={x}
					right={right}
					activeSeries={activeSeries}
					onFocus={setFocusSeries}
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
			{layout.compact && (
				<SeriesLegend
					series={series}
					activeSeries={activeSeries}
					onFocus={setFocusSeries}
				/>
			)}
		</div>
	);
}
