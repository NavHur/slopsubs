// The fixed value sets the schemas and the page share. Kept free of zod so the
// client can import them without bundling the schemas.

export const EFFORTS = [
	"none",
	"minimal",
	"low",
	"medium",
	"default",
	"high",
	"xhigh",
	"max",
] as const;

/** The Intelligence Index evals the chart plots from the AA website. */
export const AA_EVAL_IDS = [
	"aa-briefcase",
	"automationbench-aa",
	"terminalbench-4-0",
	"frontiercode-2-0",
	"omniscience",
	"gdp-pdf",
	"hle-diamond",
	"critpt-v2-hard",
	"terminal-bench-science",
] as const;

/** The benchmarks the chart can plot, in tab order. */
export const BENCHMARK_IDS = [
	"intelligence",
	"frontiercode",
	...AA_EVAL_IDS,
] as const;
export type BenchmarkId = (typeof BENCHMARK_IDS)[number];
