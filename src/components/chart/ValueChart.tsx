import { useMemo, useState } from "react";
import type { ValuePoint } from "#/domain/value";
import { paretoFrontier, spreadLabels } from "#/lib/chart";
import { familyColor, familyName } from "#/lib/families";
import { formatUsd } from "#/lib/format";
import { useElementWidth } from "#/lib/useElementWidth";
import { Axes, ParetoLine, PointTooltip, SeriesTag } from "./ChartParts";
import {
	type AxisScale,
	HEIGHT,
	LABEL_GAP,
	MARGIN,
	makeScales,
	pathOf,
	px,
	type Series,
	xTicks,
} from "./geometry";

function seriesLabel(point: ValuePoint): string {
	const name = familyName(point.benchmark.family);
	return point.pricing.kind === "api"
		? `${name} · API`
		: `${name} · ${point.pricing.plan.label}`;
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
	const [ref, width] = useElementWidth<HTMLDivElement>();
	const [hovered, setHovered] = useState<ValuePoint | null>(null);
	const [focusSeries, setFocusSeries] = useState<string | null>(null);
	const series = useMemo(() => groupSeries(points), [points]);

	if (points.length === 0) {
		return (
			<div
				ref={ref}
				className="grid h-[620px] place-items-center text-sm text-muted"
			>
				Nothing to plot. Pick a model, or measure a plan.
			</div>
		);
	}

	const { x, y, right } = makeScales(points, scale, width);
	const labels = spreadLabels({
		anchors: series.map((s) => ({
			seriesId: s.id,
			anchorY: px(y(s.points[s.points.length - 1].intelligence)),
		})),
		gap: LABEL_GAP,
		top: MARGIN.top,
		bottom: HEIGHT - MARGIN.bottom,
	});
	const activeSeries = hovered?.seriesId ?? focusSeries;
	const dim = (id: string) => activeSeries !== null && activeSeries !== id;

	return (
		<div ref={ref} className="relative">
			<svg
				width={width}
				height={HEIGHT}
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
							<circle
								key={p.benchmark.id}
								cx={px(x(p.costPerTaskUsd))}
								cy={px(y(p.intelligence))}
								r={hovered === p ? 6 : 4}
								fill={s.isApi ? "var(--bg)" : s.color}
								stroke={s.color}
								strokeWidth={1.5}
								role="button"
								tabIndex={0}
								aria-label={pointLabel(p)}
								className="cursor-pointer outline-none focus-visible:stroke-fg"
								onMouseEnter={() => setHovered(p)}
								onMouseLeave={() => setHovered(null)}
								onFocus={() => setHovered(p)}
								onBlur={() => setHovered(null)}
							/>
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
				/>
			)}
		</div>
	);
}
