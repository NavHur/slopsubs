import { describe, expect, it } from "vite-plus/test";
import { FADE_PX, revealScrollLeft } from "./ScrollRow";

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
