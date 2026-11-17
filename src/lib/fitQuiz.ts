import { type FitSearch, fitInputs } from "./fit";

/** The quiz's questions, in order. */
export const QUIZ_STEPS = ["models", "usage", "budget"] as const;
export type QuizStep = (typeof QUIZ_STEPS)[number];

/** What a number field holds: nothing, text that isn't a positive number, or one. */
export type FieldEntry =
	| { kind: "blank" }
	| { kind: "invalid" }
	| { kind: "number"; value: number };

/** `badInput` is the browser's word for number-field text with no number in it. */
export function parseEntry(text: string, badInput = false): FieldEntry {
	if (badInput) return { kind: "invalid" };
	if (text.trim() === "") return { kind: "blank" };
	const value = Number(text);
	return Number.isFinite(value) && value > 0
		? { kind: "number", value }
		: { kind: "invalid" };
}

const SHARE_PREFIX = "share:";

/** A number field the quiz asks for: the weekly amount, the budget, or a model's share. */
export type QuizField = "amount" | "budget" | `${typeof SHARE_PREFIX}${string}`;

export function shareField(family: string): QuizField {
	return `${SHARE_PREFIX}${family}`;
}

/**
 * A quiz the visitor is going through: the question on screen, the answers so
 * far, and the fields whose text isn't an answer yet. Answers stay out of the
 * URL until the last question, so a `fit` param always means a finished quiz.
 */
export type QuizProgress = {
	step: number;
	draft: FitSearch;
	invalid: readonly QuizField[];
};

export type QuestionScreen = {
	kind: "question";
	/** Which of QUIZ_STEPS is on screen. */
	index: number;
	draft: FitSearch;
	invalid: readonly QuizField[];
};

/** What the section shows. */
export type QuizScreen = QuestionScreen | { kind: "result" };

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
			index: progress.step,
			draft: progress.draft,
			invalid: progress.invalid,
		};
	}
	return fit
		? { kind: "result" }
		: { kind: "question", index: 0, draft: {}, invalid: [] };
}

/** Whether an invalid field keeps blocking once `patch` has been applied. */
function staysInvalid(
	field: QuizField,
	patch: Partial<FitSearch>,
	draft: FitSearch,
): boolean {
	if (!field.startsWith(SHARE_PREFIX)) return !(field in patch);
	const inputs = fitInputs(draft);
	const family = field.slice(SHARE_PREFIX.length);
	return (
		!inputs.any &&
		inputs.models.length > 1 &&
		inputs.models.some((model) => model === family)
	);
}

/** The progress after an answer on `screen`'s question, other than typed in a number field. */
export function answered(
	screen: QuestionScreen,
	patch: Partial<FitSearch>,
): QuizProgress {
	const draft = { ...screen.draft, ...patch };
	return {
		step: screen.index,
		draft,
		invalid: screen.invalid.filter((f) => staysInvalid(f, patch, draft)),
	};
}

/** The draft's change for a number typed into `field`; none when it isn't an answer. */
function entryPatch(
	draft: FitSearch,
	field: QuizField,
	entry: FieldEntry,
): Partial<FitSearch> {
	const value = entry.kind === "number" ? entry.value : undefined;
	if (field === "budget")
		return entry.kind === "invalid" ? {} : { budget: value };
	if (value === undefined) return {};
	if (field === "amount") return { amount: value };
	const family = field.slice(SHARE_PREFIX.length);
	return { weights: { ...draft.weights, [family]: value } };
}

/**
 * The progress after a number typed into `field`. A number is the answer; a
 * blank budget means no budget; anything else leaves the draft as it was and
 * marks the field, so what the draft holds is never a value the visitor can't see.
 */
export function entered(
	screen: QuestionScreen,
	field: QuizField,
	entry: FieldEntry,
): QuizProgress {
	const others = screen.invalid.filter((f) => f !== field);
	const blankBudget = entry.kind === "blank" && field === "budget";
	const rejected = entry.kind !== "number" && !blankBudget;
	return {
		step: screen.index,
		draft: { ...screen.draft, ...entryPatch(screen.draft, field, entry) },
		invalid: rejected ? [...others, field] : others,
	};
}

/** Whether the question's answers are all ones the visitor can move on with. */
export function canAdvance(screen: QuestionScreen): boolean {
	return screen.invalid.length === 0;
}

/** Where moving on from a question leads: the next one, nowhere while an
 * answer is missing, or the answers to put in the URL once the last is done. */
export type QuizAdvance =
	| { kind: "question"; progress: QuizProgress }
	| { kind: "blocked" }
	| { kind: "finished"; fit: FitSearch };

export function advanced(screen: QuestionScreen): QuizAdvance {
	if (!canAdvance(screen)) return { kind: "blocked" };
	const step = screen.index + 1;
	return step < QUIZ_STEPS.length
		? { kind: "question", progress: { step, draft: screen.draft, invalid: [] } }
		: { kind: "finished", fit: screen.draft };
}

/** The previous question, keeping the answers; null on the first. */
export function wentBack(screen: QuestionScreen): QuizProgress | null {
	return screen.index > 0
		? { step: screen.index - 1, draft: screen.draft, invalid: [] }
		: null;
}

/** The quiz again from the first question, starting from the given answers. */
export function restarted(fit: FitSearch | undefined): QuizProgress {
	return { step: 0, draft: fit ?? {}, invalid: [] };
}
