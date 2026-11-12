import type { ScaleLinear } from "d3-scale";
import { type FocusEvent, type KeyboardEvent, useEffect } from "react";
import type { FamilyId } from "#/domain/model";
import type { ValuePoint } from "#/domain/value";
import type { BenchmarkView } from "#/lib/benchmarks";
import type { LineLabel } from "#/lib/chart";
import { familyLabId } from "#/lib/families";
import { formatUsd } from "#/lib/format";
import { ProviderLogo } from "../ProviderLogo";
import { ColorDot } from "./ColorDot";
import {
	type AxisReadouts,
	type AxisScale,
	type ChartLayout,
	markerPath,
	overlaps,
	pathOf,
	px,
	type Rect,
	X_TICK_LABEL_DROP_PX,
	type XScale,
	xTickLabelBox,
	Y_TICK_LABEL_GAP_PX,
	yTickLabelBox,
} from "./geometry";
import type { HighlightEvent, PreviewSource } from "./highlight";
import { isFaded, type LitModels } from "./litModels";
import type { PointDetailsEvent } from "./pointDetails";
import { API_DASH, type ModelGroup, modelEnd, type Series } from "./series";

export function Axes({
	x,
	y,
	right,
	ticks,
	scale,
	layout,
	readouts,
	axisLabel,
}: {
	x: XScale;
	y: ScaleLinear<number, number>;
	right: number;
	ticks: number[];
	scale: AxisScale;
	layout: ChartLayout;
	/** The shown points' values, which hide the tick labels they cover. */
	readouts: readonly AxisReadouts[];
	axisLabel: string;
}) {
	const { margin, height } = layout;
	const bottom = height - margin.bottom;
	const covered = (label: Rect) =>
		readouts.some((r) => overlaps(label, r.x) || overlaps(label, r.y));
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
					{!covered(yTickLabelBox(String(t), y(t), layout)) && (
						<text
							x={margin.left - Y_TICK_LABEL_GAP_PX}
							y={px(y(t))}
							dy="0.32em"
							textAnchor="end"
						>
							{t}
						</text>
					)}
				</g>
			))}
			<line
				x1={margin.left}
				x2={right}
				y1={bottom}
				y2={bottom}
				className="stroke-grid"
			/>
			{ticks
				.filter((t) => !covered(xTickLabelBox(formatUsd(t), x(t), layout)))
				.map((t) => (
					<text
						key={t}
						x={px(x(t))}
						y={bottom + X_TICK_LABEL_DROP_PX}
						textAnchor="middle"
					>
						{formatUsd(t)}
					</text>
				))}
			<text x={margin.left} y={margin.top - 12} className="fill-subtle">
				{axisLabel}
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
	points: readonly ValuePoint[];
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

function pointLabel(
	series: Series,
	point: ValuePoint,
	benchmark: BenchmarkView,
): string {
	return `${series.label}, ${point.benchmark.effortLabel}, effective cost per task ${formatUsd(point.costPerTaskUsd)}, ${benchmark.scoreLabel} ${benchmark.formatScore(point.score)}`;
}

/** A key handler that runs `action` on Enter or Space, as a button does. */
export function onActivationKey(action: () => void) {
	return (event: KeyboardEvent) => {
		if (event.key !== "Enter" && event.key !== " ") return;
		event.preventDefault();
		action();
	};
}

/**
 * A focus handler that runs `action` for keyboard focus only, since a mouse
 * press focuses the point too.
 */
export function onKeyboardFocus(action: () => void) {
	return (event: FocusEvent) => {
		if (event.currentTarget.matches(":focus-visible")) action();
	};
}

/** How strongly a line draws: whole, faded, or faded but for some points. */
export type LineEmphasis =
	| { kind: "lit" }
	| { kind: "dimmed" }
	| { kind: "points"; lit: ReadonlySet<ValuePoint> };

const DIMMED_OPACITY = 0.15;

/**
 * A whole or dimmed series fades as one group, so a hollow marker hides the
 * line beneath it; only `points` fades its line and each point on their own.
 */
const groupOpacity = (emphasis: LineEmphasis) =>
	emphasis.kind === "dimmed" ? DIMMED_OPACITY : 1;

