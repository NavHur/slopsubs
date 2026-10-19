const TEXT_INPUT_TYPES = [
	"text",
	"search",
	"email",
	"url",
	"tel",
	"password",
	"number",
];
const TEXT_ENTRY = [
	"textarea",
	"select",
	"input:not([type])",
	...TEXT_INPUT_TYPES.map((type) => `input[type=${type}]`),
].join(", ");

/** Whether the event target is, or sits inside, a control that takes typed text. */
export function isTextEntryTarget(target: EventTarget | null): boolean {
	if (!(target instanceof HTMLElement)) return false;
	return target.isContentEditable || target.closest(TEXT_ENTRY) !== null;
}
