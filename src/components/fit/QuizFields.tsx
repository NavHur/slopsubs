import { useId } from "react";
import type { FamilyId } from "#/domain/model";
import { familyName } from "#/lib/families";
import {
	FIT_EFFORTS,
	FIT_FAMILIES,
	type FitInputs,
	type FitSearch,
	type FitUnit,
	modelToggle,
	modelWeight,
	unitChange,
} from "#/lib/fit";
import { type FieldEntry, type QuizField, shareField } from "#/lib/fitQuiz";
import { Segmented } from "../Segmented";
import { FieldError, NumberField } from "./NumberField";
import { QuizOption } from "./QuizOption";

const UNIT_OPTIONS = [
	{ value: "apiUsd", label: "API $ a week" },
	{ value: "tasks", label: "Tasks a week" },
] as const satisfies readonly { value: FitUnit; label: string }[];

const EFFORT_OPTIONS = FIT_EFFORTS.map((effort) => ({
	value: effort,
	label:
		effort === "xhigh" ? "X-high" : effort[0].toUpperCase() + effort.slice(1),
}));

type Patch = (patch: Partial<FitSearch>) => void;
type Entered = (field: QuizField, entry: FieldEntry) => void;

/** The first question's answer: the models, or Any flagship, and their shares. */
export function ModelPicker({
	inputs,
	invalid,
	onChange,
	onEntry,
}: {
	inputs: FitInputs;
	invalid: readonly QuizField[];
	onChange: Patch;
	onEntry: Entered;
}) {
	const pick = (family: FamilyId) => {
		const patch = modelToggle(inputs, family);
		if (patch) onChange(patch);
	};
	return (
		<div className="flex flex-col gap-4">
			<div className="grid max-w-[56rem] grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
				{FIT_FAMILIES.map((family) => (
					<QuizOption
						key={family}
						label={familyName(family)}
						on={!inputs.any && inputs.models.includes(family)}
						onClick={() => pick(family)}
					/>
				))}
				<QuizOption
					label="Any flagship"
					on={inputs.any}
					onClick={() => onChange({ any: !inputs.any })}
				/>
			</div>
			{!inputs.any && inputs.models.length > 1 && (
				<ShareFields inputs={inputs} invalid={invalid} onEntry={onEntry} />
			)}
		</div>
	);
}

/** "Counted as Opus 5.5 40%, Fable 5.2 60%" when the fields don't add up
 * to 100%, so the split the result uses is never hidden. */
function countedSplit(inputs: FitInputs): string | null {
	const weights = inputs.models.map((f) => modelWeight(inputs, f));
	const total = weights.reduce((sum, w) => sum + w, 0);
	if (Math.abs(total - 100) < 0.5) return null;
	const parts = inputs.models.map(
		(f, i) => `${familyName(f)} ${Math.round((weights[i] / total) * 100)}%`,
	);
	return `Counted as ${parts.join(", ")}.`;
}

/** Each model's part of the week, as weights scaled to add up to 100%. */
function ShareFields({
	inputs,
	invalid,
	onEntry,
}: {
	inputs: FitInputs;
	invalid: readonly QuizField[];
	onEntry: Entered;
}) {
	const base = useId();
	const errorId = (family: FamilyId) => `${base}-${family}`;
	const rejected = inputs.models.filter((f) => invalid.includes(shareField(f)));
	const counted = countedSplit(inputs);
	return (
		<div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px]">
			<p className="w-full text-muted">Share of your week</p>
			{inputs.models.map((family) => (
				<label key={family} className="flex items-center gap-2 text-fg">
					{familyName(family)}
					<NumberField
						value={Number(modelWeight(inputs, family).toFixed(1))}
						invalid={invalid.includes(shareField(family))}
						errorId={errorId(family)}
						onChange={(entry) => onEntry(shareField(family), entry)}
						className="min-h-11 w-20"
					/>
					<span className="text-muted">%</span>
				</label>
			))}
			{rejected.map((family) => (
				<FieldError key={family} id={errorId(family)}>
					Enter a share above 0% for {familyName(family)}.
				</FieldError>
			))}
			{counted && <p className="w-full text-[12px] text-subtle">{counted}</p>}
		</div>
	);
}

/** The second question's answer: an amount a week, in a unit, at an effort. */
export function UsageField({
	inputs,
	invalid,
	benchmarkName,
	onChange,
	onEntry,
}: {
	inputs: FitInputs;
	invalid: readonly QuizField[];
	benchmarkName: string;
	onChange: Patch;
	onEntry: Entered;
}) {
	const id = useId();
	const errorId = `${id}-error`;
	return (
		<div className="flex flex-col gap-2">
			<label htmlFor={id} className="text-[13px] text-muted">
				{inputs.unit === "apiUsd"
					? "API-priced spend a week, as ccusage reports it"
					: `${benchmarkName} tasks a week`}
			</label>
			<div className="flex flex-wrap items-center gap-x-6 gap-y-2">
				<NumberField
					id={id}
					value={inputs.amount}
					invalid={invalid.includes("amount")}
					errorId={errorId}
					onChange={(entry) => onEntry("amount", entry)}
					className="min-h-11 w-32 text-[16px]"
				/>
				<Segmented
					label="Usage unit"
					options={UNIT_OPTIONS}
					value={inputs.unit}
					onChange={(unit) => onChange(unitChange(unit))}
				/>
				{inputs.unit === "tasks" && (
					<Segmented
						label="Reasoning effort"
						options={EFFORT_OPTIONS}
						value={inputs.effort}
						onChange={(effort) => onChange({ effort })}
					/>
				)}
			</div>
			{invalid.includes("amount") && (
				<FieldError id={errorId}>Enter an amount above 0.</FieldError>
			)}
		</div>
	);
}

/** The last question's answer: an optional monthly budget. */
export function BudgetField({
	budget,
	invalid,
	onEntry,
}: {
	budget: number | null;
	invalid: readonly QuizField[];
	onEntry: Entered;
}) {
	const id = useId();
	const errorId = `${id}-error`;
	return (
		<div className="flex flex-col gap-2 text-[13px]">
			<label htmlFor={id} className="text-muted">
				Monthly budget<span className="sr-only"> in dollars</span>{" "}
				<span className="text-subtle">(optional)</span>
			</label>
			<div className="flex items-center gap-2">
				<span aria-hidden="true" className="text-[16px] text-muted">
					$
				</span>
				<NumberField
					id={id}
					value={budget}
					invalid={invalid.includes("budget")}
					errorId={errorId}
					placeholder="No limit"
					onChange={(entry) => onEntry("budget", entry)}
					className="min-h-11 w-32 text-[16px]"
				/>
			</div>
			{invalid.includes("budget") && (
				<FieldError id={errorId}>
					A budget must be above $0. Clear the field for no limit.
				</FieldError>
			)}
		</div>
	);
}
