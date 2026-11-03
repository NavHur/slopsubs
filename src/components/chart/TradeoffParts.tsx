import type { BenchmarkView } from "#/lib/benchmarks";
import { familyColor, familyLabId, familyName } from "#/lib/families";
import { formatDuration, formatUsd } from "#/lib/format";
import { ProviderLogo } from "../ProviderLogo";
import { onActivationKey, onKeyboardFocus } from "./ChartParts";
import type { PreviewSource } from "./highlight";
import type { AxisId } from "./plotSpace";
import type { PointDetailsEvent } from "./pointDetails";
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

/** Each model's efforts joined low to high, faded where one end is beaten. */
export function EffortLines({ steps }: { steps: readonly EffortStep[] }) {
	return (
		<g aria-hidden="true" pointerEvents="none">
			{steps.map((step) => (
				<line
					key={step.key}
					x1={step.x1}
					y1={step.y1}
					x2={step.x2}
					y2={step.y2}
					stroke={familyColor(step.family)}
					strokeWidth={1.5}
					strokeDasharray="5 5"
					opacity={step.worthWeighing ? 0.6 : 0.12}
				/>
			))}
		</g>
	);
}

/** Touch-sized target around each point's 9px disc. */
const HIT_RADIUS_PX = 12;
const DISC_RADIUS_PX = 9;
const ACTIVE_DISC_RADIUS_PX = 11;
/** Opacity of an option another beats on cost, time and score. */
const BEATEN_OPACITY = 0.25;

function pointLabel({ point, worthWeighing }: ScenePoint, view: BenchmarkView) {
	const { benchmark } = point;
	const measures = `${formatUsd(point.costPerTaskUsd)} per task, ${formatDuration(point.secondsPerTask)} per task, ${view.scoreLabel} ${view.formatScore(point.score)}`;
	const verdict = worthWeighing ? "" : ", beaten on cost, time and score";
	return `${familyName(benchmark.family)}, ${benchmark.effortLabel}, ${measures}${verdict}`;
}

/**
 * One option: a disc carrying its lab's mark, with a line down to the floor
 * so its cost and time read off the grid. Hover or focus previews its
 * details; click, Enter or Space pins them.
 */
export function TradeoffPoint({
	scenePoint,
	active,
	onDetails,
	view,
}: {
	scenePoint: ScenePoint;
	active: boolean;
	onDetails: (event: PointDetailsEvent) => void;
	/** Names and formats the score for screen readers. */
	view: BenchmarkView;
}) {
	const { point, at, floor, worthWeighing } = scenePoint;
	const color = familyColor(point.benchmark.family);
	const radius = active ? ACTIVE_DISC_RADIUS_PX : DISC_RADIUS_PX;
	const logoSize = radius * 1.3;
	const preview = (source: PreviewSource) => () =>
		onDetails({ type: "preview", source, point });
	const endPreview = (source: PreviewSource) => () =>
		onDetails({ type: "endPreview", source, point });
	const pin = () => onDetails({ type: "togglePin", point });
	return (
		<g opacity={worthWeighing || active ? 1 : BEATEN_OPACITY}>
			<line
				x1={at.x}
				y1={at.y}
				x2={floor.x}
				y2={floor.y}
				stroke={color}
				strokeOpacity={0.3}
				pointerEvents="none"
			/>
			<g
				// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- SVG has no native button; the point needs focus to expose its tooltip
				role="button"
				tabIndex={0}
				aria-label={pointLabel(scenePoint, view)}
				className="group cursor-pointer outline-none"
				style={{ color }}
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
				<circle
					cx={at.x}
					cy={at.y}
					r={radius}
					fill="var(--bg)"
					stroke={color}
					strokeWidth={active ? 2 : 1.25}
					className="group-focus-visible:stroke-fg"
				/>
				<ProviderLogo
					lab={familyLabId(point.benchmark.family)}
					x={at.x - logoSize / 2}
					y={at.y - logoSize / 2}
					size={logoSize}
				/>
			</g>
		</g>
	);
}
