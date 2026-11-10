import type { FamilyId } from "#/domain/model";
import type { BenchmarkView } from "#/lib/benchmarks";
import { familyColor, familyName } from "#/lib/families";
import { formatDuration, formatUsd } from "#/lib/format";
import { onActivationKey, onKeyboardFocus } from "./ChartParts";
import { markerPath } from "./geometry";
import type { PreviewSource } from "./highlight";
import { isFaded, type LitModels } from "./litModels";
import type { AxisId } from "./plotSpace";
import type { PointDetailsEvent } from "./pointDetails";
import { API_DASH, type PricingStyle } from "./series";
import type { EffortStep, ScenePoint, TradeoffScene } from "./tradeoffScene";

/** How an axis's title stands off the axis's end (px). */
const AXIS_TITLES: Record<
	AxisId,
	{ dx: number; dy: number; anchor: "start" | "middle" | "end" }
> = {
	minutes: { dx: 0, dy: -12, anchor: "middle" },
	// Below the end's tick label, so the plot keeps the width it would cost.
	cost: { dx: 0, dy: 38, anchor: "end" },
	score: { dx: -6, dy: -14, anchor: "start" },
};

function axisTitle(id: AxisId, view: BenchmarkView): string {
	if (id === "minutes") return "Time per task (min)";
	if (id === "cost") return "Cost per task (log)";
	return view.axisLabel;
}

/** The gridlines, axes and their labels: everything behind the points. */
export function SceneFrame({
	scene,
	view,
}: {
	scene: TradeoffScene;
	/** Names the score axis. */
	view: BenchmarkView;
}) {
	const titles = Object.entries(scene.axisTitles) as [
		AxisId,
		{ x: number; y: number },
	][];
	return (
		<g aria-hidden="true">
			<g className="stroke-grid" strokeWidth={1}>
				{scene.floorGrid.map(({ key, ...line }) => (
					<line key={key} {...line} />
				))}
				{scene.wallGrid.map(({ key, ...line }) => (
					<line key={key} {...line} strokeDasharray="2 6" />
				))}
			</g>
			<g className="stroke-subtle" strokeWidth={1.5}>
				{Object.entries(scene.axes).map(([id, line]) => (
					<line key={id} {...line} />
				))}
			</g>
			<g className="fill-muted text-[12px] tabular-nums">
				{scene.tickLabels.map((label) => (
					<text
						key={label.key}
						x={label.x}
						y={label.y}
						textAnchor={label.anchor}
					>
						{label.text}
					</text>
				))}
			</g>
			<g className="fill-subtle text-[12px] font-medium">
				{titles.map(([id, end]) => (
					<text
						key={id}
						x={end.x + AXIS_TITLES[id].dx}
						y={end.y + AXIS_TITLES[id].dy}
						textAnchor={AXIS_TITLES[id].anchor}
					>
						{axisTitle(id, view)}
					</text>
				))}
			</g>
		</g>
	);
}

/** Opacity of an option another beats on cost, time and score. */
const BEATEN_OPACITY = 0.25;
/** Opacity of a model's points and lines while another is highlighted. */
const DIMMED_OPACITY = 0.12;

/** Fades a model while others are lit, else a beaten option. */
function emphasis(family: FamilyId, worthWeighing: boolean, lit: LitModels) {
	if (isFaded(lit, family)) return DIMMED_OPACITY;
	return worthWeighing ? 1 : BEATEN_OPACITY;
}

/** The model's colour pushed toward the text's: darker on a light page,
 * lighter on a dark one, so the options worth weighing stand off the grid. */
function strongColor(family: FamilyId): string {
	return `color-mix(in oklab, ${familyColor(family)} 75%, var(--color-fg))`;
}

/**
 * Each model's efforts joined low to high, drawn as the cost and score chart
 * draws the pricing's lines.
 */
