// Serialized as source by page.evaluate: the function may use only itself and
// browser globals, never module constants or helpers.

type PickerBand = { picker: string; fadePx: number; slackPx: number };

/** How far the pressed benchmark sits inside the picker's unfaded band;
 * negative means part of it is faded or hidden. */
export const readPickerClearance = ({
	picker,
	fadePx,
	slackPx,
}: PickerBand) => {
	const fieldset = document.querySelector(picker);
	const row = fieldset?.parentElement;
	const pressed = fieldset?.querySelector("[aria-pressed=true]");
	if (!row || !pressed) throw new Error("No benchmark picker");
	const box = row.getBoundingClientRect();
	const target = pressed.getBoundingClientRect();
	const maxScroll = row.scrollWidth - row.clientWidth;
	const fadeStart = row.scrollLeft > slackPx ? fadePx : 0;
	const fadeEnd = row.scrollLeft < maxScroll - slackPx ? fadePx : 0;
	return Math.min(
		target.left - (box.left + fadeStart),
		box.right - fadeEnd - target.right,
	);
};
