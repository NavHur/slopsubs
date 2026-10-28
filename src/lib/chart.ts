import type { ValuePoint } from "#/domain/value";

/** Points no other point beats on both cost (lower) and score (higher). */
export function paretoFrontier(points: readonly ValuePoint[]): ValuePoint[] {
	const byCost = [...points].sort(
		(a, b) => a.costPerTaskUsd - b.costPerTaskUsd || b.score - a.score,
	);
	let best = Number.NEGATIVE_INFINITY;
	return byCost.filter((p) => {
		if (p.score <= best) return false;
		best = p.score;
		return true;
	});
}

export type LineLabel = { id: string; anchorY: number; y: number };

/**
 * Spreads end-of-line labels vertically so none sit closer than `gap`,
 * keeping each as near its line's anchor as the bounds allow.
 */
export function spreadLabels({
	anchors,
	gap,
	top,
	bottom,
}: {
	anchors: readonly { id: string; anchorY: number }[];
	gap: number;
	top: number;
	bottom: number;
}): LineLabel[] {
	const sorted = [...anchors].sort((a, b) => a.anchorY - b.anchorY);
	const placed = sorted.map((a) => ({ ...a, y: a.anchorY }));
	for (let i = 0; i < placed.length; i++) {
		const floor = i === 0 ? top : placed[i - 1].y + gap;
		placed[i].y = Math.max(placed[i].y, floor);
	}
	for (let i = placed.length - 1; i >= 0; i--) {
		const ceiling = i === placed.length - 1 ? bottom : placed[i + 1].y - gap;
		placed[i].y = Math.min(placed[i].y, ceiling);
	}
	return placed;
}
