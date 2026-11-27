import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import type { downloadChartPng } from "./exportPng";

export class ChartExportError extends Data.TaggedError("ChartExportError")<{
	message: string;
	cause?: unknown;
}> {}

export function exportOperation<A>(
	message: string,
	operation: () => Promise<A>,
) {
	return Effect.tryPromise({
		try: operation,
		catch: (cause) => new ChartExportError({ message, cause }),
	});
}

/** Load the rasterizer only when the visitor asks for a PNG. */
export function exportChartPng(input: Parameters<typeof downloadChartPng>[0]) {
	return exportOperation(
		"Cannot load chart exporter",
		() => import("./exportPng"),
	).pipe(Effect.flatMap((module) => module.downloadChartPng(input)));
}

export type ChartExport = ReturnType<typeof exportChartPng>;
