import { useMemo, useRef, useState } from "react";
import { leaderboards } from "#/data";
import type { BenchmarkId } from "#/domain/enums";
import { recommendPlans } from "#/domain/recommend";
import { BENCHMARK_VIEWS } from "#/lib/benchmarks";
import { type FitSearch, fitInputs, fitWorkload, SIZED_PLANS } from "#/lib/fit";
import {
	advanced,
	answered,
	type QuizProgress,
	type QuizScreen,
	quizScreen,
	restarted,
	wentBack,
} from "#/lib/fitQuiz";
import { QuizQuestion } from "./QuizQuestion";
import { QuizResult } from "./QuizResult";

type Question = Extract<QuizScreen, { kind: "question" }>;

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
	const screen = quizScreen(fit, progress);
	const benchmarkName = BENCHMARK_VIEWS[benchmark].tabLabel;
	const titleRef = useRef<HTMLHeadingElement>(null);
	// Between the quiz and its result the focused control goes away; the
	// title stays, so focus waits there.
	const show = (next: QuizProgress | null) => {
		setProgress(next);
		titleRef.current?.focus({ preventScroll: true });
	};
	const next = (question: Question) => {
		const step = advanced(question);
		if (step.kind === "question") return setProgress(step.progress);
		onChange(step.fit);
		show(null);
	};
	const back = (question: Question) => {
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
					step={screen.step}
					index={screen.index}
					draft={screen.draft}
					benchmarkName={benchmarkName}
					backLabel={backLabel(screen, fit)}
					onAnswer={(patch) => setProgress(answered(screen, patch))}
					onBack={() => back(screen)}
					onNext={() => next(screen)}
				/>
			) : (
				<Answer
					benchmark={benchmark}
					fit={fit}
					onChangeAnswers={() => show(restarted(fit))}
				/>
			)}
		</section>
	);
}

/** Back on a first question leads to the result, if there is one. */
function backLabel(screen: Question, fit: FitSearch | undefined) {
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
			recommendPlans({
				plans: SIZED_PLANS,
				points: leaderboards[benchmark].models,
				workload: fitWorkload(inputs),
			}),
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
