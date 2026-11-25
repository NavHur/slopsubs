import { cn } from "cn";
import { type ReactNode, useState } from "react";
import { type FieldEntry, parseEntry } from "#/lib/fitQuiz";

function fieldText(value: number | null): string {
	return value === null ? "" : String(value);
}

/** Whether the text says what `value` and `invalid` say the field holds. */
function agrees(
	entry: FieldEntry,
	value: number | null,
	invalid: boolean,
): boolean {
	if (invalid) return entry.kind !== "number";
	if (entry.kind === "number") return entry.value === value;
	return entry.kind === "blank" && value === null;
}

/** The text in the field: kept as typed, and replaced when `value` or `invalid`
 * change in a way the text doesn't already say. */
function useFieldText(value: number | null, invalid: boolean) {
	const [text, setText] = useState(invalid ? "" : fieldText(value));
	const [seen, setSeen] = useState({ value, invalid });
	if (value !== seen.value || invalid !== seen.invalid) {
		setSeen({ value, invalid });
		if (!agrees(parseEntry(text), value, invalid)) setText(fieldText(value));
	}
	return [text, setText] as const;
}

/** What's wrong with a number field, under it; the field points to it by `id`. */
export function FieldError({
	id,
	children,
}: {
	id: string;
	children: ReactNode;
}) {
	return (
		<p id={id} role="alert" className="w-full text-[12px] text-worse">
			{children}
		</p>
	);
}

/**
 * A number input that keeps what the visitor is typing ("1.", "") and reports
 * it as an entry. It follows `value` and `invalid` when they change from
 * outside, as when a shared link's view replaces the prerendered one.
 */
export function NumberField({
	id,
	value,
	invalid,
	errorId,
	onChange,
	placeholder,
	className = "",
}: {
	id?: string;
	value: number | null;
	/** The text is no answer: marks the field, and `errorId` names why. */
	invalid: boolean;
	errorId: string;
	onChange: (entry: FieldEntry) => void;
	placeholder?: string;
	className?: string;
}) {
	const [text, setText] = useFieldText(value, invalid);
	return (
		<input
			id={id}
			type="number"
			inputMode="decimal"
			min={0}
			step="any"
			placeholder={placeholder}
			aria-invalid={invalid || undefined}
			aria-describedby={invalid ? errorId : undefined}
			value={text}
			onChange={(e) => {
				setText(e.target.value);
				onChange(parseEntry(e.target.value, e.target.validity.badInput));
			}}
			className={cn(
				"rounded-sm border border-line bg-panel px-2 py-1 text-fg tabular-nums aria-invalid:border-worse max-lg:min-h-11",
				className,
			)}
		/>
	);
}
