import { AA_EVAL_IDS } from "./enums";

/** Claude Sonnet 5.5 (max) as AA's pages carried it on 2026-11-20. */
export const SONNET = {
	id: "b171d979-5ec1-45de-b8b9-db1ee65e77ec",
	slug: "claude-sonnet-5-5",
	scores: {
		briefcaseBreakdown: { overall: { elo: 1815.14 } },
		automationBenchPartialScore: 0.7176882128193995,
		terminalBench41: 0.636363636363636,
		frontierCode20: 0.416993434343434,
		omniscience: 30.466666666666665,
		gdpPdfAllPass: 0.258,
		hleDiamond: 0.533,
		critptAgenticHard: 0.59,
		terminalBenchScience: 0.533333333333333,
	},
	/** AA's weighted cost per task for each eval, in `AA_EVAL_IDS` order. */
	weightedCosts: [
		3.071086362898891, 0.051622199990514886, 1.2646441608317138,
		1.733627426843996, 0.022773200799999997, 0.039716396, 0.0803716788,
		0.1926741603570175, 3.5641057568736194,
	],
	totalCost: 10.020621343395753,
	outputTokensPerTask: 285387.11335048935,
	secondsPerTask: 1995.3302417810676,
	/** The record's answer and reasoning tokens for each eval, by AA's key. */
	tokenCounts: {
		briefcase: { answer: 19316127, reasoning: 37574868 },
		automationBench: { answer: 12194455, reasoning: 27824106 },
		terminalBench41: { answer: 6131049, reasoning: 19109282 },
		frontierCode20: { answer: 11727454, reasoning: 29982620 },
		omniscience: { answer: 216035, reasoning: 45227159 },
		gdpPdf: { answer: 197628, reasoning: 4221285 },
		hleDiamond: { answer: 527912, reasoning: 79715780 },
		critptAgenticHard: { answer: 494212, reasoning: 5143006 },
		terminalBenchScience: { answer: 10380324, reasoning: 25238209 },
	},
};

type Sonnet = typeof SONNET;
export type Who = { id: string; slug: string };
/** A second model with Sonnet's figures, to stand beside it on a page. */
export const ALPHA: Who = {
	id: "a1fa0000-0000-0000-0000-000000000000",
	slug: "alpha",
};
export type ModelOverrides = Partial<{
	who: Who;
	weightedCosts: number[];
	totalCost: number;
	tokenCounts: Partial<Sonnet["tokenCounts"]>;
}>;

const identity = (who: Who = SONNET) => ({
	id: who.id,
	slug: who.slug,
	release: { slug: who.slug },
	effort: { slug: "max" },
	isReasoning: true,
	intelligenceIndex: 30,
});

/** A model page's record: scores, and the index's cost and time per task. */
export function modelRecord(over: ModelOverrides = {}) {
	const costs = over.weightedCosts ?? SONNET.weightedCosts;
	return {
		...identity(over.who),
		...SONNET.scores,
		intelligenceIndexCostPerTask: {
			cost: { total: over.totalCost ?? SONNET.totalCost },
			evaluations: AA_EVAL_IDS.map((slug, i) => ({
				slug,
				weightedCostPerTask: costs[i],
			})),
		},
		intelligenceIndexOutputTokensPerTask: {
			output: SONNET.outputTokensPerTask,
		},
		intelligenceIndexTimePerTask: SONNET.secondsPerTask,
	};
}

/** An eval page's record: the same model with its token counts. */
export function evalPageRecord(over: ModelOverrides = {}) {
	return {
		...identity(over.who),
		canonicalEvalTokenCounts: { ...SONNET.tokenCounts, ...over.tokenCounts },
	};
}

/** An HTML page whose single push chunk carries the given records. */
export function pageOf(records: object[]): string {
	const flight = `0:${JSON.stringify(records)}`;
	return `<script>self.__next_f.push([1,${JSON.stringify(flight)}])</script>`;
}

/** A model id in the payload's 36-character uuid form. */
const uuidOf = (index: number) =>
	`${String(index).padStart(8, "0")}-0000-0000-0000-000000000000`;

export type Fixture = {
	release: string;
	effort?: string;
	reasons?: boolean;
	score: number;
	/** The record's own slug; defaults to its release and effort. */
	slug?: string;
};

/** A score-only model record as the flight payload lays it out, creator
 * nested, with the position on its page as its id. */
export function scoredRecord(
	{ release, effort, reasons = true, score, slug }: Fixture,
	index: number,
) {
	return {
		id: uuidOf(index),
		slug: slug ?? [release, effort].filter(Boolean).join("-"),
		creator: { id: uuidOf(900 + index), slug: "lab" },
		isReasoning: reasons,
		...(effort ? { effort: { slug: effort } } : {}),
		release: { slug: release },
		intelligenceIndex: 30,
		omniscience: score,
		terminalBench41: null,
	};
}
