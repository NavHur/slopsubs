import { PROVIDER_MARKS } from "./providerMarks";

/**
 * A lab's mark, drawn in the surrounding text color (Google keeps its own
 * colors). Works in HTML and, with `x`/`y`, inside a chart's SVG. Renders
 * nothing for a lab without a mark.
 */
export function ProviderLogo({
	lab,
	size = 14,
	x,
	y,
}: {
	lab: string;
	size?: number;
	x?: number;
	y?: number;
}) {
	const paths = PROVIDER_MARKS[lab];
	if (!paths) return null;
	return (
		<svg
			viewBox="0 0 24 24"
			width={size}
			height={size}
			x={x}
			y={y}
			fill="currentColor"
			fillRule="evenodd"
			aria-hidden="true"
			focusable="false"
			className="shrink-0"
		>
			{paths.map((p) => (
				<path key={p.d} d={p.d} fill={p.fill} />
			))}
		</svg>
	);
}
