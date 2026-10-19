import { markerPath } from "./geometry";
import { API_DASH, type PricingStyle } from "./series";

const SWATCH_WIDTH_PX = 22;
const SWATCH_HEIGHT_PX = 12;
/** Shifts API_DASH so one dash hides under the marker and one shows clear of
 * it on each side, for this swatch width. */
const API_DASH_OFFSET = 5.5;

/** A short line with its point marker, drawn the way the chart draws the pricing. */
export function PricingSwatch({ pricing }: { pricing: PricingStyle }) {
	const middle = SWATCH_HEIGHT_PX / 2;
	return (
		<svg
			width={SWATCH_WIDTH_PX}
			height={SWATCH_HEIGHT_PX}
			aria-hidden="true"
			className="shrink-0"
		>
			<line
				x1={1}
				x2={SWATCH_WIDTH_PX - 1}
				y1={middle}
				y2={middle}
				stroke="currentColor"
				strokeWidth={pricing.isApi ? 1.25 : 2}
				strokeDasharray={pricing.isApi ? API_DASH : undefined}
				strokeDashoffset={pricing.isApi ? API_DASH_OFFSET : undefined}
			/>
			<path
				d={markerPath(pricing.marker, SWATCH_WIDTH_PX / 2, middle, 3.5)}
				fill={pricing.isApi ? "var(--bg)" : "currentColor"}
				stroke="currentColor"
				strokeWidth={1.5}
			/>
		</svg>
	);
}

/** Keeps a row's text aligned when its pricing has no line on the chart. */
export function SwatchSpace() {
	return (
		<span
			aria-hidden="true"
			className="shrink-0"
			style={{ width: SWATCH_WIDTH_PX }}
		/>
	);
}

/**
 * Line style and point shape of each pricing, so one model's lines can be
 * told apart where the Plans panel is out of sight: below the lg breakpoint,
 * where it is a sheet, and in the exported PNG.
 */
export function PricingKey({
	pricings,
	className = "",
}: {
	pricings: readonly PricingStyle[];
	className?: string;
}) {
	if (pricings.length === 0) return null;
	return (
		<ul
			aria-label="Line styles"
			className={`flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted ${className}`}
		>
			{pricings.map((pricing) => (
				<li key={pricing.id} className="flex items-center gap-1.5">
					<PricingSwatch pricing={pricing} />
					{pricing.label}
				</li>
			))}
		</ul>
	);
}
