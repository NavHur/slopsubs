import { describe, expect, it } from "vite-plus/test";
import { sectionInView } from "./useSectionNav";

const ids = ["cost", "tasks", "ranked"] as const;
type Id = (typeof ids)[number];

function seen(reached: Partial<Record<Id, boolean>>, atEnd = false) {
	return {
		reached: new Map(Object.entries(reached)) as Map<Id, boolean>,
		atEnd,
	};
}

describe("sectionInView", () => {
	it("picks the last section whose top reached the line", () => {
		const page = seen({ cost: true, tasks: true, ranked: false });
		expect(sectionInView(ids, page)).toBe("tasks");
	});

	it("picks the last section once the scroller is at its end", () => {
		// A short last section: its top stays below the line even at the end.
		const page = seen({ cost: true, tasks: true, ranked: false }, true);
		expect(sectionInView(ids, page)).toBe("ranked");
	});

	it("falls back to the first section above everything", () => {
		const page = seen({ cost: false, tasks: false, ranked: false });
		expect(sectionInView(ids, page)).toBe("cost");
	});

	it("skips sections that are not rendered", () => {
		const page = seen({ cost: true, tasks: true }, true);
		expect(sectionInView(ids, page)).toBe("tasks");
	});

	it("has nothing in view before any section is seen", () => {
		expect(sectionInView(ids, seen({}))).toBeUndefined();
	});
});
