/**
 * One answer of a pick-all-that-apply question: a full-width target with a
 * check box drawn beside its label, so several can plainly be on at once.
 */
export function QuizOption({
	label,
	on,
	onClick,
}: {
	label: string;
	on: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			aria-pressed={on}
			onClick={onClick}
			className="group flex min-h-11 items-center gap-2.5 rounded-sm border border-grid px-3 text-left text-[14px] text-muted transition-colors hover:border-subtle hover:text-fg aria-pressed:border-fg/60 aria-pressed:text-fg"
		>
			<svg
				aria-hidden="true"
				width={14}
				height={14}
				viewBox="0 0 14 14"
				className="shrink-0 text-subtle group-aria-pressed:text-fg"
			>
				<rect
					x={0.5}
					y={0.5}
					width={13}
					height={13}
					rx={2}
					fill={on ? "currentColor" : "none"}
					stroke="currentColor"
				/>
				{on && (
					<path
						d="M3.75 7.25 6 9.5l4.25-4.75"
						fill="none"
						stroke="var(--bg)"
						strokeWidth={1.5}
						strokeLinecap="round"
						strokeLinejoin="round"
					/>
				)}
			</svg>
			{label}
		</button>
	);
}
