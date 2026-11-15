import { useMemo } from "react";
import { leaderboards } from "#/data";
import type { BenchmarkId } from "#/domain/enums";
import { recommendPlans } from "#/domain/recommend";
import { BENCHMARK_VIEWS } from "#/lib/benchmarks";
import { type FitSearch, fitInputs, fitWorkload, SIZED_PLANS } from "#/lib/fit";
import { FitControls } from "./FitControls";
import { FitResults } from "./FitResults";

/**
 * "Which plan fits": the visitor's week in, the cheapest plan that covers it
 * out, beside paying per token. `fit` is the URL's param, unset for defaults.
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
	const inputs = useMemo(() => fitInputs(fit), [fit]);
	const benchmarkName = BENCHMARK_VIEWS[benchmark].tabLabel;
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
		<section
			id="plan-fit"
			aria-labelledby="plan-fit-title"
			className="flex scroll-mt-24 flex-col px-4 pt-5 pb-6 sm:scroll-mt-12 sm:px-7"
		>
			<h2
				id="plan-fit-title"
				tabIndex={-1}
				className="mb-4 text-[17px] font-semibold outline-none"
			>
				Which plan fits
			</h2>
			<FitControls
				inputs={inputs}
				benchmarkName={benchmarkName}
				onChange={(patch) => onChange({ ...fit, ...patch })}
			/>
			<FitResults
				result={result}
				inputs={inputs}
				benchmarkName={benchmarkName}
			/>
		</section>
	);
}