export function EffortLines({
	steps,
	pricing,
	lit,
}: {
	steps: readonly EffortStep[];
	pricing: PricingStyle;
	/** The models that stay lit: the highlighted one, or those whose points show. */
	lit: LitModels;
}) {
	const { isApi, lineWidth } = pricing;
	return (
		<g aria-hidden="true" pointerEvents="none">
			{steps.map((step) => (
				<line
					key={step.key}
					x1={step.x1}
					y1={step.y1}
					x2={step.x2}
					y2={step.y2}
					stroke={
						step.worthWeighing
							? strongColor(step.family)
							: familyColor(step.family)
					}
					strokeWidth={step.worthWeighing ? lineWidth + 0.5 : lineWidth}
					strokeDasharray={isApi ? API_DASH : undefined}
					opacity={emphasis(step.family, step.worthWeighing, lit)}
					className="transition-opacity"
				/>
			))}
		</g>
	);
}

/** Touch-sized target around each point's marker. */
const HIT_RADIUS_PX = 12;

function pointLabel({ point, worthWeighing }: ScenePoint, view: BenchmarkView) {
	const { benchmark } = point;
	const measures = `${formatUsd(point.costPerTaskUsd)} per task, ${formatDuration(point.secondsPerTask)} per task, ${view.scoreLabel} ${view.formatScore(point.score)}`;
	const verdict = worthWeighing ? "" : ", beaten on cost, time and score";
	return `${familyName(benchmark.family)}, ${benchmark.effortLabel}, ${measures}${verdict}`;
}

/** Marker radius of an option worth weighing, a beaten one, and the one
 * whose details show (px). */
const MARKER_RADIUS_PX = { worth: 5, beaten: 4, active: 7 };

/**
 * One option: the pricing's marker, filled when it is worth weighing and
 * hollow when another beats it, with a line down to the floor so its cost
 * and time read off the grid. Hover or focus previews its details; click,
 * Enter or Space pins them.
 */
export function TradeoffPoint({
	scenePoint,
	pricing,
	active,
	lit,
	onDetails,
	view,
}: {
	scenePoint: ScenePoint;
	pricing: PricingStyle;
	/** Its details show, so it draws larger. */
	active: boolean;
	/** The models that stay lit: the highlighted one, or those whose points show. */
	lit: LitModels;
	onDetails: (event: PointDetailsEvent) => void;
	/** Names and formats the score for screen readers. */
	view: BenchmarkView;
}) {
	const { point, at, floor, worthWeighing } = scenePoint;
	const { family } = point.benchmark;
	const color = worthWeighing ? strongColor(family) : familyColor(family);
	const restingRadius = MARKER_RADIUS_PX[worthWeighing ? "worth" : "beaten"];
	const radius = active ? MARKER_RADIUS_PX.active : restingRadius;
	const preview = (source: PreviewSource) => () =>
		onDetails({ type: "preview", source, point });
	const endPreview = (source: PreviewSource) => () =>
		onDetails({ type: "endPreview", source, point });
	const pin = () => onDetails({ type: "togglePin", point });
	return (
		<g
			opacity={active ? 1 : emphasis(family, worthWeighing, lit)}
			className="transition-opacity"
		>
			<line
				x1={at.x}
				y1={at.y}
				x2={floor.x}
				y2={floor.y}
				stroke={color}
				strokeOpacity={worthWeighing ? 0.4 : 0.25}
				pointerEvents="none"
			/>
			<g
				// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- SVG has no native button; the point needs focus to expose its tooltip
				role="button"
				tabIndex={0}
				aria-label={pointLabel(scenePoint, view)}
				className="group cursor-pointer outline-none"
				// A press on a point picks it rather than starting a turn.
				onPointerDown={(event) => event.stopPropagation()}
				onMouseEnter={preview("hover")}
				onMouseLeave={endPreview("hover")}
				onClick={pin}
				onKeyDown={onActivationKey(pin)}
				onFocus={onKeyboardFocus(preview("focus"))}
				onBlur={endPreview("focus")}
			>
				<circle cx={at.x} cy={at.y} r={HIT_RADIUS_PX} fill="transparent" />
				<path
					d={markerPath(pricing.marker, at.x, at.y, radius)}
					fill={worthWeighing ? color : "var(--bg)"}
					stroke={color}
					strokeWidth={1.5}
					className="group-focus-visible:stroke-fg"
				/>
			</g>
		</g>
	);
}
