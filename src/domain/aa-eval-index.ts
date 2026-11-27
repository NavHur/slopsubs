// Each eval's score field. The weight recovers cost per task from AA's weighted
// cost; the task count turns an eval's token total into tokens per task.

import type { EvalRecord } from "./aa-evals";
import type { AaEvalId } from "./eval-units";

/** The score fields of a model record, one or more per eval; the record's own
 * schema types them, so a renamed field fails to compile here. */
type ScoreFields = Pick<
	EvalRecord,
	| "briefcaseBreakdown"
	| "automationBenchPartialScore"
	| "terminalBench41"
	| "frontierCode20"
	| "omniscience"
	| "gdpPdfAllPass"
	| "hleDiamond"
	| "critptAgenticHard"
	| "terminalBenchScience"
>;

type Score = number | null | undefined;

type EvalIndexEntry = {
	/** Reads the eval's score out of a model record. */
	score: (record: ScoreFields) => Score;
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
		score: (r) => r.briefcaseBreakdown?.overall.elo,
		page: "aa-briefcase",
		tokenKey: "briefcase",
		weight: 0.15,
		tasks: 91,
	},
	"automationbench-aa": {
		score: (r) => r.automationBenchPartialScore,
		page: "automationbench-aa",
		tokenKey: "automationBench",
		weight: 0.05,
		tasks: 657,
	},
	"terminalbench-4-1": {
		score: (r) => r.terminalBench41,
		page: "terminalbench-4-1",
		tokenKey: "terminalBench41",
		weight: 0.1,
		tasks: 66,
	},
	"frontiercode-2-0": {
		score: (r) => r.frontierCode20,
		page: "frontiercode-2-0",
		tokenKey: "frontierCode20",
		weight: 0.15,
		tasks: 132,
	},
	omniscience: {
		score: (r) => r.omniscience,
		page: "omniscience",
		tokenKey: "omniscience",
		weight: 0.15,
		tasks: 3000,
	},
	"gdp-pdf": {
		score: (r) => r.gdpPdfAllPass,
		page: "gdp-pdf",
		tokenKey: "gdpPdf",
		weight: 0.05,
		tasks: 100,
	},
	"hle-diamond": {
		score: (r) => r.hleDiamond,
		page: "hle-diamond",
		tokenKey: "hleDiamond",
		weight: 0.1,
		tasks: 1000,
	},
	"critpt-v2-hard": {
		score: (r) => r.critptAgenticHard,
		page: "critpt-v2",
		tokenKey: "critptAgenticHard",
		weight: 0.1,
		tasks: 40,
	},
	"terminal-bench-science": {
		score: (r) => r.terminalBenchScience,
		page: "terminal-bench-science",
		tokenKey: "terminalBenchScience",
		weight: 0.15,
		tasks: 70,
	},
};

/** Whether AA's eval slug is one the importer has a weight for. */
export const isAaEvalId = (slug: string): slug is AaEvalId =>
	Object.hasOwn(AA_EVAL_INDEX, slug);
