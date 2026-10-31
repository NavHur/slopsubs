import type { KeyboardEvent } from "react";

/** The tab id for `value`, which its panel names in aria-labelledby. */
export function tabId(value: string): string {
	return `tab-${value}`;
}

/** Index a tab key moves to from `index`, or null for other keys. */
function nextIndex(key: string, index: number, count: number): number | null {
	switch (key) {
		case "ArrowRight":
			return (index + 1) % count;
		case "ArrowLeft":
			return (index - 1 + count) % count;
		case "Home":
			return 0;
		case "End":
			return count - 1;
		default:
			return null;
	}
}

/**
 * A row of tabs that select as focus moves, per the ARIA tabs pattern: one tab
 * stop, arrow keys between tabs. The panel is the caller's, labelled by
 * `tabId(value)` and identified by `panelId`.
 */
export function Tabs<T extends string>({
	label,
	options,
	value,
	panelId,
	onChange,
}: {
	label: string;
	options: readonly { value: T; label: string }[];
	value: T;
	panelId: string;
	onChange: (value: T) => void;
}) {
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const index = options.findIndex((o) => o.value === value);
		const next = nextIndex(event.key, index, options.length);
		if (next === null) return;
		event.preventDefault();
		onChange(options[next].value);
		document.getElementById(tabId(options[next].value))?.focus();
	};
	return (
		// oxlint-disable-next-line jsx-a11y/interactive-supports-focus -- the tabs take focus (roving tabindex), not the list
		<div
			role="tablist"
			aria-label={label}
			onKeyDown={onKeyDown}
			className="flex gap-6"
		>
			{options.map((option) => {
				const selected = option.value === value;
				return (
					<button
						key={option.value}
						id={tabId(option.value)}
						type="button"
						role="tab"
						aria-selected={selected}
						aria-controls={panelId}
						tabIndex={selected ? 0 : -1}
						onClick={() => onChange(option.value)}
						className="-mb-px whitespace-nowrap border-b-2 border-transparent pt-3 pb-2.5 text-[14px] text-muted transition-colors hover:text-fg aria-selected:border-accent aria-selected:font-medium aria-selected:text-fg max-lg:min-h-11"
					>
						{option.label}
					</button>
				);
			})}
		</div>
	);
}
