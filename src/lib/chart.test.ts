import { describe, expect, it } from "vitest";
import type { ValuePoint } from "#/domain/value";
import { paretoFrontier, spreadLabels } from "./chart";

function point(seriesId: string, cost: number, score: number) {
	// SAFETY: paretoFrontier reads only cost, score and identity.
	return { seriesId, costPerTaskUsd: cost, score } as ValuePoint;
}

describe("paretoFrontier", () => {
	it("keeps only points no cheaper point matches in score", () => {
		const cheapWeak = point("a", 0.1, 30);
		const dominated = point("b", 0.5, 25);
		const pricierStrong = point("c", 1, 50);
		const pricierSame = point("d", 2, 50);
		expect(
			paretoFrontier([pricierSame, dominated, pricierStrong, cheapWeak]),
		).toEqual([cheapWeak, pricierStrong]);
	});
});

describe("spreadLabels", () => {
	it("pushes colliding labels apart and keeps them in bounds", () => {
		const labels = spreadLabels({
			anchors: [
				{ id: "a", anchorY: 100 },
				{ id: "b", anchorY: 105 },
				{ id: "c", anchorY: 395 },
			],
			gap: 20,
			top: 0,
			bottom: 400,
		});
		expect(labels.map((l) => [l.id, l.y])).toEqual([
			["a", 100],
			["b", 120],
			["c", 395],
		]);
	});

	it("shifts labels up when the bottom edge would push them out", () => {
		const labels = spreadLabels({
			anchors: [
				{ id: "a", anchorY: 395 },
				{ id: "b", anchorY: 398 },
			],
			gap: 20,
			top: 0,
			bottom: 400,
		});
		expect(labels.map((l) => l.y)).toEqual([380, 400]);
	});
});
