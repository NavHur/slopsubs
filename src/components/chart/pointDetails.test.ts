import { describe, expect, it } from "vite-plus/test";
import type { FamilyId } from "#/domain/model";
import type { PlottableBenchmark, ValuePoint } from "#/domain/value";
import {
	NO_DETAILS,
	type PointDetails,
	type PointDetailsEvent,
	shownDetails,
	updatePointDetails,
} from "./pointDetails";

const haiku = "claude-haiku-5-5" as FamilyId;

/** A fresh point object each call, as every chart rebuild makes. */
function point(effort: string): ValuePoint {
	const benchmark = {
		id: `${haiku}-${effort}`,
		family: haiku,
	} as PlottableBenchmark;
	return {
		seriesId: `${haiku}@api`,
		benchmark,
		score: 40,
		costPerTaskUsd: 1,
		pricing: { kind: "api" },
	};
}

const run = (...events: PointDetailsEvent[]): PointDetails =>
	events.reduce(updatePointDetails, NO_DETAILS);

describe("point details", () => {
	const low = point("low");
	const high = point("high");
	const points = [low, high];

	it("previews a hovered point without pinning it", () => {
		const state = run({ type: "preview", source: "hover", point: low });
		expect(shownDetails(state, points)).toEqual({ point: low, pinned: false });
		expect(shownDetails(run(), points)).toBeNull();
	});

	it("keeps a clicked point's details after the pointer leaves", () => {
		const state = run(
			{ type: "preview", source: "hover", point: low },
			{ type: "togglePin", point: low },
			{ type: "endPreview", source: "hover", point: low },
		);
		expect(shownDetails(state, points)).toEqual({ point: low, pinned: true });
	});

	it("previews another point over the pin, then returns to it", () => {
		const pinned = run({ type: "togglePin", point: low });
		const previewing = updatePointDetails(pinned, {
			type: "preview",
			source: "hover",
			point: high,
		});
		expect(shownDetails(previewing, points)).toEqual({
			point: high,
			pinned: false,
		});
		const left = updatePointDetails(previewing, {
			type: "endPreview",
			source: "hover",
			point: high,
		});
		expect(shownDetails(left, points)?.point).toBe(low);
	});

	it("keeps the focused point's details when the pointer leaves another", () => {
		const state = run(
			{ type: "preview", source: "focus", point: low },
			{ type: "preview", source: "hover", point: high },
			{ type: "endPreview", source: "hover", point: high },
		);
		expect(shownDetails(state, points)).toEqual({ point: low, pinned: false });
	});

	it("keeps the hovered point's details when focus leaves another", () => {
		const state = run(
			{ type: "preview", source: "hover", point: high },
			{ type: "preview", source: "focus", point: low },
			{ type: "endPreview", source: "focus", point: low },
		);
		expect(shownDetails(state, points)).toEqual({ point: high, pinned: false });
	});

	it("previews the hovered point over the focused one", () => {
		const state = run(
			{ type: "preview", source: "focus", point: low },
			{ type: "preview", source: "hover", point: high },
		);
		expect(shownDetails(state, points)?.point).toBe(high);
	});

	it("ignores a leave from a point the source already moved off", () => {
		const state = run(
			{ type: "preview", source: "hover", point: low },
			{ type: "preview", source: "hover", point: high },
			{ type: "endPreview", source: "hover", point: low },
		);
		expect(shownDetails(state, points)?.point).toBe(high);
	});

	it("hides the details when the pinned point is clicked again", () => {
		const state = run(
			{ type: "preview", source: "hover", point: low },
			{ type: "togglePin", point: low },
			{ type: "togglePin", point: low },
		);
		expect(shownDetails(state, points)).toBeNull();
	});

	it("closes pinned and previewed details at once", () => {
		const state = run(
			{ type: "togglePin", point: low },
			{ type: "preview", source: "hover", point: high },
			{ type: "preview", source: "focus", point: high },
			{ type: "close" },
		);
		expect(shownDetails(state, points)).toBeNull();
	});

	it("holds the pin across a rebuild of every point", () => {
		const state = run({ type: "togglePin", point: low });
		const rebuilt = [point("low"), point("high")];
		expect(shownDetails(state, rebuilt)?.point).toBe(rebuilt[0]);
	});

	it("drops a pin and previews whose point left the chart", () => {
		const state = run(
			{ type: "togglePin", point: low },
			{ type: "preview", source: "hover", point: low },
			{ type: "preview", source: "focus", point: low },
			{ type: "prune", points: [high] },
		);
		expect(shownDetails(state, [high])).toBeNull();
		// The dropped pin stays gone when its point returns.
		expect(shownDetails(state, [low, high])).toBeNull();
	});

	it("moves a preview onto the rebuilt point and keeps unchanged state", () => {
		const hovered = run({ type: "preview", source: "hover", point: low });
		const rebuilt = [point("low")];
		const pruned = updatePointDetails(hovered, {
			type: "prune",
			points: rebuilt,
		});
		expect(shownDetails(pruned, rebuilt)?.point).toBe(rebuilt[0]);
		expect(updatePointDetails(pruned, { type: "prune", points: rebuilt })).toBe(
			pruned,
		);
	});
});
