// How each Intelligence Index eval enters AA's index. AA's pages carry weighted
// figures and total token counts; these let the importer turn them into the
// raw cost and tokens per task. The weights and task counts come from AA's
// Intelligence Index methodology, verified on 2026-11-20 against Claude
// Sonnet 5.5 (max); the importer's cross-checks fail when they stop adding up.

import type { AaEvalId } from "./eval-units";

type EvalIndexEntry = {
	/** The eval's page on AA: `/evaluations/<page>`. */
	page: string;
	/** The eval's key in a record's `canonicalEvalTokenCounts`. */
	tokenKey: string;
	/** The share of the index the eval carries; the weights sum to 1. */
	weight: number;
	/** The number of tasks the eval's token counts add up over. */
	tasks: number;
};

export const AA_EVAL_INDEX: Record<AaEvalId, EvalIndexEntry> = {
	"aa-briefcase": {
		page: "aa-briefcase",
		tokenKey: "briefcase",
		weight: 0.15,
		tasks: 91,
	},
	"automationbench-aa": {
		page: "automationbench-aa",
		tokenKey: "automationBench",
		weight: 0.05,
		tasks: 657,
	},
	"terminalbench-4-0": {
		page: "terminalbench-4-0",
		tokenKey: "terminalBench40",
		weight: 0.1,
		tasks: 66,
	},
	"frontiercode-2-0": {
		page: "frontiercode-2-0",
		tokenKey: "frontierCode20",
		weight: 0.15,
		tasks: 132,
	},
	omniscience: {
		page: "omniscience",
		tokenKey: "omniscience",
		weight: 0.15,
		tasks: 3000,
	},
	"gdp-pdf": {
		page: "gdp-pdf",
		tokenKey: "gdpPdf",
		weight: 0.05,
		tasks: 100,
	},
	"hle-diamond": {
		page: "hle-diamond",
		tokenKey: "hleDiamond",
		weight: 0.1,
		tasks: 1000,
	},
	"critpt-v2-hard": {
		page: "critpt-v2",
		tokenKey: "critptAgenticHard",
		weight: 0.1,
		tasks: 40,
	},
	"terminal-bench-science": {
		page: "terminal-bench-science",
		tokenKey: "terminalBenchScience",
		weight: 0.15,
		tasks: 70,
	},
};
