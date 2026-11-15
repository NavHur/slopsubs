import type {
	PlanFit,
	PlanGap,
	PlanShort,
	Recommendation,
} from "#/domain/recommend";
import { familyName } from "#/lib/families";
import type { FitInputs } from "#/lib/fit";
import {
	baselineLine,
	fitDetail,
	formatShare,
	shortDetail,
	unpricedLine,
	verdictHeadline,
} from "#/lib/fitCopy";
import { PlanRow } from "./PlanRow";

type Ranked = Extract<Recommendation, { kind: "ranked" }>;

/** The answer: a verdict, the plans that fit, and why the others don't. */
export function FitResults({
	result,
	inputs,
	benchmarkName,
}: {
	result: Recommendation;
	inputs: FitInputs;
	benchmarkName: string;
}) {
	return (
		<div
			aria-live="polite"
			className="@container mt-7 flex flex-col gap-5 border-t border-line pt-5"
		>
			{result.kind === "unpriced" ? (
				<p className="max-w-[72ch] text-[15px]">
					{unpricedLine(result, inputs, benchmarkName)}
				</p>
			) : (
				<RankedResults
					result={result}
					inputs={inputs}
					benchmarkName={benchmarkName}
				/>
			)}
		</div>
	);
}

function RankedResults({
	result,
	inputs,
	benchmarkName,
}: {
	result: Ranked;
	inputs: FitInputs;
	benchmarkName: string;
}) {
	const baseline = baselineLine(result, inputs, benchmarkName);
	return (
		<>
			<div className="max-w-[72ch]">
				<p className="text-[17px] font-medium text-balance">
					{verdictHeadline(result)}
				</p>
				{baseline && (
					<p className="mt-1 text-[13px] leading-5 text-muted">{baseline}</p>
				)}
			</div>
			{result.fits.length > 0 && (
				<FitList
					fits={result.fits}
					any={inputs.any}
					apiCheaper={result.apiCheaper}
				/>
			)}
			{result.short.length > 0 && (
				<ShortList short={result.short} any={inputs.any} />
			)}
			<SetAside result={result} />
		</>
	);
}

const LIST = "flex flex-col divide-y divide-line border-y border-line";
const CAPTION = "mb-1 text-[13px] text-muted";

/** Plans that fit, cheapest first; the first takes the accent it wins. */
function FitList({
	fits,
	any,
	apiCheaper,
}: {
	fits: readonly PlanFit[];
	any: boolean;
	apiCheaper: boolean;
}) {
	return (
		<div>
			<h3 className={CAPTION}>
				{apiCheaper
					? "Plans that fit anyway, cheapest first"
					: "Plans that fit, cheapest first"}
			</h3>
			<ol className={LIST}>
				{fits.map((fit, rank) => (
					<PlanRow
						key={fit.plan.id}
						plan={fit.plan}
						basis={fit.basis}
						share={fit.capUse}
						shareLabel={`${formatShare(fit.capUse)} used`}
						detail={fitDetail(fit, any)}
						lead={rank === 0 && !apiCheaper}
					/>
				))}
			</ol>
		</div>
	);
}

function ShortList({
	short,
	any,
}: {
	short: readonly PlanShort[];
	any: boolean;
}) {
	return (
		<div>
			<h3 className={CAPTION}>Too small for this week</h3>
			<ul className={LIST}>
				{short.map((s) => (
					<PlanRow
						key={s.plan.id}
						plan={s.plan}
						basis={s.basis}
						share={s.coverage}
						shareLabel={`${formatShare(s.coverage)} covered`}
						detail={shortDetail(s, any)}
					/>
				))}
			</ul>
		</div>
	);
}

function gapText(gaps: readonly PlanGap[]): string[] {
	const byReason = Map.groupBy(gaps, (g) => `${g.gap}:${g.family}`);
	return [...byReason.values()].map((group) => {
		const { family, gap } = group[0];
		const plans = group.map((g) => g.plan.label).join(", ");
		return gap === "model"
			? `Doesn't include ${familyName(family)}: ${plans}.`
			: `Doesn't serve ${familyName(family)} at this effort: ${plans}.`;
	});
}

function labelled(prefix: string, plans: Ranked["unsized"]): string[] {
	return plans.length > 0
		? [`${prefix}: ${plans.map((p) => p.label).join(", ")}.`]
		: [];
}

/** Plans the ranking leaves out, and why. */
function SetAside({ result }: { result: Ranked }) {
	const lines = [
		...gapText(result.gaps),
		...labelled("Can't size yet", result.unsized),
		...labelled("Over your budget", result.overBudget),
	];
	if (lines.length === 0) return null;
	return (
		<div>
			<h3 className={CAPTION}>Set aside</h3>
			<ul className="flex max-w-[72ch] flex-col gap-1 text-[13px] leading-5 text-subtle">
				{lines.map((line) => (
					<li key={line}>{line}</li>
				))}
			</ul>
		</div>
	);
}
