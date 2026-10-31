import { useId } from "react";
import { REASONING_LEVELS, type ReasoningLevel, toggled } from "#/lib/view";
import { Chip } from "./Segmented";

/**
 * Slopalytics' Code only: scores on the coding evals alone, which drops the
 * models never run on them. A tab that scores coding already has it fixed on.
 */
export function CodeOnlyFilter({
	checked,
	applies,
	onChange,
}: {
	checked: boolean;
	/** Whether the tab has a coding-only score to swap in. */
	applies: boolean;
	onChange: (checked: boolean) => void;
}) {
	const noteId = useId();
	const on = checked || !applies;
	return (
		<div className="mb-4">
			<label
				className={`flex items-center gap-2 text-[13px] max-lg:min-h-11 max-lg:text-[15px] ${applies ? "cursor-pointer text-muted hover:text-fg" : "text-subtle"}`}
			>
				<input
					type="checkbox"
					checked={on}
					disabled={!applies}
					aria-describedby={noteId}
					onChange={(event) => onChange(event.target.checked)}
					className="size-3.5 accent-accent"
				/>
				<span className={on && applies ? "text-fg" : undefined}>Code only</span>
			</label>
			<p id={noteId} className="pl-5.5 text-[11px] leading-4 text-subtle">
				{applies
					? "Score on Terminal-Bench 4.0 and FrontierCode 2.0 alone"
					: "FrontierCode scores coding already"}
			</p>
		</div>
	);
}

export function ReasoningFilter({
	hidden,
	onChange,
}: {
	hidden: readonly ReasoningLevel[];
	onChange: (hidden: ReasoningLevel[]) => void;
}) {
	const toggle = (level: ReasoningLevel) => {
		const next = toggled(hidden, level);
		onChange(REASONING_LEVELS.filter((l) => next.includes(l)));
	};
	return (
		<fieldset aria-label="Reasoning" className="mb-4">
			<h3 className="mb-1 text-[12px] font-medium text-subtle">Reasoning</h3>
			<div className="flex flex-wrap gap-x-2.5 max-lg:gap-x-4">
				{REASONING_LEVELS.map((level) => (
					<Chip
						key={level}
						label={level}
						on={!hidden.includes(level)}
						onClick={() => toggle(level)}
						className="line-through aria-pressed:no-underline"
					/>
				))}
			</div>
		</fieldset>
	);
}
