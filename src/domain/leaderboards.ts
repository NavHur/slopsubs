import type { AaEvalRow, BenchmarkPoint, FrontierCodeRow } from "./model";

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

/**
 * AA Intelligence Index eval rows as chart points, named, labelled and priced
 * from the Artificial Analysis catalog. Every row's family must be in the
 * catalog; a null website effort resolves to the family's sole effort, else
 * to its none or default effort, failing loud when ambiguous.
 */
export function evalPoints(
	rows: readonly AaEvalRow[],
	catalog: readonly BenchmarkPoint[],
	evalSlug: string,
): BenchmarkPoint[] {
	const byFamily = new Map<string, BenchmarkPoint[]>();
	for (const m of catalog) {
		const list = byFamily.get(m.family) ?? [];
		list.push(m);
		byFamily.set(m.family, list);
	}
	return rows
		.filter((row) => row.eval === evalSlug)
		.map((row) => {
			const candidates = byFamily.get(row.family);
			if (!candidates) throw new Error(`No catalog model for ${row.family}`);
			let model: BenchmarkPoint | undefined;
			if (row.effort !== null) {
				model = candidates.find((m) => m.effort === row.effort);
				if (!model)
					throw new Error(
						`No catalog effort ${row.effort} for ${row.family} (has ${candidates.map((m) => m.effort).join(", ")})`,
					);
			} else if (candidates.length === 1) {
				model = candidates[0];
			} else {
				model =
					candidates.find((m) => m.effort === "none") ??
					candidates.find((m) => m.effort === "default");
				if (!model)
					throw new Error(
						`Ambiguous null effort for ${row.family} (has ${candidates.map((m) => m.effort).join(", ")})`,
					);
			}
			return {
				...model,
				id: `${row.family}@${model.effort}`,
				effort: model.effort,
				effortLabel: model.effortLabel,
				effortOrder: model.effortOrder,
				score: row.score,
				costPerTaskUsd: row.costPerTaskUsd,
				tokensPerTask: row.tokensPerTask,
				secondsPerTask: row.secondsPerTask,
			};
		});
}
