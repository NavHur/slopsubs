// Each Intelligence Index eval's score field, and the weight and task count that
// turn AA's weighted figures raw (AA methodology, checked 2026-11-20 on Sonnet 5.5).

import type { AaEvalId } from "./eval-units";

type Score = number | null | undefined;

/** The score fields of a model record, one or more per eval. */
type ScoreFields = {
	briefcaseBreakdown?: { overall: { elo: number } } | null;
	automationBenchPartialScore?: Score;
	terminalBench40?: Score;
	frontierCode20?: Score;
	omniscience?: Score;
	gdpPdfAllPass?: Score;
	hleDiamond?: Score;
	critptAgenticHard?: Score;
	terminalBenchScience?: Score;
};

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
	"terminalbench-4-0": {
		score: (r) => r.terminalBench40,
		page: "terminalbench-4-0",
		tokenKey: "terminalBench40",
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
