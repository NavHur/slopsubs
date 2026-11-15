import { type ReactNode, useEffect, useRef } from "react";
import { type FitSearch, fitInputs } from "#/lib/fit";
import { QUIZ_STEPS, type QuizStep } from "#/lib/fitQuiz";
import { BudgetField, ModelPicker, UsageField } from "./QuizFields";

type Patch = (patch: Partial<FitSearch>) => void;

/** Each question's wording, and the hint under it. */
const QUESTIONS: Record<QuizStep, { title: string; hint: string }> = {
	models: {
		title: "Which models do you use?",
		hint: "Pick one or more, or let each plan run its own flagship.",
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
	const legendRef = useFocusOnStep(index);
	const last = index === QUIZ_STEPS.length - 1;
	const { title, hint } = QUESTIONS[step];
	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				onNext();
			}}
		>
			<fieldset className="flex flex-col gap-5">
				<legend
					ref={legendRef}
					tabIndex={-1}
					className="flex flex-col gap-1 outline-none"
				>
					<span className="text-[12px] text-subtle tabular-nums">
						{index + 1} of {QUIZ_STEPS.length}
					</span>
					<span className="text-[20px] font-medium">{title}</span>
					<span className="text-[13px] text-muted">{hint}</span>
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
 * Moves focus to the question when the visitor moves to another one, so a
 * screen reader reads it out; not on the first render, which would pull the
 * page to the section on load.
 */
function useFocusOnStep(index: number) {
	const ref = useRef<HTMLLegendElement>(null);
	const shown = useRef(index);
	useEffect(() => {
		if (shown.current === index) return;
		shown.current = index;
		ref.current?.focus({ preventScroll: true });
	}, [index]);
	return ref;
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
		<div className="mt-6 flex items-center gap-6">
			<button
				type="submit"
				className="min-h-11 rounded-sm bg-fg px-4 text-[14px] font-medium text-bg hover:opacity-90"
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
		</div>
	);
}
