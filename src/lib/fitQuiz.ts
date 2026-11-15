import type { FitSearch } from "./fit";

/** The quiz's questions, in order. */
export const QUIZ_STEPS = ["models", "usage", "budget"] as const;
export type QuizStep = (typeof QUIZ_STEPS)[number];

/**
 * A quiz the visitor is going through: the question on screen and the answers
 * so far. Answers stay out of the URL until the last question, so a `fit`
 * param always means a finished quiz.
 */
export type QuizProgress = { step: number; draft: FitSearch };

/** What the section shows. */
export type QuizScreen =
	| { kind: "question"; step: QuizStep; index: number; draft: FitSearch }
	| { kind: "result" };

/**
 * The screen for the URL's answers and the visitor's progress, if any. With
 * no progress, a finished quiz (a `fit` param, as on a shared link) shows its
 * result and an unstarted one its first question. Deriving it, rather than
 * holding it in state, lets the linked view replace the prerendered one.
 */
export function quizScreen(
	fit: FitSearch | undefined,
	progress: QuizProgress | null,
): QuizScreen {
	if (progress) {
		return {
			kind: "question",
			step: QUIZ_STEPS[progress.step],
			index: progress.step,
			draft: progress.draft,
		};
	}
	return fit
		? { kind: "result" }
		: { kind: "question", step: QUIZ_STEPS[0], index: 0, draft: {} };
}

/** The progress after an answer on `screen`'s question. */
export function answered(
	screen: Extract<QuizScreen, { kind: "question" }>,
	patch: Partial<FitSearch>,
): QuizProgress {
	return { step: screen.index, draft: { ...screen.draft, ...patch } };
}

/** Where moving on from a question leads: the next one, or the answers to
 * put in the URL once the last is done. */
export type QuizAdvance =
	| { kind: "question"; progress: QuizProgress }
	| { kind: "finished"; fit: FitSearch };

export function advanced(
	screen: Extract<QuizScreen, { kind: "question" }>,
): QuizAdvance {
	const step = screen.index + 1;
	return step < QUIZ_STEPS.length
		? { kind: "question", progress: { step, draft: screen.draft } }
		: { kind: "finished", fit: screen.draft };
}

/** The previous question, keeping the answers; null on the first. */
export function wentBack(
	screen: Extract<QuizScreen, { kind: "question" }>,
): QuizProgress | null {
	return screen.index > 0
		? { step: screen.index - 1, draft: screen.draft }
		: null;
}

/** The quiz again from the first question, starting from the given answers. */
export function restarted(fit: FitSearch | undefined): QuizProgress {
	return { step: 0, draft: fit ?? {} };
}
