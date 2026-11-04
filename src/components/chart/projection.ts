/**
 * The trade-off chart's camera: turns a point in the plot's cube into a
 * point on the SVG, for any yaw and pitch. An orthographic projection, so
 * parallel gridlines stay parallel and a turn never distorts a distance
 * along the screen.
 */

/** A point in plot space: x and y span -1..1 across the floor, z rises from
 * the floor at 0. */
export type Vec3 = readonly [x: number, y: number, z: number];

/** The camera's direction, in degrees. Yaw turns the floor about the
 * vertical axis; pitch tilts the view above (positive) or below the floor. */
export type Angles = { yaw: number; pitch: number };

/** Steepest tilt either way; at 90 the floor would collapse to a line. */
export const PITCH_LIMIT_DEG = 80;

const DEFAULT_ANGLES: Angles = { yaw: -70, pitch: 24 };

/**
 * Named camera angles. The default turns the floor so cost runs nearly along
 * the screen and time recedes into depth; the two side views flatten the
 * cube into a familiar two-axis chart.
 */
export const VIEW_PRESETS = {
	perspective: DEFAULT_ANGLES,
	"cost-score": { yaw: -90, pitch: 0 },
	"time-score": { yaw: 0, pitch: 0 },
	top: { yaw: DEFAULT_ANGLES.yaw, pitch: PITCH_LIMIT_DEG },
	under: { yaw: DEFAULT_ANGLES.yaw, pitch: -PITCH_LIMIT_DEG },
} as const satisfies Record<string, Angles>;
export type ViewPreset = keyof typeof VIEW_PRESETS;

const VIEW_PRESET_NAMES = Object.keys(VIEW_PRESETS) as ViewPreset[];

/** The preset the camera sits at, or null once a drag has left them all. */
export function presetAt(angles: Angles): ViewPreset | null {
	const yaw = normalizedYaw(angles.yaw);
	return (
		VIEW_PRESET_NAMES.find(
			(name) =>
				VIEW_PRESETS[name].yaw === yaw &&
				VIEW_PRESETS[name].pitch === angles.pitch,
		) ?? null
	);
}

const FULL_TURN_DEG = 360;
const HALF_TURN_DEG = 180;

/** The same direction as `yaw`, within -180 (exclusive) to 180 degrees. */
export function normalizedYaw(yaw: number): number {
	const turned =
		(((yaw + HALF_TURN_DEG) % FULL_TURN_DEG) + FULL_TURN_DEG) % FULL_TURN_DEG;
	return turned === 0 ? HALF_TURN_DEG : turned - HALF_TURN_DEG;
}

function clampedPitch(pitch: number): number {
	return Math.max(-PITCH_LIMIT_DEG, Math.min(PITCH_LIMIT_DEG, pitch));
}

/** Degrees the camera turns for each pixel a drag moves across or down. */
const YAW_DEG_PER_PX = 0.35;
const PITCH_DEG_PER_PX = 0.25;

/** Where a drag that started at `start` has turned the camera after moving
 * the pointer by (dx, dy) pixels: right turns the floor, down tilts it away. */
export function draggedAngles(start: Angles, dx: number, dy: number): Angles {
	return {
		yaw: normalizedYaw(start.yaw + dx * YAW_DEG_PER_PX),
		pitch: clampedPitch(start.pitch - dy * PITCH_DEG_PER_PX),
	};
}

/** Degrees one arrow key press turns or tilts the camera. */
const KEY_YAW_STEP_DEG = 8;
const KEY_PITCH_STEP_DEG = 5;

const KEY_TURNS: Record<string, { yaw: number; pitch: number }> = {
	ArrowLeft: { yaw: -KEY_YAW_STEP_DEG, pitch: 0 },
	ArrowRight: { yaw: KEY_YAW_STEP_DEG, pitch: 0 },
	ArrowUp: { yaw: 0, pitch: KEY_PITCH_STEP_DEG },
	ArrowDown: { yaw: 0, pitch: -KEY_PITCH_STEP_DEG },
};

/** The camera after an arrow key press, or null for any other key. */
export function keyedAngles(angles: Angles, key: string): Angles | null {
	const turn = KEY_TURNS[key];
	if (!turn) return null;
	return {
		yaw: normalizedYaw(angles.yaw + turn.yaw),
		pitch: clampedPitch(angles.pitch + turn.pitch),
	};
}

/** A plot-space point turned to face the camera: screen right, screen up,
 * and toward the viewer. */
type Rotated = { horizontal: number; vertical: number; depth: number };

const RADIANS_PER_DEGREE = Math.PI / HALF_TURN_DEG;

function rotate([x, y, z]: Vec3, { yaw, pitch }: Angles): Rotated {
	const yawRad = yaw * RADIANS_PER_DEGREE;
	const pitchRad = pitch * RADIANS_PER_DEGREE;
	const turnedX = x * Math.cos(yawRad) - y * Math.sin(yawRad);
	const turnedY = x * Math.sin(yawRad) + y * Math.cos(yawRad);
	return {
		horizontal: turnedX,
		vertical: z * Math.cos(pitchRad) - turnedY * Math.sin(pitchRad),
		depth: z * Math.sin(pitchRad) + turnedY * Math.cos(pitchRad),
	};
}

/** The SVG area the plot fits into, and the room kept clear around it for
 * tick labels and axis titles (px). */
export type Viewport = {
	width: number;
	height: number;
	padding: { top: number; right: number; bottom: number; left: number };
};

/** A camera fitted to a viewport: its angles, the pixels per plot unit, and
 * the screen position of the plot-space origin. */
export type Camera = Angles & { scale: number; x: number; y: number };

/**
 * Fits `anchors` (the cube's frame and every point) into the viewport's
 * padded area at these angles, as large as fits and centred, so each angle
 * fills the chart.
 */
export function fitCamera(
	angles: Angles,
	anchors: readonly Vec3[],
	{ width, height, padding }: Viewport,
): Camera {
	const turned = anchors.map((anchor) => rotate(anchor, angles));
	const horizontal = turned.map((p) => p.horizontal);
	const vertical = turned.map((p) => p.vertical);
	const left = Math.min(...horizontal);
	const right = Math.max(...horizontal);
	const bottom = Math.min(...vertical);
	const top = Math.max(...vertical);
	const plotWidth = width - padding.left - padding.right;
	const plotHeight = height - padding.top - padding.bottom;
	const scale = Math.min(
		plotWidth / (right - left || 1),
		plotHeight / (top - bottom || 1),
	);
	return {
		...angles,
		scale,
		x: padding.left + (plotWidth - (right - left) * scale) / 2 - left * scale,
		y: padding.top + (plotHeight - (top - bottom) * scale) / 2 + top * scale,
	};
}

/** A plot-space point on the SVG; a larger depth sits nearer the viewer. */
export type Projected = { x: number; y: number; depth: number };

export function project(point: Vec3, camera: Camera): Projected {
	const { horizontal, vertical, depth } = rotate(point, camera);
	return {
		x: camera.x + horizontal * camera.scale,
		y: camera.y - vertical * camera.scale,
		depth,
	};
}

/** On-screen length of the segment from `a` to `b`, in pixels. It shrinks as
 * the camera turns the segment toward the viewer. */
export function projectedLength(a: Vec3, b: Vec3, camera: Camera): number {
	const start = project(a, camera);
	const end = project(b, camera);
	return Math.hypot(end.x - start.x, end.y - start.y);
}
