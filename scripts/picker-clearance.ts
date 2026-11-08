type PickerBand = { picker: string; fade: number; slack: number };

export const readPickerClearance = ({ picker, fade, slack }: PickerBand) => {
	const fieldset = document.querySelector(picker);
	const row = fieldset?.parentElement;
	const pressed = fieldset?.querySelector("[aria-pressed=true]");
	if (!row || !pressed) throw new Error("No benchmark picker");
	const box = row.getBoundingClientRect();
	const target = pressed.getBoundingClientRect();
	const maxScroll = row.scrollWidth - row.clientWidth;
	const fadeStart = row.scrollLeft > slack ? fade : 0;
	const fadeEnd = row.scrollLeft < maxScroll - slack ? fade : 0;
	return Math.min(
		target.left - (box.left + fadeStart),
		box.right - fadeEnd - target.right,
	);
};
