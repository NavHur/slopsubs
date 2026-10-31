import type { BenchmarkPoint, FrontierCodeRow } from "./model";

/**
 * FrontierCode rows as chart points, named, labelled and priced from the
 * Artificial Analysis catalog. Every row's family must be in the catalog.
 */
export function frontierCodePoints(
	rows: readonly FrontierCodeRow[],
	catalog: readonly BenchmarkPoint[],
): BenchmarkPoint[] {
	const modelOf = new Map(catalog.map((m) => [m.family, m] as const));
	const effortOf = new Map(catalog.map((m) => [m.effort, m] as const));
	return rows.map((row) => {
		const model = modelOf.get(row.family);
		const effort = effortOf.get(row.effort);
		if (!model) throw new Error(`No catalog model for ${row.family}`);
		if (!effort) throw new Error(`No catalog label for effort ${row.effort}`);
		return {
			...model,
			id: `${row.family}@${row.effort}`,
			effort: row.effort,
			effortLabel: effort.effortLabel,
			effortOrder: effort.effortOrder,
			score: row.score,
			costPerTaskUsd: row.costPerTaskUsd,
			tokensPerTask: row.tokensPerTask,
			// The catalog's time is its own benchmark's; FrontierCode reports none.
			secondsPerTask: null,
		};
	});
}
