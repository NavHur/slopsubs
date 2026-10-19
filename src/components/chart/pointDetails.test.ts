import { describe, expect, it } from "vitest";
import type { BenchmarkPoint, FamilyId } from "#/domain/model";
import type { ValuePoint } from "#/domain/value";
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
	} as BenchmarkPoint;
	return {
		seriesId: `${haiku}@api`,
		benchmark,
		intelligence: 40,
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
		const state = run({ type: "hover", point: low });
		expect(shownDetails(state, points)).toEqual({ point: low, pinned: false });
		expect(shownDetails(run(), points)).toBeNull();
	});

	it("keeps a clicked point's details after the pointer leaves", () => {
		const state = run(
			{ type: "hover", point: low },
			{ type: "togglePin", point: low },
			{ type: "hover", point: null },
		);
		expect(shownDetails(state, points)).toEqual({ point: low, pinned: true });
	});

	it("previews another point over the pin, then returns to it", () => {
		const pinned = run({ type: "togglePin", point: low });
		const previewing = updatePointDetails(pinned, {
			type: "hover",
			point: high,
		});
		expect(shownDetails(previewing, points)).toEqual({
			point: high,
			pinned: false,
		});
		const left = updatePointDetails(previewing, { type: "hover", point: null });
		expect(shownDetails(left, points)?.point).toBe(low);
	});

	it("hides the details when the pinned point is clicked again", () => {
		const state = run(
			{ type: "hover", point: low },
			{ type: "togglePin", point: low },
			{ type: "togglePin", point: low },
		);
		expect(shownDetails(state, points)).toBeNull();
	});

	it("closes pinned and previewed details at once", () => {
		const state = run(
			{ type: "togglePin", point: low },
			{ type: "hover", point: high },
			{ type: "close" },
		);
		expect(shownDetails(state, points)).toBeNull();
	});

	it("holds the pin across a rebuild of every point", () => {
		const state = run({ type: "togglePin", point: low });
		const rebuilt = [point("low"), point("high")];
		expect(shownDetails(state, rebuilt)?.point).toBe(rebuilt[0]);
	});

	it("drops a pin and a preview whose point left the chart", () => {
		const state = run(
			{ type: "togglePin", point: low },
			{ type: "hover", point: low },
			{ type: "prune", points: [high] },
		);
		expect(state).toEqual(NO_DETAILS);
	});

	it("moves a preview onto the rebuilt point and keeps unchanged state", () => {
		const hovered = run({ type: "hover", point: low });
		const rebuilt = [point("low")];
		const pruned = updatePointDetails(hovered, {
			type: "prune",
			points: rebuilt,
		});
		expect(pruned.hovered).toBe(rebuilt[0]);
		expect(updatePointDetails(pruned, { type: "prune", points: rebuilt })).toBe(
			pruned,
		);
	});
});
