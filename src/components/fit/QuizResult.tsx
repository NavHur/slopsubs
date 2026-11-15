import type { Recommendation } from "#/domain/recommend";
import type { FitInputs } from "#/lib/fit";
import { answersSummary } from "#/lib/fitCopy";
import { FitResults } from "./FitResults";

/**
 * Where the referral points: LiteQuiz, the one-question-at-a-time form
 * builder this quiz takes after.
 */
// ceiling: LiteQuiz's shared dev preview, the only public host it has; swap in
// its production domain once it launches.
const LITEQUIZ_URL =
	"https://quiz-dev.pnav.dev/?utm_source=slopsubs&utm_medium=referral&utm_campaign=plan-fit";

/** The quiz's answer: what was asked, the plans, and a way to ask again. */
export function QuizResult({
	result,
	inputs,
	benchmarkName,
	onChangeAnswers,
}: {
	result: Recommendation;
	inputs: FitInputs;
	benchmarkName: string;
	onChangeAnswers: () => void;
}) {
	return (
		<div className="flex flex-col">
			<div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[13px]">
				<p className="text-pretty text-muted">
					{answersSummary(inputs, benchmarkName)}
				</p>
				<button
					type="button"
					onClick={onChangeAnswers}
					className="text-fg underline decoration-dotted underline-offset-2 hover:text-accent max-lg:min-h-11"
				>
					Change answers
				</button>
			</div>
			<FitResults
				result={result}
				inputs={inputs}
				benchmarkName={benchmarkName}
			/>
			<p className="mt-6 text-[12px] text-subtle max-lg:mt-3">
				Like this quiz?{" "}
				<a
					href={LITEQUIZ_URL}
					target="_blank"
					rel="noopener"
					className="text-muted underline decoration-dotted underline-offset-2 hover:text-fg max-lg:inline-flex max-lg:min-h-11 max-lg:items-center"
				>
					Build your own with LiteQuiz
				</a>
			</p>
		</div>
	);
}
