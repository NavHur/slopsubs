import type { ScaleLinear } from "d3-scale";
import type { ValuePoint } from "#/domain/value";
import { familyName } from "#/lib/families";
import type { SeriesLabel } from "#/lib/chart";
import { formatUsd } from "#/lib/format";
import {
	type AxisScale,
	type ChartLayout,
	pathOf,
	px,
	type Series,
	type XScale,
} from "./geometry";

export function Axes({
	x,
	y,
	right,
	ticks,
	scale,
	layout,
}: {
	x: XScale;
	y: ScaleLinear<number, number>;
	right: number;
	ticks: number[];
	scale: AxisScale;
	layout: ChartLayout;
}) {
	const { margin, height } = layout;
	const bottom = height - margin.bottom;
	return (
		<g className="fill-muted text-[12px] tabular-nums">
			{y.ticks(layout.compact ? 5 : 6).map((t) => (
				<g key={t}>
					<line
						x1={margin.left}
						x2={right}
						y1={px(y(t))}
						y2={px(y(t))}
						className="stroke-grid"
						strokeDasharray="2 6"
					/>
					<text x={margin.left - 12} y={px(y(t))} dy="0.32em" textAnchor="end">
						{t}
					</text>
				</g>
			))}
			<line
				x1={margin.left}
				x2={right}
				y1={bottom}
				y2={bottom}
				className="stroke-grid"
			/>
			{ticks.map((t) => (
				<text key={t} x={px(x(t))} y={bottom + 22} textAnchor="middle">
					{formatUsd(t)}
				</text>
			))}
			<text x={margin.left} y={margin.top - 12} className="fill-subtle">
				Intelligence index
			</text>
			<text
				x={(margin.left + right) / 2}
				y={height - 6}
				textAnchor="middle"
				className="fill-subtle"
			>
				Effective cost per task (USD{scale === "log" ? ", log scale" : ""})
			</text>
		</g>
	);
}

export function ParetoLine({
	points,
	x,
	y,
}: {
	points: ValuePoint[];
	x: XScale;
	y: ScaleLinear<number, number>;
}) {
	return (
		<path
			d={pathOf(points, x, y)}
			fill="none"
			className="stroke-subtle"
			strokeWidth={1}
			strokeDasharray="6 4"
		/>
	);
}

/** Touch-sized target around each 8px dot. */
const POINT_HIT_RADIUS = 12;

function pointLabel(series: Series, point: ValuePoint): string {
	return `${series.label}, ${point.benchmark.effortLabel}, effective cost per task ${formatUsd(point.costPerTaskUsd)}, intelligence ${point.intelligence.toFixed(1)}`;
}

export function SeriesLine({
	series,
	x,
	y,
	hovered,
	dimmed,
	onHover,
}: {
	series: Series;
	x: XScale;
	y: ScaleLinear<number, number>;
	hovered: ValuePoint | null;
	dimmed: boolean;
	onHover: (point: ValuePoint | null) => void;
}) {
	return (
		<g opacity={dimmed ? 0.15 : 1} className="transition-opacity">
			<path
				d={pathOf(series.points, x, y)}
				fill="none"
				stroke={series.color}
				strokeWidth={series.isApi ? 1.25 : 2}
				strokeDasharray={series.isApi ? "3 4" : undefined}
				opacity={series.isApi ? 0.6 : 1}
			/>
			{series.points.map((p) => (
				// biome-ignore lint/a11y/useSemanticElements: SVG has no native button; the point needs focus to expose its tooltip
				<g
					key={p.benchmark.id}
					role="button"
					tabIndex={0}
					aria-label={pointLabel(series, p)}
					className="group cursor-pointer outline-none"
					onMouseEnter={() => onHover(p)}
					onMouseLeave={() => onHover(null)}
					onClick={() => onHover(p)}
					onFocus={() => onHover(p)}
					onBlur={() => onHover(null)}
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
						fill={series.isApi ? "var(--bg)" : series.color}
						stroke={series.color}
						strokeWidth={1.5}
						className="group-focus-visible:stroke-fg"
					/>
				</g>
			))}
		</g>
	);
}

/** End-of-line labels beside the plot, each tied to its line's last point. */
export function SeriesTags({
	labels,
	series,
	x,
	right,
	activeSeries,
	onFocus,
}: {
	labels: readonly SeriesLabel[];
	series: readonly Series[];
	x: XScale;
	right: number;
	activeSeries: string | null;
	onFocus: (id: string | null) => void;
}) {
	return labels.map((label) => {
		const s = series.find((candidate) => candidate.id === label.seriesId);
		if (!s) return null;
		const last = s.points[s.points.length - 1];
		return (
			<SeriesTag
				key={s.id}
				series={s}
				from={[px(x(last.costPerTaskUsd)), label.anchorY]}
				at={[right + 24, label.y]}
				dimmed={activeSeries !== null && activeSeries !== s.id}
				onFocus={onFocus}
			/>
		);
	});
}

