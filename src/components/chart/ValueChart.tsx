import { useMemo, useState } from "react";
import type { ValuePoint } from "#/domain/value";
import { paretoFrontier, spreadLabels } from "#/lib/chart";
import { familyColor, familyName } from "#/lib/families";
import { formatUsd } from "#/lib/format";
import { useElementSize } from "#/lib/useElementSize";
import {
	Axes,
	ParetoLine,
	PointTooltip,
	SeriesLegend,
	SeriesTag,
} from "./ChartParts";
import {
	type AxisScale,
	chartLayout,
	LABEL_GAP,
	makeScales,
	pathOf,
	px,
	type Series,
	xTicks,
} from "./geometry";

/** Touch-sized target around each 8px dot. */
const POINT_HIT_RADIUS = 12;

function pricingLabel(point: ValuePoint): string {
	return point.pricing.kind === "api" ? "API" : point.pricing.plan.label;
}

function seriesLabel(point: ValuePoint): string {
	return `${familyName(point.benchmark.family)} · ${pricingLabel(point)}`;
}

function pointLabel(point: ValuePoint): string {
	return `${seriesLabel(point)}, ${point.benchmark.effortLabel}, effective cost per task ${formatUsd(point.costPerTaskUsd)}, intelligence ${point.intelligence.toFixed(1)}`;
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
					<g
						key={s.id}
						opacity={dim(s.id) ? 0.15 : 1}
						className="transition-opacity"
					>
						<path
							d={pathOf(s.points, x, y)}
							fill="none"
							stroke={s.color}
							strokeWidth={s.isApi ? 1.25 : 2}
							strokeDasharray={s.isApi ? "3 4" : undefined}
							opacity={s.isApi ? 0.6 : 1}
						/>
						{s.points.map((p) => (
							// biome-ignore lint/a11y/useSemanticElements: SVG has no native button; the point needs focus to expose its tooltip
							<g
								key={p.benchmark.id}
								role="button"
								tabIndex={0}
								aria-label={pointLabel(p)}
								className="group cursor-pointer outline-none"
								onMouseEnter={() => setHovered(p)}
								onMouseLeave={() => setHovered(null)}
								onClick={() => setHovered(p)}
								onFocus={() => setHovered(p)}
								onBlur={() => setHovered(null)}
							>
								<circle
									cx={px(x(p.costPerTaskUsd))}
									cy={px(y(p.intelligence))}
									r={POINT_HIT_RADIUS}
									fill="transparent"
								/>
								<circle
									cx={px(x(p.costPerTaskUsd))}
									cy={px(y(p.intelligence))}
									r={hovered === p ? 6 : 4}
									fill={s.isApi ? "var(--bg)" : s.color}
									stroke={s.color}
									strokeWidth={1.5}
									className="group-focus-visible:stroke-fg"
								/>
							</g>
						))}
					</g>
				))}
				{labels.map((label) => {
					const s = series.find((candidate) => candidate.id === label.seriesId);
					if (!s) return null;
					const last = s.points[s.points.length - 1];
					return (
						<SeriesTag
							key={s.id}
							series={s}
							from={[px(x(last.costPerTaskUsd)), label.anchorY]}
							at={[right + 24, label.y]}
							dimmed={dim(s.id)}
							onFocus={setFocusSeries}
						/>
					);
				})}
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
