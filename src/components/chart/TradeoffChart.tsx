import {
	type KeyboardEvent,
	type PointerEvent,
	useMemo,
	useRef,
	useState,
} from "react";
import type { TimedPoint } from "#/domain/tradeoffs";
import type { BenchmarkView } from "#/lib/benchmarks";
import { useElementSize } from "#/lib/useElementSize";
import { usePointDetails } from "./pointDetails";
import { PointTooltip } from "./PointTooltip";
import { type Angles, draggedAngles, keyedAngles } from "./projection";
import { EffortLines, SceneFrame, TradeoffPoint } from "./TradeoffParts";
import { tradeoffScene, tradeoffViewport } from "./tradeoffScene";

type DragStart = { x: number; y: number; angles: Angles };

/** Turns the camera while a pointer drags across the chart. */
function useCameraDrag(angles: Angles, onTurn: (angles: Angles) => void) {
	const start = useRef<DragStart | null>(null);
	const [dragging, setDragging] = useState(false);
	const stop = () => {
		start.current = null;
		setDragging(false);
	};
	return {
		dragging,
		handlers: {
			onPointerDown(event: PointerEvent<SVGSVGElement>) {
				if (event.button !== 0) return;
				event.currentTarget.setPointerCapture(event.pointerId);
				start.current = { x: event.clientX, y: event.clientY, angles };
				setDragging(true);
			},
			onPointerMove(event: PointerEvent<SVGSVGElement>) {
				const from = start.current;
				if (!from) return;
				const dx = event.clientX - from.x;
				const dy = event.clientY - from.y;
				onTurn(draggedAngles(from.angles, dx, dy));
			},
			onPointerUp: stop,
			onPointerCancel: stop,
		},
	};
}

/**
 * Every option's cost, time and score in one turnable cube. Options another
 * beats on all three fade, so the ones worth weighing stand out. Drag or use
 * the arrow keys to turn it; the camera's angles belong to the caller, so the
 * view presets and the PNG export share them.
 */
export function TradeoffChart({
	points,
	angles,
	onAnglesChange,
	view,
}: {
	points: readonly [TimedPoint, ...TimedPoint[]];
	angles: Angles;
	onAnglesChange: (angles: Angles) => void;
	/** The benchmark the points score on. */
	view: BenchmarkView;
}) {
	const [ref, { width }] = useElementSize<HTMLDivElement>();
	const viewport = tradeoffViewport(width);
	const scene = useMemo(
		() => tradeoffScene(points, angles, tradeoffViewport(width)),
		[points, angles, width],
	);
	const [details, dispatch] = usePointDetails(points);
	const shown = details && scene.points.find((p) => p.point === details.point);
	const drag = useCameraDrag(angles, onAnglesChange);
	const turnWithKeys = (event: KeyboardEvent) => {
		const turned = keyedAngles(angles, event.key);
		if (!turned) return;
		event.preventDefault();
		onAnglesChange(turned);
	};
	return (
		<div ref={ref} data-chart-width={width} className="relative">
			{/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- dragging or arrow keys turn the chart; its points stay buttons, which role=application would hide from browse mode */}
			<svg
				width={width}
				height={viewport.height}
				// oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- an SVG root cannot be a fieldset; role=img would hide the buttons inside
				role="group"
				aria-roledescription="3D chart"
				aria-label={`Cost, time and ${view.scoreLabel} per task. Arrow keys turn the chart.`}
				// oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the chart turns with the arrow keys, so it takes focus
				tabIndex={0}
				onKeyDown={turnWithKeys}
				{...drag.handlers}
				className={`block touch-pan-y select-none outline-none focus-visible:outline-1 focus-visible:outline-line ${drag.dragging ? "cursor-grabbing" : "cursor-grab"}`}
			>
				<SceneFrame scene={scene} view={view} />
				<EffortLines steps={scene.efforts} />
				{scene.points.map((p) => (
					<TradeoffPoint
						key={`${p.point.seriesId}/${p.point.benchmark.id}`}
						scenePoint={p}
						active={p === shown}
						onDetails={dispatch}
						view={view}
					/>
				))}
			</svg>
			{details && shown && (
				<PointTooltip
					point={details.point}
					anchor={shown.at}
					bounds={viewport}
					pinned={details.pinned}
					onClose={() => dispatch({ type: "close" })}
					view={view}
				/>
			)}
		</div>
	);
}
