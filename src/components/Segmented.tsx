export function Segmented<T extends string>({
	label,
	options,
	value,
	onChange,
}: {
	label: string;
	options: readonly { value: T; label: string }[];
	value: T;
	onChange: (value: T) => void;
}) {
	return (
		<fieldset aria-label={label} className="flex items-center gap-4">
			{options.map((option) => (
				<button
					key={option.value}
					type="button"
					aria-pressed={option.value === value}
					onClick={() => onChange(option.value)}
					className="whitespace-nowrap border-b border-transparent py-1 text-[13px] max-lg:min-h-11 text-muted transition-colors hover:text-fg aria-pressed:border-fg/60 aria-pressed:text-fg"
				>
					{option.label}
				</button>
			))}
		</fieldset>
	);
}

export function Toggle({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<label className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-[13px] text-muted hover:text-fg max-lg:min-h-11">
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
				className="size-3.5 accent-accent"
			/>
			{label}
		</label>
	);
}

/** A small text toggle, dimmed when off. */
export function Chip({
	label,
	on,
	onClick,
	className = "",
}: {
	label: string;
	on: boolean;
	onClick: () => void;
	className?: string;
}) {
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={onClick}
			className={`text-[12px] text-subtle hover:text-fg aria-pressed:text-fg max-lg:min-h-11 max-lg:text-[14px] ${className}`}
		>
			{label}
		</button>
	);
}
