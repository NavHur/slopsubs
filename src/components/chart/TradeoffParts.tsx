import type { FamilyId } from "#/domain/model";
import type { BenchmarkView } from "#/lib/benchmarks";
import { familyColor, familyName } from "#/lib/families";
import { formatDuration, formatUsd } from "#/lib/format";
import { onActivationKey, onKeyboardFocus } from "./ChartParts";
import { markerPath } from "./geometry";
import type { PreviewSource } from "./highlight";
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
				{scene.floorGrid.map((line) => (
					<line key={`${line.x1},${line.y1}`} {...line} />
				))}
				{scene.wallGrid.map((line) => (
					<line key={`${line.x1},${line.y1}`} {...line} strokeDasharray="2 6" />
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

/** Fades a model while another is highlighted, else a beaten option. */
function emphasis(
	family: FamilyId,
	worthWeighing: boolean,
	active: FamilyId | null,
) {
	if (active !== null && active !== family) return DIMMED_OPACITY;
	return worthWeighing ? 1 : BEATEN_OPACITY;
}

/**
 * Each model's efforts joined low to high, drawn as the cost and score chart
 * draws the pricing's lines.
 */
export function EffortLines({
	steps,
	pricing,
	activeModel,
}: {
	steps: readonly EffortStep[];
	pricing: PricingStyle;
	/** The highlighted model, or the one whose point shows; the rest fade. */
	activeModel: FamilyId | null;
}) {
	const { isApi, lineWidth } = pricing;
	return (
		<g aria-hidden="true" pointerEvents="none" opacity={isApi ? 0.6 : 1}>
			{steps.map((step) => (
				<line
					key={step.key}
					x1={step.x1}
					y1={step.y1}
					x2={step.x2}
					y2={step.y2}
					stroke={familyColor(step.family)}
					strokeWidth={lineWidth}
					strokeDasharray={isApi ? API_DASH : undefined}
					opacity={emphasis(step.family, step.worthWeighing, activeModel)}
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

/**
 * One option: the pricing's marker, with a line down to the floor so its cost
 * and time read off the grid. Hover or focus previews its details; click,
 * Enter or Space pins them.
 */
export function TradeoffPoint({
	scenePoint,
	pricing,
	active,
	activeModel,
	onDetails,
	view,
}: {
	scenePoint: ScenePoint;
	pricing: PricingStyle;
	/** Its details show, so it draws larger. */
	active: boolean;
	/** The highlighted model, or the one whose point shows; the rest fade. */
	activeModel: FamilyId | null;
	onDetails: (event: PointDetailsEvent) => void;
	/** Names and formats the score for screen readers. */
	view: BenchmarkView;
}) {
	const { point, at, floor, worthWeighing } = scenePoint;
	const { family } = point.benchmark;
	const color = familyColor(family);
	const preview = (source: PreviewSource) => () =>
		onDetails({ type: "preview", source, point });
	const endPreview = (source: PreviewSource) => () =>
		onDetails({ type: "endPreview", source, point });
	const pin = () => onDetails({ type: "togglePin", point });
	return (
		<g
			opacity={active ? 1 : emphasis(family, worthWeighing, activeModel)}
			className="transition-opacity"
		>
			<line
				x1={at.x}
				y1={at.y}
				x2={floor.x}
				y2={floor.y}
				stroke={color}
				strokeOpacity={0.25}
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
					d={markerPath(pricing.marker, at.x, at.y, active ? 6 : 4)}
					fill={pricing.isApi ? "var(--bg)" : color}
					stroke={color}
					strokeWidth={1.5}
					className="group-focus-visible:stroke-fg"
				/>
			</g>
		</g>
	);
}
