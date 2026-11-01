import type { AA_EVAL_IDS } from "./model";

/** The AA Intelligence Index evals, which the chart plots from the AA website. */
export type AaEvalId = (typeof AA_EVAL_IDS)[number];

/** A score's unit: "percent" is a 0-1 fraction shown as points, "index" is as is. */
export type EvalUnit = "percent" | "index";

export const AA_EVAL_UNITS: Record<AaEvalId, EvalUnit> = {
	"aa-briefcase": "index",
	"automationbench-aa": "percent",
	"terminalbench-4-0": "percent",
	"frontiercode-2-0": "percent",
	omniscience: "index",
	"gdp-pdf": "percent",
	"hle-diamond": "percent",
	"critpt-v2-hard": "percent",
	"terminal-bench-science": "percent",
};

const FRACTION_TO_POINTS = 100;
const POINT_DECIMALS = 1e6;

/** An AA website score in the unit its chart shows: percent evals in points. */
export function chartScore(evalId: AaEvalId, score: number): number {
	if (AA_EVAL_UNITS[evalId] === "index") return score;
	return (
		Math.round(score * FRACTION_TO_POINTS * POINT_DECIMALS) / POINT_DECIMALS
	);
}
