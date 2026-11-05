import { describe, expect, it } from "vite-plus/test";
import {
	type Angles,
	draggedAngles,
	fitCamera,
	keyedAngles,
	normalizedYaw,
	PITCH_LIMIT_DEG,
	presetAt,
	project,
	projectedLength,
	VIEW_PRESETS,
	type Vec3,
	type Viewport,
} from "./projection";

const VIEWPORT: Viewport = {
	width: 760,
	height: 500,
	padding: { top: 36, right: 100, bottom: 34, left: 56 },
};

/** The floor's corners and the top of the score axis. */
const FRAME: Vec3[] = [
	[-1, -1, 0],
	[-1, 1, 0],
	[1, -1, 0],
	[1, 1, 0],
	[-1, -1, 1.5],
];

const ORIGIN: Vec3 = [-1, -1, 0];
const TIME_END: Vec3 = [1, -1, 0];
const COST_END: Vec3 = [-1, 1, 0];

function cameraAt(angles: Angles) {
	return fitCamera(angles, FRAME, VIEWPORT);
}

describe("fitCamera", () => {
	it.each(Object.entries(VIEW_PRESETS))(
		"fits the frame inside the padded viewport at the %s view",
		(_, angles) => {
			const camera = cameraAt(angles);
			const { padding, width, height } = VIEWPORT;
			const screen = FRAME.map((p) => project(p, camera));
			const xs = screen.map((p) => p.x);
			const ys = screen.map((p) => p.y);
			const eps = 1e-6;
			expect(Math.min(...xs)).toBeGreaterThanOrEqual(padding.left - eps);
			expect(Math.max(...xs)).toBeLessThanOrEqual(width - padding.right + eps);
			expect(Math.min(...ys)).toBeGreaterThanOrEqual(padding.top - eps);
			expect(Math.max(...ys)).toBeLessThanOrEqual(
				height - padding.bottom + eps,
			);
			// As large as fits: the frame reaches across one dimension fully.
			const fillsWidth =
				Math.max(...xs) - Math.min(...xs) >=
				width - padding.left - padding.right - eps;
			const fillsHeight =
				Math.max(...ys) - Math.min(...ys) >=
				height - padding.top - padding.bottom - eps;
			expect(fillsWidth || fillsHeight).toBe(true);
		},
	);
});

describe("project", () => {
	it("flattens the cube into cost against score in the cost-score view", () => {
		const camera = cameraAt(VIEW_PRESETS["cost-score"]);
		const quick = project([-0.5, 0.2, 0.7], camera);
		const slow = project([0.9, 0.2, 0.7], camera);
		expect(slow.x).toBeCloseTo(quick.x);
		expect(slow.y).toBeCloseTo(quick.y);

		const cheap = project([0, -0.5, 0.7], camera);
		const pricey = project([0, 0.5, 0.7], camera);
		expect(pricey.x).toBeGreaterThan(cheap.x);
	});

	it("draws a higher score higher on the screen", () => {
		const camera = cameraAt(VIEW_PRESETS.perspective);
		const weak = project([0, 0, 0.2], camera);
		const strong = project([0, 0, 1.2], camera);
		expect(strong.y).toBeLessThan(weak.y);
	});

	it("brings the top of the cube nearer the viewer looking down on it", () => {
		const camera = cameraAt(VIEW_PRESETS.top);
		const floor = project([0, 0, 0], camera);
		const raised = project([0, 0, 1], camera);
		expect(raised.depth).toBeGreaterThan(floor.depth);
	});
});

describe("projectedLength", () => {
	it("shrinks an axis to nothing when the camera looks straight along it", () => {
		const costScore = cameraAt(VIEW_PRESETS["cost-score"]);
		expect(projectedLength(ORIGIN, TIME_END, costScore)).toBeCloseTo(0);
		expect(projectedLength(ORIGIN, COST_END, costScore)).toBeGreaterThan(100);

		const timeScore = cameraAt(VIEW_PRESETS["time-score"]);
		expect(projectedLength(ORIGIN, COST_END, timeScore)).toBeCloseTo(0);
	});
});

describe("camera controls", () => {
	it("turns with a horizontal drag and tilts with a vertical one", () => {
		const start = VIEW_PRESETS.perspective;
		const turned = draggedAngles(start, 100, 0);
		expect(turned.yaw).toBeCloseTo(start.yaw + 35);
		expect(turned.pitch).toBe(start.pitch);

		const tilted = draggedAngles(start, 0, -40);
		expect(tilted.pitch).toBeCloseTo(start.pitch + 10);
	});

	it("stops tilting at the pitch limit", () => {
		const start = VIEW_PRESETS.perspective;
		expect(draggedAngles(start, 0, -10_000).pitch).toBe(PITCH_LIMIT_DEG);
		expect(draggedAngles(start, 0, 10_000).pitch).toBe(-PITCH_LIMIT_DEG);
		expect(keyedAngles(VIEW_PRESETS.top, "ArrowUp")?.pitch).toBe(
			PITCH_LIMIT_DEG,
		);
	});

	it("turns and tilts with the arrow keys, ignoring other keys", () => {
		const start = VIEW_PRESETS.perspective;
		expect(keyedAngles(start, "ArrowRight")).toEqual({
			yaw: start.yaw + 8,
			pitch: start.pitch,
		});
		expect(keyedAngles(start, "ArrowDown")).toEqual({
			yaw: start.yaw,
			pitch: start.pitch - 5,
		});
		expect(keyedAngles(start, "Enter")).toBeNull();
	});

	it("recognises a preset again after a full turn", () => {
		const start = VIEW_PRESETS["cost-score"];
		const fullTurn = 360 / 0.35;
		const back = draggedAngles(start, fullTurn, 0);
		expect(presetAt({ ...back, yaw: Math.round(back.yaw) })).toBe("cost-score");
		expect(presetAt(draggedAngles(start, 10, 0))).toBeNull();
	});
});

describe("normalizedYaw", () => {
	it("keeps yaw within a half turn either way", () => {
		expect(normalizedYaw(-70)).toBe(-70);
		expect(normalizedYaw(290)).toBe(-70);
		expect(normalizedYaw(-430)).toBe(-70);
		expect(normalizedYaw(180)).toBe(180);
		expect(normalizedYaw(-180)).toBe(180);
	});
});
