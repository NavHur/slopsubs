import { Effect } from "effect";
import { useMemo, useRef, useState } from "react";
import { leaderboards } from "#/data";
import type { BenchmarkId } from "#/domain/enums";
import { recommendPlans } from "#/domain/recommend";
import { BENCHMARK_VIEWS } from "#/lib/benchmarks";
import { type FitSearch, fitInputs, fitWorkload, SIZED_PLANS } from "#/lib/fit";
import {
	advanced,
	answered,
	entered,
	type QuestionScreen,
	type QuizProgress,
	quizScreen,
	restarted,
	wentBack,
} from "#/lib/fitQuiz";
import { QuizQuestion } from "./QuizQuestion";
import { QuizResult } from "./QuizResult";

/**
 * "Which plan fits": a three-question quiz about the visitor's week, then the
 * cheapest plan that covers it beside paying per token. `fit` is the URL's
 * param: set once the quiz is finished, and on shared links.
 */
export function PlanFitSection({
	benchmark,
	fit,
	onChange,
}: {
	benchmark: BenchmarkId;
	fit: FitSearch | undefined;
	onChange: (fit: FitSearch) => void;
}) {
	const [progress, setProgress] = useState<QuizProgress | null>(null);
	const [current, setFinished] = useFinishedFit(fit);
	const screen = quizScreen(current, progress);
	const benchmarkName = BENCHMARK_VIEWS[benchmark].tabLabel;
	const titleRef = useRef<HTMLHeadingElement>(null);
	// Between the quiz and its result the focused control goes away; the
	// title stays, so focus waits there.
	const show = (next: QuizProgress | null) => {
		setProgress(next);
		titleRef.current?.focus({ preventScroll: true });
	};
	const next = (question: QuestionScreen) => {
		const step = advanced(question);
		if (step.kind === "finished") {
			setFinished(step.fit);
			onChange(step.fit);
			show(null);
		} else if (step.kind === "question") setProgress(step.progress);
	};
	const back = (question: QuestionScreen) => {
		const previous = wentBack(question);
		if (previous) return setProgress(previous);
		show(null);
	};
	return (
		<section
			id="plan-fit"
			aria-labelledby="plan-fit-title"
			className="flex scroll-mt-24 flex-col px-4 pt-5 pb-8 sm:scroll-mt-12 sm:px-7"
		>
			<h2
				ref={titleRef}
				id="plan-fit-title"
				tabIndex={-1}
				className="mb-5 text-[17px] font-semibold outline-none"
			>
				Which plan fits
			</h2>
			{screen.kind === "question" ? (
				<QuizQuestion
					screen={screen}
					benchmarkName={benchmarkName}
					backLabel={backLabel(screen, current)}
					onAnswer={(patch) => setProgress(answered(screen, patch))}
					onEntry={(field, entry) => setProgress(entered(screen, field, entry))}
					onBack={() => back(screen)}
					onNext={() => next(screen)}
				/>
			) : (
				<Answer
					benchmark={benchmark}
					fit={current}
					onChangeAnswers={() => show(restarted(current))}
				/>
			)}
		</section>
	);
}

/**
 * The answers the section shows: those just finished until the URL's `fit`
 * changes to carry them, then the URL's. The router writes the URL after the
 * click, so without them the quiz would fall back to its first question.
 */
function useFinishedFit(fit: FitSearch | undefined) {
	const [finished, setFinished] = useState<FitSearch | null>(null);
	const [seen, setSeen] = useState(fit);
	if (fit !== seen) {
		setSeen(fit);
		setFinished(null);
	}
	return [finished ?? fit, setFinished] as const;
}

/** Back on a first question leads to the result, if there is one. */
function backLabel(screen: QuestionScreen, fit: FitSearch | undefined) {
	if (screen.index > 0) return "Back";
	return fit ? "Back to my plan" : null;
}

function Answer({
	benchmark,
	fit,
	onChangeAnswers,
}: {
	benchmark: BenchmarkId;
	fit: FitSearch | undefined;
	onChangeAnswers: () => void;
}) {
	const inputs = useMemo(() => fitInputs(fit), [fit]);
	const result = useMemo(
		() =>
			Effect.runSync(
				recommendPlans({
					plans: SIZED_PLANS,
					points: leaderboards[benchmark].models,
					workload: fitWorkload(inputs),
				}),
			),
		[benchmark, inputs],
	);
	return (
		<QuizResult
			result={result}
			inputs={inputs}
			benchmarkName={BENCHMARK_VIEWS[benchmark].tabLabel}
			onChangeAnswers={onChangeAnswers}
		/>
	);
}
