import { describe, expect, it } from "vite-plus/test";
import { isAtEnd, sectionInView } from "./useSectionNav";

const LINE = 360;
// Short last section: its top (613) stays below the line even at the end.
const sections = [
	{ id: "cost", top: -900 },
	{ id: "tasks", top: -300 },
	{ id: "ranked", top: 613 },
] as const;

describe("sectionInView", () => {
	it("picks the last section whose top reached the line", () => {
		expect(sectionInView(sections, LINE, false)).toBe("tasks");
	});

	it("picks the last section once the scroller is at its end", () => {
		expect(sectionInView(sections, LINE, true)).toBe("ranked");
	});

	it("falls back to the first section above everything", () => {
		const below = sections.map((s) => ({ ...s, top: s.top + 2000 }));
		expect(sectionInView(below, LINE, false)).toBe("cost");
	});
});

describe("isAtEnd", () => {
	it("is true within a pixel of the bottom", () => {
		const s = { scrollTop: 1599.5, clientHeight: 900, scrollHeight: 2500 };
		expect(isAtEnd(s)).toBe(true);
	});

	it("is false mid-scroll", () => {
		const s = { scrollTop: 500, clientHeight: 900, scrollHeight: 2500 };
		expect(isAtEnd(s)).toBe(false);
	});

	it("is false when nothing scrolls", () => {
		const s = { scrollTop: 0, clientHeight: 900, scrollHeight: 900 };
		expect(isAtEnd(s)).toBe(false);
	});
});
