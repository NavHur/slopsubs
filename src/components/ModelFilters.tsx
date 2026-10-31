import { REASONING_LEVELS, type ReasoningLevel, toggled } from "#/lib/view";
import { Chip } from "./Segmented";

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
