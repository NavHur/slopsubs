import type { ScaleLinear } from "d3-scale";
import { type FocusEvent, type KeyboardEvent, useEffect } from "react";
import type { FamilyId } from "#/domain/model";
import type { ValuePoint } from "#/domain/value";
import type { LineLabel } from "#/lib/chart";
import { familyLabId } from "#/lib/families";
import { formatUsd } from "#/lib/format";
import { ProviderLogo } from "../ProviderLogo";
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
}: {
	x: XScale;
	y: ScaleLinear<number, number>;
	right: number;
	ticks: number[];
	scale: AxisScale;
	layout: ChartLayout;
	/** The shown point's values, which hide the tick labels they cover. */
	readouts?: AxisReadouts;
}) {
	const { margin, height } = layout;
	const bottom = height - margin.bottom;
	const covered = (label: Rect) =>
		readouts !== undefined &&
		(overlaps(label, readouts.x) || overlaps(label, readouts.y));
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

/** A key handler that runs `action` on Enter or Space, as a button does. */
function onActivationKey(action: () => void) {
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
function onKeyboardFocus(action: () => void) {
	return (event: FocusEvent) => {
		if (event.currentTarget.matches(":focus-visible")) action();
	};
}

/**
 * Hover or focus previews a point's details; click, Enter or Space pins them,
 * or unpins them.
 */
export function SeriesLine({
	series,
	x,
	y,
	activePoint,
	dimmed,
	onDetails,
}: {
	series: Series;
	x: XScale;
	y: ScaleLinear<number, number>;
	/** The point whose details show, drawn larger. */
	activePoint: ValuePoint | null;
	dimmed: boolean;
	onDetails: (event: PointDetailsEvent) => void;
}) {
	const { isApi, marker, lineWidth } = series.pricing;
	const preview = (source: PreviewSource, point: ValuePoint) => () =>
		onDetails({ type: "preview", source, point });
	const endPreview = (source: PreviewSource, point: ValuePoint) => () =>
		onDetails({ type: "endPreview", source, point });
	const pin = (point: ValuePoint) => () =>
		onDetails({ type: "togglePin", point });
	return (
		<g opacity={dimmed ? 0.15 : 1} className="transition-opacity">
			<path
				d={pathOf(series.points, x, y)}
				fill="none"
				stroke={series.color}
				strokeWidth={lineWidth}
				strokeDasharray={isApi ? API_DASH : undefined}
				opacity={isApi ? 0.6 : 1}
			/>
			{series.points.map((p) => (
				// biome-ignore lint/a11y/useSemanticElements: SVG has no native button; the point needs focus to expose its tooltip
				<g
					key={p.benchmark.id}
					role="button"
					tabIndex={0}
					aria-label={pointLabel(series, p)}
					className="group cursor-pointer outline-none"
					onMouseEnter={preview("hover", p)}
					onMouseLeave={endPreview("hover", p)}
					onClick={pin(p)}
					onKeyDown={onActivationKey(pin(p))}
					onFocus={onKeyboardFocus(preview("focus", p))}
					onBlur={endPreview("focus", p)}
				>
					<circle
						cx={px(x(p.costPerTaskUsd))}
						cy={px(y(p.intelligence))}
						r={POINT_HIT_RADIUS}
						fill="transparent"
					/>
					<path
						d={markerPath(
							marker,
							x(p.costPerTaskUsd),
							y(p.intelligence),
							activePoint === p ? 6 : 4,
						)}
						fill={isApi ? "var(--bg)" : series.color}
						stroke={series.color}
						strokeWidth={1.5}
						className="group-focus-visible:stroke-fg"
					/>
				</g>
			))}
		</g>
	);
}

/** One label per model beside the plot, tied to its rightmost line end. */
export function ModelTags({
	labels,
	models,
	x,
	right,
	activeModel,
	pinnedModel,
	onHighlight,
}: {
	labels: readonly LineLabel[];
	models: readonly ModelGroup[];
	x: XScale;
	right: number;
	activeModel: FamilyId | null;
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
				dimmed={activeModel !== null && activeModel !== model.id}
				pinned={pinnedModel === model.id}
				onHighlight={onHighlight}
			/>
		);
	});
}

const TAG_LOGO_SIZE = 14;

/** Hover or focus previews the model; click, Enter or Space pins it. */
function ModelTag({
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
		// biome-ignore lint/a11y/useSemanticElements: SVG has no native button; the label toggles its model's highlight
		<g
			role="button"
			tabIndex={0}
			aria-pressed={pinned}
			aria-label={`Highlight ${model.name}`}
			opacity={dimmed ? 0.25 : 1}
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
				fill={model.color}
				className="text-[13px] font-medium group-focus-visible:underline"
			>
				{model.name}
			</text>
		</g>
	);
}

/** Below-chart legend for narrow screens: one entry per model. */
export function ModelLegend({
	models,
	activeModel,
	pinnedModel,
	onHighlight,
}: {
	models: readonly ModelGroup[];
	activeModel: FamilyId | null;
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
						muted={activeModel !== null && activeModel !== model.id}
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
			className="flex min-h-8 w-full items-center gap-2 text-left transition-opacity"
			style={{ color: model.color, opacity: muted ? 0.4 : 1 }}
		>
			<span
				aria-hidden
				className="size-2 shrink-0 rounded-full"
				style={{ backgroundColor: model.color }}
			/>
			<ProviderLogo lab={familyLabId(model.id)} />
			<span className="truncate">{model.name}</span>
		</button>
	);
}
