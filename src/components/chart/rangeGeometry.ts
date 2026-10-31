import { type ScaleLogarithmic, scaleLog } from "d3-scale";

/** Below this width a row's label and value sit above its track. */
const COMPACT_WIDTH = 640;
export const LABEL_COLUMN_PX = 210;
export const VALUE_COLUMN_PX = 120;
export const COLUMN_GAP_PX = 12;
/** Keeps the end dots whole inside the track. */
const DOT_INSET_PX = 8;
/** Narrowest spacing between tick labels. */
const MIN_TICK_SPACING_PX = 56;
/** Room around the extreme values, as a factor on the log scale. */
const DOMAIN_PADDING = 1.25;

export type RangeLayout = {
	compact: boolean;
	/** Width of the strip the dots are drawn on. */
	trackWidth: number;
	/** CSS grid columns of a row: label, track, value; or label and
	 * value over a full-width track when compact. */
	columns: string;
};

export function rangeLayout(width: number): RangeLayout {
	if (width < COMPACT_WIDTH) {
		return { compact: true, trackWidth: width, columns: "1fr auto" };
	}
	return {
		compact: false,
		trackWidth: Math.max(
			0,
			width - LABEL_COLUMN_PX - VALUE_COLUMN_PX - 2 * COLUMN_GAP_PX,
		),
		columns: `${LABEL_COLUMN_PX}px 1fr ${VALUE_COLUMN_PX}px`,
	};
}

export type RangeScale = ScaleLogarithmic<number, number>;

/** A log scale over every value, padded so no dot sits on the edge. */
export function rangeScale(
	values: readonly number[],
	trackWidth: number,
): RangeScale {
	const low = Math.min(...values);
	const high = Math.max(...values);
	return scaleLog()
		.domain([low / DOMAIN_PADDING, high * DOMAIN_PADDING])
		.range([DOT_INSET_PX, Math.max(DOT_INSET_PX, trackWidth - DOT_INSET_PX)]);
}

/** Tick sets from densest to sparsest, as multiples of each power of ten. */
const TICK_MULTIPLES = [[1, 2, 5], [1, 3], [1]];

/**
 * The densest set of round log ticks whose labels keep their distance,
 * falling back to every other power of ten and beyond on narrow tracks.
 */
export function rangeTicks(x: RangeScale): number[] {
	const [lo, hi] = x.domain();
	const [left, right] = x.range();
	const fit = Math.max(2, Math.floor((right - left) / MIN_TICK_SPACING_PX));
	for (const multiples of TICK_MULTIPLES) {
		const ticks = roundValues(lo, hi, multiples);
		if (ticks.length > 0 && ticks.length <= fit) return ticks;
	}
	// A domain inside one decade can hold none of the round multiples.
	const decades = roundValues(lo, hi, [1]);
	return thin(decades.length > 0 ? decades : x.ticks(fit), fit);
}

/** Every nth value, so at most `limit` remain. */
function thin(values: number[], limit: number): number[] {
	const stride = Math.ceil(values.length / limit);
	return values.filter((_, i) => i % stride === 0);
}

function roundValues(lo: number, hi: number, multiples: number[]): number[] {
	const values: number[] = [];
	for (let exp = Math.floor(Math.log10(lo)); exp <= Math.log10(hi); exp++) {
		for (const m of multiples) {
			const value = m * 10 ** exp;
			if (value >= lo && value <= hi) values.push(Number(value.toPrecision(1)));
		}
	}
	return values;
}
