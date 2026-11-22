// Reads the imported catalog, shared by the importers that file rows under it.

import { Effect } from "effect";
import { BenchmarkDataset, type BenchmarkPoint } from "../src/domain/model.ts";
import { readJsonFile } from "./effects/files.ts";

/** The catalog's models grouped by family. */
export function loadCatalogByFamily(root: URL) {
	return Effect.gen(function* () {
		const { models } = yield* readJsonFile(
			BenchmarkDataset,
			new URL("src/data/benchmarks.json", root),
		);
		const byFamily = new Map<string, BenchmarkPoint[]>();
		for (const model of models) {
			const family = byFamily.get(model.family);
			if (family) family.push(model);
			else byFamily.set(model.family, [model]);
		}
		return byFamily;
	});
}
