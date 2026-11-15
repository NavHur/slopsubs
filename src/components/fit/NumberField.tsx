import { useState } from "react";

/** A positive number from a field, or null while it's empty or invalid. */
export function parsePositive(text: string): number | null {
	const value = Number(text);
	return text.trim() !== "" && Number.isFinite(value) && value > 0
		? value
		: null;
}

function fieldText(value: number | null): string {
	return value === null ? "" : String(value);
}

/**
 * A number input that keeps what the visitor is typing ("1.", "") while
 * reporting only positive numbers, and follows `value` when it changes from
 * outside, as when a shared link's view replaces the prerendered one.
 */
export function NumberField({
	id,
	value,
	onChange,
	placeholder,
	className = "",
	"aria-label": ariaLabel,
}: {
	id?: string;
	value: number | null;
	onChange: (value: number | null) => void;
	placeholder?: string;
	className?: string;
	"aria-label"?: string;
}) {
	const [draft, setDraft] = useState(fieldText(value));
	const [shown, setShown] = useState(value);
	// A new value from outside replaces the draft, unless the draft says it.
	if (value !== shown) {
		setShown(value);
		if (parsePositive(draft) !== value) setDraft(fieldText(value));
	}
	return (
		<input
			id={id}
			type="number"
			inputMode="decimal"
			min={0}
			step="any"
			placeholder={placeholder}
			aria-label={ariaLabel}
			value={draft}
			onChange={(e) => {
				setDraft(e.target.value);
				onChange(parsePositive(e.target.value));
			}}
			className={`rounded-sm border border-line bg-panel px-2 py-1 text-fg tabular-nums max-lg:min-h-11 ${className}`}
		/>
	);
}
