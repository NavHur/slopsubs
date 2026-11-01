// Reads the imported catalog, shared by the importers that file rows under it.

import { readFile } from "node:fs/promises";
import { BenchmarkDataset, type BenchmarkPoint } from "../src/domain/model.ts";

/** The catalog's models grouped by family. */
export async function loadCatalogByFamily(
	root: URL,
): Promise<Map<string, BenchmarkPoint[]>> {
	const catalog = BenchmarkDataset.parse(
		JSON.parse(
			await readFile(new URL("src/data/benchmarks.json", root), "utf8"),
		),
	);
	const byFamily = new Map<string, BenchmarkPoint[]>();
	for (const m of catalog.models)
		byFamily.set(m.family, [...(byFamily.get(m.family) ?? []), m]);
	return byFamily;
}
