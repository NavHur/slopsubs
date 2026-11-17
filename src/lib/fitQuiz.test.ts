import { describe, expect, it } from "vite-plus/test";
import type { FitSearch } from "./fit";
import { unitChange } from "./fit";
import {
	advanced,
	answered,
	canAdvance,
	entered,
	parseEntry,
	type QuestionScreen,
	type QuizScreen,
	quizScreen,
	restarted,
	shareField,
	wentBack,
} from "./fitQuiz";

type Question = QuestionScreen;

function question(screen: QuizScreen): Question {
	if (screen.kind !== "question") throw new Error("expected a question");
	return screen;
}

describe("the plan-fit quiz", () => {
	it("stores a share as it shows it, and won't take one that shows as 0%", () => {
		const draft = { models: ["claude-opus-5-5", "claude-fable-5-2"] };
		const at = (value: number) =>
			entered(
				question(quizScreen(undefined, { step: 0, draft, invalid: [] })),
				shareField("claude-fable-5-2"),
				{ kind: "number", value },
			);
		expect(at(33.33).draft.weights).toEqual({ "claude-fable-5-2": 33.3 });
		const tiny = at(0.04);
		expect(tiny.draft.weights).toBeUndefined();
		expect(tiny.invalid).toEqual([shareField("claude-fable-5-2")]);
	});

	it("starts at the first question with no answers in the URL", () => {
		expect(quizScreen(undefined, null)).toEqual({
			kind: "question",
			index: 0,
			draft: {},
			invalid: [],
		});
	});

	it("opens a shared link's answers straight to the result", () => {
		expect(quizScreen({ amount: 500 }, null)).toEqual({ kind: "result" });
	});

	it("keeps answers out of the URL until the last question", () => {
		let screen = question(quizScreen(undefined, null));
		screen = question(quizScreen(undefined, answered(screen, { any: true })));
		const toUsage = advanced(screen);
		if (toUsage.kind !== "question") throw new Error("finished early");
		screen = question(
			quizScreen(
				undefined,
				answered(question(quizScreen(undefined, toUsage.progress)), {
					amount: 80,
				}),
			),
		);
		expect(screen.index).toBe(1);
		const toBudget = advanced(screen);
		if (toBudget.kind !== "question") throw new Error("finished early");
		const budget = question(quizScreen(undefined, toBudget.progress));
		expect(advanced(budget)).toEqual({
			kind: "finished",
			fit: { any: true, amount: 80 },
		});
	});

	it("goes back with the answers kept, and off the first question to the result", () => {
		const usage = question(
			quizScreen(undefined, { step: 1, draft: { amount: 9 }, invalid: [] }),
		);
		expect(wentBack(usage)).toEqual({
			step: 0,
			draft: { amount: 9 },
			invalid: [],
		});
		const first = question(quizScreen({ amount: 9 }, restarted({ amount: 9 })));
		expect(wentBack(first)).toBeNull();
		expect(quizScreen({ amount: 9 }, null)).toEqual({ kind: "result" });
	});

	it("changes answers starting from the ones in the URL", () => {
		expect(restarted({ budget: 50 })).toEqual({
			step: 0,
			draft: { budget: 50 },
			invalid: [],
		});
	});
});

/** The usage question with the given answers. */
function usage(draft: FitSearch): Question {
	return question(quizScreen(undefined, { step: 1, draft, invalid: [] }));
}

describe("number fields in the quiz", () => {
	it("tells a blank, a non-positive or unreadable entry from a number", () => {
		expect(parseEntry("")).toEqual({ kind: "blank" });
		expect(parseEntry("  ")).toEqual({ kind: "blank" });
		expect(parseEntry("0")).toEqual({ kind: "invalid" });
		expect(parseEntry("-5")).toEqual({ kind: "invalid" });
		expect(parseEntry("", true)).toEqual({ kind: "invalid" });
		expect(parseEntry("1.5")).toEqual({ kind: "number", value: 1.5 });
	});

	it("takes a typed amount as the answer", () => {
		const progress = entered(usage({}), "amount", parseEntry("80"));
		expect(progress.draft).toEqual({ amount: 80 });
		expect(progress.invalid).toEqual([]);
	});

	it.each(["", "0", "-3"])(
		"won't move on from a usage amount of %j, and keeps the old amount out of sight",
		(text) => {
			const typed = question(
				quizScreen(
					undefined,
					entered(usage({ amount: 250 }), "amount", parseEntry(text)),
				),
			);
			expect(canAdvance(typed)).toBe(false);
			expect(advanced(typed)).toEqual({ kind: "blocked" });
		},
	);

	it("moves on again once the amount is a number", () => {
		const blank = question(
			quizScreen(undefined, entered(usage({}), "amount", parseEntry(""))),
		);
		const fixed = question(
			quizScreen(undefined, entered(blank, "amount", parseEntry("40"))),
		);
		expect(canAdvance(fixed)).toBe(true);
		expect(advanced(fixed).kind).toBe("question");
	});

	it("blocks a model share that is emptied or zero, until it is a number", () => {
		const field = shareField("claude-opus-5-5");
		const blank = question(
			quizScreen(undefined, entered(usage({}), field, parseEntry(""))),
		);
		expect(canAdvance(blank)).toBe(false);
		const zero = question(
			quizScreen(undefined, entered(blank, field, parseEntry("0"))),
		);
		expect(canAdvance(zero)).toBe(false);
		const fixed = entered(zero, field, parseEntry("60"));
		expect(fixed.draft.weights).toEqual({ "claude-opus-5-5": 60 });
		expect(fixed.invalid).toEqual([]);
	});

	it("reads a blank budget as no budget, and a zero budget as a mistake", () => {
		const budget = question(
			quizScreen(undefined, { step: 2, draft: { budget: 50 }, invalid: [] }),
		);
		const cleared = entered(budget, "budget", parseEntry(""));
		expect(cleared.draft.budget).toBeUndefined();
		expect(cleared.invalid).toEqual([]);
		const zero = question(
			quizScreen(undefined, entered(budget, "budget", parseEntry("0"))),
		);
		expect(canAdvance(zero)).toBe(false);
		expect(advanced(zero)).toEqual({ kind: "blocked" });
	});

	it("drops a blocked amount when the unit change gives it a new one", () => {
		const blank = question(
			quizScreen(undefined, entered(usage({}), "amount", parseEntry(""))),
		);
		const switched = answered(blank, unitChange("tasks"));
		expect(switched.invalid).toEqual([]);
		expect(switched.draft.amount).toBe(50);
	});

	it("drops a blocked share when its model leaves the question", () => {
		const field = shareField("claude-opus-5-5");
		const draft = { models: ["claude-opus-5-5", "claude-fable-5-2"] };
		const blank = question(
			quizScreen(undefined, entered(usage(draft), field, parseEntry(""))),
		);
		expect(answered(blank, { any: true }).invalid).toEqual([]);
		expect(
			answered(blank, { weights: { "claude-fable-5-2": 30 } }).invalid,
		).toEqual([field]);
	});
});
