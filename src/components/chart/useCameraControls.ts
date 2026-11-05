import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { type Angles, draggedAngles, keyedAngles } from "./projection";

type DragStart = { x: number; y: number; angles: Angles };

/** Turns the camera while a pointer drags across the chart or arrow keys press. */
export function useCameraControls(
	angles: Angles,
	onTurn: (angles: Angles) => void,
) {
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
			onKeyDown(event: KeyboardEvent) {
				const turned = keyedAngles(angles, event.key);
				if (!turned) return;
				event.preventDefault();
				onTurn(turned);
			},
		},
	};
}
