import type { BenchmarkPoint, LeaderboardId } from "#/domain/model";
import { formatIntelligence, formatPercent } from "./format";

type Link = { name: string; url: string };

/** How the chart titles, reads and credits one benchmark. */
export type BenchmarkView = {
	id: LeaderboardId;
	tabLabel: string;
	chartTitle: string;
	/** The y axis, whose ticks are bare numbers, so it names the unit. */
	axisLabel: string;
	/** The score beside its formatted value, in a point's details. */
	scoreLabel: string;
	formatScore: (score: number) => string;
	/** What a point's token count measures, in its details. */
	tokensLabel: string;
	/** Who publishes the scores, and who we fetch them from if not them. */
	source: Link;
	via?: Link;
	/** The source page behind one point's figures. */
	pointSource: (point: BenchmarkPoint) => Link;
};

const ARTIFICIAL_ANALYSIS = {
	name: "Artificial Analysis",
	url: "https://artificialanalysis.ai",
};
const SLOPALYTICS = { name: "Slopalytics", url: "https://slopalytics.com" };
const COGNITION = {
	name: "Cognition",
	url: "https://cognition.com/frontiercode",
};

export const BENCHMARK_VIEWS: Record<LeaderboardId, BenchmarkView> = {
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
		via: {
			name: "Priors",
			url: "https://mypriors.com/benchmarks/frontiercode-2.0-main",
		},
		pointSource: () => ({ name: "FrontierCode 2.0", url: COGNITION.url }),
	},
	// Plotted in place of the Intelligence Index while Code only is on.
	coding: {
		id: "coding",
		tabLabel: "Coding",
		chartTitle: "Effective cost vs coding score",
		axisLabel: "Coding score",
		scoreLabel: "Coding score",
		formatScore: formatIntelligence,
		tokensLabel: "Tokens per task, coding evals",
		source: SLOPALYTICS,
		pointSource: () => SLOPALYTICS,
	},
};
