/**
 * A model's brand colour beside its name. Names stay in the text colour,
 * since several brand colours fall below 4.5:1 as text.
 */
export function ColorDot({ color }: { color: string }) {
	return (
		<span
			aria-hidden="true"
			className="size-2 shrink-0 rounded-full"
			style={{ backgroundColor: color }}
		/>
	);
}
