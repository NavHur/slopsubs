// Value sets shared by the schemas and the page. Kept here so the page does
// not import the dataset schemas.

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
	"terminalbench-4-1",
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

/** The `by` of a cap read off our own gauge rather than reported by others. */
export const OUR_GAUGE_READINGS = "slopsubs";
