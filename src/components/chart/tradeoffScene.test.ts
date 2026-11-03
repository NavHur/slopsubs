import { describe, expect, it } from "vite-plus/test";
import type { TimedPoint } from "#/domain/tradeoffs";
import { VIEW_PRESETS } from "./projection";
import { tradeoffScene, tradeoffViewport } from "./tradeoffScene";

function point(
	series: string,
	effortOrder: number,
	[cost, seconds, score]: [number, number, number],
): TimedPoint {
	// SAFETY: the scene reads only the series, the effort and the three measures.
	return {
		seriesId: series,
		benchmark: { id: `${series}-${effortOrder}`, effortOrder },
		costPerTaskUsd: cost,
		secondsPerTask: seconds,
		score,
	} as unknown as TimedPoint;
}

const low = point("opus@api", 1, [0.05, 120, 30]);
const high = point("opus@api", 2, [0.4, 900, 48]);
const cheap = point("haiku@api", 1, [0.01, 60, 20]);
// Pricier, slower and weaker than `low`.
const beaten = point("haiku@api", 2, [0.1, 300, 25]);
const POINTS = [high, beaten, low, cheap] as const;

const VIEWPORT = tradeoffViewport(760);

describe("tradeoffViewport", () => {
	it("keeps the plot between its shortest and tallest height", () => {
		expect(tradeoffViewport(320).height).toBe(300);
		expect(tradeoffViewport(800).height).toBe(496);
		expect(tradeoffViewport(1200).height).toBe(620);
	});
});

describe("tradeoffScene", () => {
	const scene = tradeoffScene(POINTS, VIEW_PRESETS.perspective, VIEWPORT);

	it("lists the points from back to front", () => {
		const depths = scene.points.map((p) => p.at.depth);
		expect(depths).toEqual([...depths].sort((a, b) => a - b));
		expect(scene.points).toHaveLength(POINTS.length);
	});

	it("fades a point another beats on cost, time and score", () => {
		const fading = scene.points.filter((p) => !p.worthWeighing);
		expect(fading.map((p) => p.point)).toEqual([beaten]);
		expect(scene.worthWeighing).toBe(3);
	});

	it("drops each point's line straight down to the floor below it", () => {
		const raised = scene.points.find((p) => p.point === high);
		expect(raised?.floor.y).toBeGreaterThan(raised?.at.y ?? Infinity);
	});

	it("joins each model's efforts in order and fades a step to a beaten one", () => {
		expect(scene.efforts.map((e) => [e.seriesId, e.worthWeighing])).toEqual(
			expect.arrayContaining([
				["opus@api", true],
				["haiku@api", false],
			]),
		);
		expect(scene.efforts).toHaveLength(2);
		const opus = scene.points.filter((p) => p.point.seriesId === "opus@api");
		const step = scene.efforts.find((e) => e.seriesId === "opus@api");
		const lowAt = opus.find((p) => p.point === low)?.at;
		expect([step?.x1, step?.y1]).toEqual([lowAt?.x, lowAt?.y]);
	});

	it("labels all three axes from the default angle", () => {
		expect(Object.keys(scene.axisTitles).sort()).toEqual([
			"cost",
			"minutes",
			"score",
		]);
		expect(scene.tickLabels.map((t) => t.text)).toContain("$0.01");
	});

	it("hides the labels of an axis seen end-on", () => {
		const side = tradeoffScene(POINTS, VIEW_PRESETS["cost-score"], VIEWPORT);
		expect(Object.keys(side.axisTitles).sort()).toEqual(["cost", "score"]);
		expect(side.tickLabels.some((t) => t.key.startsWith("minutes-"))).toBe(
			false,
		);
	});

	it.each(Object.entries(VIEW_PRESETS))(
		"keeps every point inside the plot at the %s view",
		(_, angles) => {
			// The priciest, slowest and smartest point sits over the far corner.
			const { points } = tradeoffScene(POINTS, angles, VIEWPORT);
			const { width, height, padding } = VIEWPORT;
			const eps = 1e-6;
			for (const { at } of points) {
				expect(at.x).toBeGreaterThanOrEqual(padding.left - eps);
				expect(at.x).toBeLessThanOrEqual(width - padding.right + eps);
				expect(at.y).toBeGreaterThanOrEqual(padding.top - eps);
				expect(at.y).toBeLessThanOrEqual(height - padding.bottom + eps);
			}
		},
	);
});
