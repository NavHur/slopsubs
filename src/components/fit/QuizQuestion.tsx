import {
	type KeyboardEvent,
	type ReactNode,
	useEffect,
	useRef,
	useState,
} from "react";
import { type FitSearch, fitInputs } from "#/lib/fit";
import { QUIZ_STEPS, type QuizStep } from "#/lib/fitQuiz";
import { BudgetField, ModelPicker, UsageField } from "./QuizFields";

type Patch = (patch: Partial<FitSearch>) => void;

/** Each question's wording, and the hint under it. */
const QUESTIONS: Record<QuizStep, { title: string; hint: string }> = {
	models: {
		title: "Which models do you use?",
		hint: "Pick all that apply, or let each plan run its own flagship.",
	},
	usage: {
		title: "How much do you use them in a week?",
		hint: "In API-priced dollars, as ccusage reports them, or in benchmark tasks.",
	},
	budget: {
		title: "Is there a most you'd pay a month?",
		hint: "Optional. Plans above it are set aside.",
	},
};

/**
 * One question of the plan-fit quiz. Enter or Next moves on; Back returns to
 * the previous question, or to the result when there is one to return to.
 */
export function QuizQuestion({
	step,
	index,
	draft,
	benchmarkName,
	backLabel,
	onAnswer,
	onBack,
	onNext,
}: {
	step: QuizStep;
	index: number;
	draft: FitSearch;
	benchmarkName: string;
	/** Null hides Back, on a first question with nothing to go back to. */
	backLabel: string | null;
	onAnswer: Patch;
	onBack: () => void;
	onNext: () => void;
}) {
	const { fieldsetRef, legendRef, stepped } = useQuestionFocus(step, index);
	const last = index === QUIZ_STEPS.length - 1;
	const { title, hint } = QUESTIONS[step];
	return (
		// oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Enter from the focused question heading submits, as it does from the fields; the controls inside stay native
		<form
			onKeyDown={submitOnEnter}
			onSubmit={(event) => {
				event.preventDefault();
				onNext();
			}}
		>
			<fieldset
				key={index}
				ref={fieldsetRef}
				className={`flex flex-col ${QUESTION_HEIGHT} ${stepped ? STEP_IN : ""}`}
			>
				<legend
					ref={legendRef}
					tabIndex={-1}
					className="mb-5 flex flex-col outline-none"
				>
					<QuizProgress index={index} />
					<span className="mt-3 text-[20px] leading-7 font-medium text-balance sm:text-[22px]">
						{title}
					</span>
					<span className="mt-1 text-[13px] text-muted">{hint}</span>
				</legend>
				{questionBody(step, draft, benchmarkName, onAnswer)}
			</fieldset>
			<QuizNav
				backLabel={backLabel}
				nextLabel={last ? "See my plan" : "Next"}
				onBack={onBack}
			/>
		</form>
	);
}

/**
 * Room for the tallest question, the models with two share fields, so Next
 * stays put and the charts below hold still from one question to the next.
 * From lg the charts share the screen with the quiz; the models fill three
 * rows of options there and two from xl.
 */
const QUESTION_HEIGHT = "lg:min-h-[338px] xl:min-h-[286px]";

/** A question slides up into place after a step; still where motion is off. */
const STEP_IN =
	"transition-[opacity,translate] duration-200 ease-out starting:translate-y-1 starting:opacity-0 motion-reduce:transition-none";

/**
 * Enter moves on from anywhere in a question, a focused heading or number
 * field included; on a button it presses the button.
 */
function submitOnEnter(event: KeyboardEvent<HTMLFormElement>) {
	const pressesButton = event.target instanceof HTMLButtonElement;
	if (event.key !== "Enter" || pressesButton || event.nativeEvent.isComposing)
		return;
	event.preventDefault();
	event.currentTarget.requestSubmit();
}

/** "1 of 3" beside a slim bar of the questions, the reached ones filled. */
function QuizProgress({ index }: { index: number }) {
	return (
		<span className="flex items-center gap-3 text-[12px] text-subtle tabular-nums">
			{index + 1} of {QUIZ_STEPS.length}
			<span aria-hidden="true" className="flex gap-1">
				{QUIZ_STEPS.map((step, i) => (
					<span
						key={step}
						className={`h-0.5 w-5 rounded-full transition-colors ${i <= index ? "bg-fg/70" : "bg-grid"}`}
					/>
				))}
			</span>
		</span>
	);
}

function questionBody(
	step: QuizStep,
	draft: FitSearch,
	benchmarkName: string,
	onAnswer: Patch,
): ReactNode {
	const inputs = fitInputs(draft);
	switch (step) {
		case "models":
			return <ModelPicker inputs={inputs} onChange={onAnswer} />;
		case "usage":
			return (
				<UsageField
					inputs={inputs}
					benchmarkName={benchmarkName}
					onChange={onAnswer}
				/>
			);
		case "budget":
			return <BudgetField budget={inputs.budget} onChange={onAnswer} />;
	}
}

/**
 * Moves focus into the question when the visitor moves to another one: the
 * amount or budget field, selected so typing replaces it, or the heading, so a
 * screen reader reads it out. Not on the first render, which would pull the
 * page to the section on load; `stepped` says the visitor has moved, so only
 * then does a question animate in.
 */
function useQuestionFocus(step: QuizStep, index: number) {
	const fieldsetRef = useRef<HTMLFieldSetElement>(null);
	const legendRef = useRef<HTMLLegendElement>(null);
	const shown = useRef(index);
	const [first] = useState(index);
	const [stepped, setStepped] = useState(false);
	// Known while rendering, so the next question mounts with its transition.
	if (!stepped && index !== first) setStepped(true);
	useEffect(() => {
		if (shown.current === index) return;
		shown.current = index;
		// The models' share fields are a follow-up, not the question.
		const field =
			step === "models" ? null : fieldsetRef.current?.querySelector("input");
		const target = field ?? legendRef.current;
		target?.focus({ preventScroll: true });
		field?.select();
	}, [step, index]);
	return { fieldsetRef, legendRef, stepped };
}

function QuizNav({
	backLabel,
	nextLabel,
	onBack,
}: {
	backLabel: string | null;
	nextLabel: string;
	onBack: () => void;
}) {
	return (
		<div className="mt-7 flex items-center gap-5">
			<button
				type="submit"
				className="min-h-11 rounded-sm border border-fg/60 px-5 text-[14px] font-medium text-fg transition-colors hover:border-fg hover:bg-fg/5"
			>
				{nextLabel}
			</button>
			{backLabel && (
				<button
					type="button"
					onClick={onBack}
					className="min-h-11 text-[13px] text-muted hover:text-fg"
				>
					{backLabel}
				</button>
			)}
			<span
				aria-hidden="true"
				className="text-[12px] text-subtle max-lg:hidden"
			>
				or press Enter
			</span>
		</div>
	);
}
