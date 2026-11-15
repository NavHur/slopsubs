import { describe, expect, it } from "vite-plus/test";
import {
	advanced,
	answered,
	type QuizScreen,
	quizScreen,
	restarted,
	wentBack,
} from "./fitQuiz";

type Question = Extract<QuizScreen, { kind: "question" }>;

function question(screen: QuizScreen): Question {
	if (screen.kind !== "question") throw new Error("expected a question");
	return screen;
}

describe("the plan-fit quiz", () => {
	it("starts at the first question with no answers in the URL", () => {
		expect(quizScreen(undefined, null)).toEqual({
			kind: "question",
			step: "models",
			index: 0,
			draft: {},
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
		expect(screen.step).toBe("usage");
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
			quizScreen(undefined, { step: 1, draft: { amount: 9 } }),
		);
		expect(wentBack(usage)).toEqual({ step: 0, draft: { amount: 9 } });
		const first = question(quizScreen({ amount: 9 }, restarted({ amount: 9 })));
		expect(wentBack(first)).toBeNull();
		expect(quizScreen({ amount: 9 }, null)).toEqual({ kind: "result" });
	});

	it("changes answers starting from the ones in the URL", () => {
		expect(restarted({ budget: 50 })).toEqual({
			step: 0,
			draft: { budget: 50 },
		});
	});
});
