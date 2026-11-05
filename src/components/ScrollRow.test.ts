import { describe, expect, it } from "vite-plus/test";
import { FADE_PX, revealScrollLeft, wheelScrollLeft } from "./ScrollRow";

const row = { scrollLeft: 100, clientWidth: 300, margin: FADE_PX };

describe("revealScrollLeft", () => {
	it("clears the fade when the control is past the right edge", () => {
		const target = { left: 450, width: 80 };
		const next = revealScrollLeft({ ...row, ...target });
		expect(
			next + row.clientWidth - (target.left + target.width),
		).toBeGreaterThanOrEqual(FADE_PX);
		expect(next).toBeGreaterThan(row.scrollLeft);
	});

	it("clears the fade when the control is past the left edge", () => {
		const target = { left: 40, width: 80 };
		const next = revealScrollLeft({ ...row, ...target });
		expect(target.left - next).toBeGreaterThanOrEqual(FADE_PX);
		expect(next).toBeLessThan(row.scrollLeft);
	});

	it("leaves scrollLeft alone when the control is in the unfaded area", () => {
		const next = revealScrollLeft({ ...row, left: 150, width: 80 });
		expect(next).toBe(row.scrollLeft);
	});

	it("moves a control sitting under the fade clear of it", () => {
		const next = revealScrollLeft({ ...row, left: 105, width: 80 });
		expect(105 - next).toBeGreaterThanOrEqual(FADE_PX);
	});

	it("never asks for a negative scrollLeft at the first control", () => {
		expect(revealScrollLeft({ ...row, left: 0, width: 80 })).toBe(0);
	});
});

describe("wheelScrollLeft", () => {
	const wheel = { deltaX: 0, deltaY: 100, deltaMode: 0, ctrlKey: false };
	const middle = { scrollLeft: 200, scrollWidth: 1221, clientWidth: 647 };

	it("scrolls the row right on a wheel down and left on a wheel up", () => {
		expect(wheelScrollLeft(wheel, middle)).toBe(300);
		expect(wheelScrollLeft({ ...wheel, deltaY: -100 }, middle)).toBe(100);
	});

	it("stops at the end instead of overshooting", () => {
		const nearEnd = { ...middle, scrollLeft: 550 };
		expect(wheelScrollLeft(wheel, nearEnd)).toBe(574);
	});

	it("hands a push past a reached end to the page", () => {
		expect(wheelScrollLeft(wheel, { ...middle, scrollLeft: 574 })).toBeNull();
		const atStart = { ...middle, scrollLeft: 0 };
		expect(wheelScrollLeft({ ...wheel, deltaY: -100 }, atStart)).toBeNull();
	});

	it("leaves a row with nothing hidden to the page", () => {
		const fits = { scrollLeft: 0, scrollWidth: 400, clientWidth: 647 };
		expect(wheelScrollLeft(wheel, fits)).toBeNull();
	});

	it("leaves sideways gestures and pinches to the browser", () => {
		expect(wheelScrollLeft({ ...wheel, deltaX: 120 }, middle)).toBeNull();
		expect(wheelScrollLeft({ ...wheel, ctrlKey: true }, middle)).toBeNull();
	});

	it("converts line-mode steps to pixels", () => {
		const lines = { ...wheel, deltaY: 3, deltaMode: 1 };
		expect(wheelScrollLeft(lines, middle)).toBe(248);
	});
});
