/**
 * A model's brand colour beside its name. Names stay in the text colour,
 * since several brand colours fall below 4.5:1 as text. It is an SVG so the
 * PNG export draws it.
 */
export function ColorDot({ color }: { color: string }) {
	return (
		<svg aria-hidden="true" viewBox="0 0 8 8" className="size-2 shrink-0">
			<circle cx="4" cy="4" r="4" fill={color} />
		</svg>
	);
}