const lineOpacity = (emphasis: LineEmphasis) =>
	emphasis.kind === "points" ? DIMMED_OPACITY : undefined;

function pointOpacity(emphasis: LineEmphasis, point: ValuePoint) {
	if (emphasis.kind !== "points") return undefined;
	return emphasis.lit.has(point) ? 1 : DIMMED_OPACITY;
}

/**
 * Hover or focus previews a point's details; click, Enter or Space pins them,
 * or unpins them.
 */
export function SeriesLine({
	series,
	x,
	y,
	shownPoints,
	emphasis,
	onDetails,
	benchmark,
}: {
	series: Series;
	x: XScale;
	y: ScaleLinear<number, number>;
	/** The points whose details show, drawn larger. */
	shownPoints: readonly ValuePoint[];
	emphasis: LineEmphasis;
	onDetails: (event: PointDetailsEvent) => void;
	/** Names and formats the points' scores for screen readers. */
	benchmark: BenchmarkView;
}) {
	const { isApi, lineWidth } = series.pricing;
	return (
		<g opacity={groupOpacity(emphasis)} className="transition-opacity">
			<g opacity={lineOpacity(emphasis)} className="transition-opacity">
				<path
					d={pathOf(series.points, x, y)}
					fill="none"
					stroke={series.color}
					strokeWidth={lineWidth}
					strokeDasharray={isApi ? API_DASH : undefined}
					opacity={isApi ? 0.6 : 1}
				/>
			</g>
			{series.points.map((p) => (
				<g
					key={p.benchmark.id}
					opacity={pointOpacity(emphasis, p)}
					className="transition-opacity"
				>
					<SeriesPoint
						series={series}
						point={p}
						x={x}
						y={y}
						shown={shownPoints.includes(p)}
						onDetails={onDetails}
						benchmark={benchmark}
					/>
				</g>
			))}
		</g>
	);
}

function SeriesPoint({
	series,
	point,
	x,
	y,
	shown,
	onDetails,
	benchmark,
}: {
	series: Series;
	point: ValuePoint;
	x: XScale;
	y: ScaleLinear<number, number>;
	/** Its details show, so it draws larger. */
	shown: boolean;
	onDetails: (event: PointDetailsEvent) => void;
	benchmark: BenchmarkView;
}) {
	const { isApi, marker } = series.pricing;
	const preview = (source: PreviewSource) => () =>
		onDetails({ type: "preview", source, point });
	const endPreview = (source: PreviewSource) => () =>
		onDetails({ type: "endPreview", source, point });
	const pin = () => onDetails({ type: "togglePin", point });
	return (
		<g
			// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- SVG has no native button; the point needs focus to expose its tooltip
			role="button"
			tabIndex={0}
			aria-label={pointLabel(series, point, benchmark)}
			className="group cursor-pointer outline-none"
			onMouseEnter={preview("hover")}
			onMouseLeave={endPreview("hover")}
			onClick={pin}
			onKeyDown={onActivationKey(pin)}
			onFocus={onKeyboardFocus(preview("focus"))}
			onBlur={endPreview("focus")}
		>
			<circle
				cx={px(x(point.costPerTaskUsd))}
				cy={px(y(point.score))}
				r={POINT_HIT_RADIUS}
				fill="transparent"
			/>
			<path
				d={markerPath(
					marker,
					x(point.costPerTaskUsd),
					y(point.score),
					shown ? 6 : 4,
				)}
				fill={isApi ? "var(--bg)" : series.color}
				stroke={series.color}
				strokeWidth={1.5}
				className="group-focus-visible:stroke-fg"
			/>
		</g>
	);
}

/** One label per model beside the plot, tied to its rightmost line end. */
export function ModelTags({
	labels,
	models,
	x,
	right,
	lit,
	pinnedModel,
	onHighlight,
}: {
	labels: readonly LineLabel[];
	models: readonly ModelGroup[];
	x: XScale;
	right: number;
	/** The models that stay lit; the rest fade. */
	lit: LitModels;
	pinnedModel: FamilyId | null;
	onHighlight: (event: HighlightEvent) => void;
}) {
	return labels.map((label) => {
		const model = models.find((candidate) => candidate.id === label.id);
		if (!model) return null;
		return (
			<ModelTag
				key={model.id}
				model={model}
				from={[px(x(modelEnd(model).costPerTaskUsd)), label.anchorY]}
				at={[right + 24, label.y]}
				dimmed={isFaded(lit, model.id)}
				pinned={pinnedModel === model.id}
				onHighlight={onHighlight}
			/>
		);
	});
}

