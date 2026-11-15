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
	unitChange,
} from "#/lib/fit";
import { Chip, Segmented } from "../Segmented";
import { NumberField } from "./NumberField";

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

/** The three things the visitor tells the section: models, usage, budget. */
export function FitControls({
	inputs,
	benchmarkName,
	onChange,
}: {
	inputs: FitInputs;
	benchmarkName: string;
	onChange: Patch;
}) {
	return (
		<div className="flex flex-col gap-4">
			<ModelPicker inputs={inputs} onChange={onChange} />
			<UsageField
				inputs={inputs}
				benchmarkName={benchmarkName}
				onChange={onChange}
			/>
			<BudgetField budget={inputs.budget} onChange={onChange} />
		</div>
	);
}

function ModelPicker({
	inputs,
	onChange,
}: {
	inputs: FitInputs;
	onChange: Patch;
}) {
	const pick = (family: FamilyId) => {
		const patch = modelToggle(inputs, family);
		if (patch) onChange(patch);
	};
	return (
		<fieldset className="flex flex-col gap-2">
			<legend className="mb-2 text-[13px] text-muted">Models you use</legend>
			<div className="flex flex-wrap gap-x-4 gap-y-1">
				<Chip
					label="Any flagship"
					on={inputs.any}
					onClick={() => onChange({ any: !inputs.any })}
				/>
				{FIT_FAMILIES.map((family) => (
					<Chip
						key={family}
						label={familyName(family)}
						on={!inputs.any && inputs.models.includes(family)}
						onClick={() => pick(family)}
					/>
				))}
			</div>
			{!inputs.any && inputs.models.length > 1 && (
				<ShareFields inputs={inputs} onChange={onChange} />
			)}
		</fieldset>
	);
}

/** Each model's part of the week, as weights scaled to add up to 100%. */
function ShareFields({
	inputs,
	onChange,
}: {
	inputs: FitInputs;
	onChange: Patch;
}) {
	const equal = Math.round(100 / inputs.models.length);
	return (
		<div className="flex flex-wrap gap-x-4 gap-y-2 text-[13px]">
			{inputs.models.map((family) => (
				<label key={family} className="flex items-center gap-2 text-muted">
					{familyName(family)}
					<NumberField
						value={inputs.weights[family] ?? equal}
						onChange={(weight) => {
							if (weight !== null) {
								onChange({ weights: { ...inputs.weights, [family]: weight } });
							}
						}}
						className="w-16"
					/>
					%
				</label>
			))}
		</div>
	);
}

function UsageField({
	inputs,
	benchmarkName,
	onChange,
}: {
	inputs: FitInputs;
	benchmarkName: string;
	onChange: Patch;
}) {
	const id = useId();
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
					onChange={(amount) => {
						if (amount !== null) onChange({ amount });
					}}
					className="w-28 text-[15px]"
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
		</div>
	);
}

function BudgetField({
	budget,
	onChange,
}: {
	budget: number | null;
	onChange: Patch;
}) {
	const id = useId();
	return (
		<div className="flex items-center gap-2 text-[13px]">
			<label htmlFor={id} className="text-muted">
				Monthly budget<span className="sr-only"> in dollars</span>{" "}
				<span className="text-subtle">(optional)</span>
			</label>
			<span aria-hidden="true" className="ml-1 text-muted">
				$
			</span>
			<NumberField
				id={id}
				value={budget}
				placeholder="No limit"
				onChange={(next) => onChange({ budget: next ?? undefined })}
				className="w-24"
			/>
		</div>
	);
}
