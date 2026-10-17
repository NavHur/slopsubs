import type { ScaleLinear } from "d3-scale";
import type { ValuePoint } from "#/domain/value";
import { familyName } from "#/lib/families";
import { formatUsd } from "#/lib/format";
import {
	type AxisScale,
	HEIGHT,
	MARGIN,
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
}: {
	x: XScale;
	y: ScaleLinear<number, number>;
	right: number;
	ticks: number[];
	scale: AxisScale;
}) {
	const bottom = HEIGHT - MARGIN.bottom;
	return (
		<g className="fill-muted text-[12px]">
			{y.ticks(6).map((t) => (
				<g key={t}>
					<line
						x1={MARGIN.left}
						x2={right}
						y1={px(y(t))}
						y2={px(y(t))}
						className="stroke-grid"
						strokeDasharray="2 6"
					/>
					<text x={MARGIN.left - 12} y={px(y(t))} dy="0.32em" textAnchor="end">
						{t}
					</text>
				</g>
			))}
			<line
				x1={MARGIN.left}
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
			<text x={MARGIN.left} y={MARGIN.top - 12} className="fill-subtle">
				Intelligence index
			</text>
			<text
				x={(MARGIN.left + right) / 2}
				y={HEIGHT - 6}
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

export function PointTooltip({
	point,
	left,
	top,
}: {
	point: ValuePoint;
	left: number;
	top: number;
}) {
	const { benchmark, pricing } = point;
	return (
		<div
			className="pointer-events-none absolute z-10 w-60 -translate-x-1/2 -translate-y-[calc(100%+14px)] rounded-md border border-line bg-panel px-3 py-2 text-[12px] leading-5 shadow-xl"
			style={{ left, top }}
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