const TAG_LOGO_SIZE = 14;

/** Hover or focus previews the model; click, Enter or Space pins it. */
export function ModelTag({
	model,
	from,
	at,
	dimmed,
	pinned,
	onHighlight,
}: {
	model: ModelGroup;
	from: [number, number];
	at: [number, number];
	dimmed: boolean;
	pinned: boolean;
	onHighlight: (event: HighlightEvent) => void;
}) {
	const modelId = model.id;
	const preview = (source: PreviewSource) => () =>
		onHighlight({ type: "preview", source, modelId });
	const endPreview = (source: PreviewSource) => () =>
		onHighlight({ type: "endPreview", source, modelId });
	const toggle = () => onHighlight({ type: "toggle", modelId });
	// An unmounted label never sends mouseleave or blur, so end its previews here.
	useEffect(
		() => () => {
			onHighlight({ type: "endPreview", source: "hover", modelId });
			onHighlight({ type: "endPreview", source: "focus", modelId });
		},
		[modelId, onHighlight],
	);
	return (
		<g
			// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- SVG has no native button; the label toggles its model's highlight
			role="button"
			tabIndex={0}
			aria-pressed={pinned}
			aria-label={`Highlight ${model.name}`}
			opacity={dimmed ? 0.25 : 1}
			// A press on a label pins it rather than starting a camera turn.
			onPointerDown={(event) => event.stopPropagation()}
			onMouseEnter={preview("hover")}
			onMouseLeave={endPreview("hover")}
			onFocus={preview("focus")}
			onBlur={endPreview("focus")}
			onClick={toggle}
			onKeyDown={(event) => {
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				toggle();
			}}
			className="group cursor-pointer outline-none transition-opacity"
			style={{ color: model.color }}
		>
			<line
				x1={from[0] + 6}
				y1={from[1]}
				x2={at[0] - 6}
				y2={at[1]}
				className="stroke-grid"
			/>
			<ProviderLogo
				lab={familyLabId(model.id)}
				x={at[0]}
				y={at[1] - TAG_LOGO_SIZE / 2}
				size={TAG_LOGO_SIZE}
			/>
			<text
				x={at[0] + TAG_LOGO_SIZE + 5}
				y={at[1]}
				dy="0.32em"
				className="fill-fg text-[13px] font-medium group-focus-visible:underline"
			>
				{model.name}
			</text>
		</g>
	);
}

/** Below-chart legend for narrow screens: one entry per model. */
export function ModelLegend({
	models,
	lit,
	pinnedModel,
	onHighlight,
}: {
	models: readonly ModelGroup[];
	/** The models that stay lit; the rest fade. */
	lit: LitModels;
	pinnedModel: FamilyId | null;
	onHighlight: (event: HighlightEvent) => void;
}) {
	return (
		<ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[14px] font-medium">
			{models.map((model) => (
				<li key={model.id} className="min-w-0">
					<LegendButton
						model={model}
						pinned={pinnedModel === model.id}
						muted={isFaded(lit, model.id)}
						onHighlight={onHighlight}
					/>
				</li>
			))}
		</ul>
	);
}

function LegendButton({
	model,
	pinned,
	muted,
	onHighlight,
}: {
	model: ModelGroup;
	pinned: boolean;
	muted: boolean;
	onHighlight: (event: HighlightEvent) => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={pinned}
			onClick={() => onHighlight({ type: "toggle", modelId: model.id })}
			className="flex min-h-8 w-full items-center gap-2 text-left text-fg transition-opacity"
			style={{ opacity: muted ? 0.4 : 1 }}
		>
			<ColorDot color={model.color} />
			<ProviderLogo lab={familyLabId(model.id)} />
			<span className="truncate">{model.name}</span>
		</button>
	);
}
