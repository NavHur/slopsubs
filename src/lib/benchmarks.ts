import { AA_EVAL_UNITS, type AaEvalId } from "#/domain/eval-units";
import type { BenchmarkId, BenchmarkPoint } from "#/domain/model";
import { formatIntelligence, formatPercent } from "./format";

type Link = { name: string; url: string };

/** How the chart titles, reads and credits one benchmark. */
export type BenchmarkView = {
	id: BenchmarkId;
	tabLabel: string;
	chartTitle: string;
	/** The y axis, whose ticks are bare numbers, so it names the unit. */
	axisLabel: string;
	/** The score beside its formatted value, in a point's details. */
	scoreLabel: string;
	formatScore: (score: number) => string;
	/** What a point's token count measures, in its details. */
	tokensLabel: string;
	/** Who publishes the scores. */
	source: Link;
	/** The source page behind one point's figures. */
	pointSource: (point: BenchmarkPoint) => Link;
};

const ARTIFICIAL_ANALYSIS = {
	name: "Artificial Analysis",
	url: "https://artificialanalysis.ai",
};
const COGNITION = {
	name: "Cognition",
	url: "https://cognition.com/frontiercode",
};

/** An Intelligence Index eval as a chart tab, scored on the AA website. */
function aaEval(
	id: AaEvalId,
	tabLabel: string,
	scoreLabel: string,
): BenchmarkView {
	const percent = AA_EVAL_UNITS[id] === "percent";
	return {
		id,
		tabLabel,
		chartTitle: `Effective cost vs ${tabLabel}`,
		axisLabel: percent ? `${scoreLabel} (%)` : scoreLabel,
		scoreLabel,
		formatScore: percent ? formatPercent : formatIntelligence,
		tokensLabel: "Output tokens per task",
		source: ARTIFICIAL_ANALYSIS,
		pointSource: () => ARTIFICIAL_ANALYSIS,
	};
}

export const BENCHMARK_VIEWS: Record<BenchmarkId, BenchmarkView> = {
	intelligence: {
		id: "intelligence",
		tabLabel: "Intelligence Index",
		chartTitle: "Effective cost vs intelligence",
		axisLabel: "Intelligence index",
		scoreLabel: "Intelligence index",
		formatScore: formatIntelligence,
		tokensLabel: "Tokens per task",
		source: ARTIFICIAL_ANALYSIS,
		pointSource: (point) => ({
			name: ARTIFICIAL_ANALYSIS.name,
			url: `${ARTIFICIAL_ANALYSIS.url}/models/${point.id}`,
		}),
	},
	frontiercode: {
		id: "frontiercode",
		tabLabel: "FrontierCode 2.0",
		chartTitle: "Effective cost vs FrontierCode 2.0",
		axisLabel: "FrontierCode score (%)",
		scoreLabel: "FrontierCode score",
		formatScore: formatPercent,
		tokensLabel: "Output tokens per task",
		source: COGNITION,
		pointSource: () => ({ name: "FrontierCode 2.0", url: COGNITION.url }),
	},
	"aa-briefcase": aaEval("aa-briefcase", "AA Briefcase", "AA Briefcase"),
	"automationbench-aa": aaEval(
		"automationbench-aa",
		"AutomationBench",
		"AutomationBench score",
	),
	"terminalbench-4-0": aaEval(
		"terminalbench-4-0",
		"Terminal-Bench 4.0",
		"Terminal-Bench 4.0 score",
	),
	"frontiercode-2-0": aaEval(
		"frontiercode-2-0",
		"FrontierCode 2.0 (AA)",
		"FrontierCode 2.0 score",
	),
	omniscience: aaEval("omniscience", "Omniscience", "Omniscience"),
	"gdp-pdf": aaEval("gdp-pdf", "GDP.pdf", "GDP.pdf score"),
	"hle-diamond": aaEval("hle-diamond", "HLE Diamond", "HLE Diamond score"),
	"critpt-v2-hard": aaEval(
		"critpt-v2-hard",
		"CritPt v2 Hard",
		"CritPt v2 Hard score",
	),
	"terminal-bench-science": aaEval(
		"terminal-bench-science",
		"Terminal-Bench Science",
		"Terminal-Bench Science score",
	),
};