export function SeriesTag({
	series,
	from,
	at,
	dimmed,
	onFocus,
}: {
	series: Series;
	from: [number, number];
	at: [number, number];
	dimmed: boolean;
	onFocus: (id: string | null) => void;
}) {
	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: hover-only emphasis; the data is also in the tooltip and sidebar
		<g
			opacity={dimmed ? 0.25 : 1}
			onMouseEnter={() => onFocus(series.id)}
			onMouseLeave={() => onFocus(null)}
			className="cursor-default transition-opacity"
		>
			<line
				x1={from[0] + 6}
				y1={from[1]}
				x2={at[0] - 6}
				y2={at[1]}
				className="stroke-grid"
			/>
			<text
				x={at[0]}
				y={at[1]}
				dy="0.32em"
				fill={series.color}
				className="text-[13px] font-medium"
			>
				{series.label}
			</text>
		</g>
	);
}

const TOOLTIP_HALF_WIDTH_PX = 120;
/** Room the tooltip needs above its point before it flips below. */
const TOOLTIP_FLIP_PX = 140;

export function PointTooltip({
	point,
	left,
	top,
	containerWidth,
}: {
	point: ValuePoint;
	left: number;
	top: number;
	containerWidth: number;
}) {
	const { benchmark, pricing } = point;
	const clampedLeft = Math.min(
		Math.max(left, TOOLTIP_HALF_WIDTH_PX),
		containerWidth - TOOLTIP_HALF_WIDTH_PX,
	);
	const below = top < TOOLTIP_FLIP_PX;
	return (
		<div
			className={`pointer-events-none absolute z-10 w-60 -translate-x-1/2 rounded-md border border-line bg-panel px-3 py-2 text-[12px] leading-5 shadow-[0_8px_24px_rgb(0_0_0/0.35)] ${below ? "translate-y-[14px]" : "-translate-y-[calc(100%+14px)]"}`}
			style={{ left: clampedLeft, top }}
		>
			<div className="font-semibold text-fg">
				{familyName(benchmark.family)}{" "}
				<span className="font-normal text-muted">
					· {benchmark.effortLabel}
				</span>
			</div>
			<div className="text-muted">
				{pricing.kind === "api" ? "Pay per token (API)" : pricing.plan.label}
			</div>
			<dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-3 tabular-nums">
				<dt className="text-muted">Effective / task</dt>
				<dd className="text-right text-fg">
					{formatUsd(point.costPerTaskUsd)}
				</dd>
				{pricing.kind === "plan" && (
					<>
						<dt className="text-muted">API / task</dt>
						<dd className="text-right">
							{formatUsd(benchmark.costPerTaskUsd ?? 0)}
						</dd>
						<dt className="text-muted">Value multiple</dt>
						<dd className="text-right">{pricing.valueMultiple.toFixed(1)}×</dd>
					</>
				)}
				<dt className="text-muted">Intelligence</dt>
				<dd className="text-right">{point.intelligence.toFixed(1)}</dd>
			</dl>
		</div>
	);
}

/** Below-chart legend for narrow screens, grouped by how each line is paid for. */
export function SeriesLegend({
	series,
	activeSeries,
	onFocus,
}: {
	series: readonly Series[];
	activeSeries: string | null;
	onFocus: (id: string | null) => void;
}) {
	const groups = Map.groupBy(series, (s) => s.pricingLabel);
	return (
		<div className="mt-3 space-y-3">
			{[...groups].map(([pricing, members]) => (
				<section key={pricing}>
					<h3 className="text-[12px] font-medium text-subtle">{pricing}</h3>
					<ul className="grid grid-cols-2 gap-x-3 text-[14px] font-medium">
						{members.map((s) => (
							<li key={s.id} className="min-w-0">
								<LegendButton
									series={s}
									active={activeSeries === s.id}
									muted={activeSeries !== null && activeSeries !== s.id}
									onFocus={onFocus}
								/>
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}

function LegendButton({
	series,
	active,
	muted,
	onFocus,
}: {
	series: Series;
	active: boolean;
	muted: boolean;
	onFocus: (id: string | null) => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={active}
			aria-label={series.label}
			onClick={() => onFocus(active ? null : series.id)}
			className="flex min-h-10 w-full items-center gap-2 text-left transition-opacity"
			style={{ color: series.color, opacity: muted ? 0.4 : 1 }}
		>
			<span
				aria-hidden
				className="w-3.5 shrink-0 border-t-2"
				style={{
					borderColor: series.color,
					borderStyle: series.isApi ? "dashed" : "solid",
				}}
			/>
			<span className="truncate">{series.modelName}</span>
		</button>
	);
}
