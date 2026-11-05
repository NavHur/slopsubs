import { describe, expect, it } from "vite-plus/test";
import { split } from "./scroll-timing.ts";

const nodes = [{ id: 1, callFrame: { functionName: "work" } }];

describe("split", () => {
	it("totals script time from samples and their time deltas", () => {
		const profile = { nodes, samples: [1, 1], timeDeltas: [0, 2000, 3000] };
		expect(split(profile).script).toBe(5);
	});

	it("throws when the profile has no samples", () => {
		expect(() => split({ nodes, timeDeltas: [0] })).toThrow(/samples/);
	});

	it("throws when the profile has no timeDeltas", () => {
		expect(() => split({ nodes, samples: [1] })).toThrow(/timeDeltas/);
	});

	it("throws when timeDeltas is shorter than samples", () => {
		const truncated = { nodes, samples: [1, 1, 1], timeDeltas: [0] };
		expect(() => split(truncated)).toThrow(/timeDeltas/);
	});
});
