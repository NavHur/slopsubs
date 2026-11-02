import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vite-plus/test";
import { createFakeObservers, type FakeBox } from "./fakeIntersectionObserver";
import {
	observeAcrossResizes,
	observeSections,
	SCROLL_END_ID,
	sectionInView,
} from "./useSectionNav";

const VIEWPORT = 1000;
const SCROLLER_TOP = 100;
const READING_LINE_PX = 400;
// Content offsets (from the top of the scrolling content) and heights.
const SECTIONS = [
	{ id: "cost", offset: 0, height: 800 },
	{ id: "tasks", offset: 800, height: 300 },
	{ id: "ranked", offset: 1100, height: 1500 },
] as const;
const CONTENT_HEIGHT = 2601;
type Id = (typeof SECTIONS)[number]["id"];
const ids = SECTIONS.map((s) => s.id);

type Layout = "page" | "scroller";

/** A page scrolled by `world.setScroll`, in the page or in a scroller below a header. */
function buildWorld(initial: Layout) {
	let layout = initial;
	let scrollY = 0;
	const headerHeight = () => (layout === "scroller" ? SCROLLER_TOP : 0);
	const clientHeight = () => VIEWPORT - headerHeight();
	const scroller = {
		id: "scroller",
		overflowY: "auto",
		span: () => ({ top: headerHeight(), bottom: VIEWPORT }),
		getBoundingClientRect: () => ({ top: headerHeight() }),
		clientTop: 0,
		get clientHeight() {
			return clientHeight();
		},
		scrollHeight: CONTENT_HEIGHT,
	};
	const element = (id: string, offset: number, height: number) => ({
		id,
		get parentElement() {
			return layout === "scroller" ? scroller : null;
		},
		span: () => ({
			top: headerHeight() + offset - scrollY,
			bottom: headerHeight() + offset + height - scrollY,
		}),
		get clip() {
			return layout === "scroller" ? scroller.span() : undefined;
		},
	});
	const elements = new Map<string, FakeBox & { id: string }>([
		...SECTIONS.map((s) => [s.id, element(s.id, s.offset, s.height)] as const),
		[SCROLL_END_ID, element(SCROLL_END_ID, CONTENT_HEIGHT - 1, 1)],
	]);
	const page = { scrollHeight: CONTENT_HEIGHT, clientHeight: VIEWPORT };
	return {
		elements,
		scroller,
		page,
		maxScroll: () => CONTENT_HEIGHT - clientHeight(),
		setScroll: (y: number) => (scrollY = y),
		/** Where `offset` into the content must scroll to for its top to sit at `top`. */
		scrollFor: (offset: number, top: number) => headerHeight() + offset - top,
		setLayout: (next: Layout) => (layout = next),
	};
}

function stubBrowser(world: ReturnType<typeof buildWorld>) {
	const fake = createFakeObservers(() => VIEWPORT);
	vi.stubGlobal("IntersectionObserver", fake.FakeIntersectionObserver);
	const resizeListeners = new Set<() => void>();
	vi.stubGlobal("window", {
		innerHeight: VIEWPORT,
		addEventListener: (type: string, listener: () => void) => {
			if (type === "resize") resizeListeners.add(listener);
		},
		removeEventListener: (type: string, listener: () => void) => {
			if (type === "resize") resizeListeners.delete(listener);
		},
	});
	vi.stubGlobal("getComputedStyle", (el: { overflowY?: string }) => ({
		overflowY: el.overflowY ?? "visible",
	}));
	vi.stubGlobal("document", {
		getElementById: (id: string) => world.elements.get(id) ?? null,
		scrollingElement: world.page,
		documentElement: world.page,
	});
	return {
		...fake,
		resize: () => {
			for (const listener of resizeListeners) listener();
		},
	};
}

describe.each<Layout>(["page", "scroller"])(
	"observeSections in the %s",
	(layout) => {
		const world = buildWorld(layout);
		let fake: ReturnType<typeof stubBrowser>;
		let tracker: ReturnType<typeof observeSections<Id>>;

		beforeEach(() => {
			world.setLayout(layout);
			world.setScroll(0);
			fake = stubBrowser(world);
			tracker = observeSections(ids, () => {});
			fake.deliver();
		});

		afterEach(() => {
			tracker.stop();
			vi.unstubAllGlobals();
		});

		/** Scrolls to `y` and says which section the tracker reports. */
		const scrollTo = (y: number) => {
			world.setScroll(y === Infinity ? world.maxScroll() : y);
			fake.deliver();
			return sectionInView(ids, tracker.seen);
		};

		it("follows a reader scrolling down in small steps", () => {
			const steps = [0, 300, 500, 650, 1000, 1300, Infinity];
			expect(steps.map(scrollTo)).toEqual([
				"cost",
				"cost",
				"tasks",
				"tasks",
				"ranked",
				"ranked",
				"ranked",
			]);
		});

		it("lands on the last section after a jump straight down over one", () => {
			expect(scrollTo(1300)).toBe("ranked");
		});

		it("lands on the first section after a jump straight up over a middle one", () => {
			for (const y of [500, 700, 1300]) scrollTo(y);
			expect(scrollTo(0)).toBe("cost");
		});

		it("lands on the first section after a jump from the end to the top", () => {
			for (const y of [500, 1300, Infinity]) scrollTo(y);
			expect(scrollTo(0)).toBe("cost");
		});

		it("lands on the middle section after a jump from the end up to it", () => {
			for (const y of [500, 1300, Infinity]) scrollTo(y);
			expect(scrollTo(500)).toBe("tasks");
		});

		it("puts the reading line at 40% of the window, not of the scroller", () => {
			const tasks = SECTIONS[1].offset;
			const justBelow = world.scrollFor(tasks, READING_LINE_PX + 1);
			const justAbove = world.scrollFor(tasks, READING_LINE_PX - 1);
			expect([scrollTo(justBelow), scrollTo(justAbove)]).toEqual([
				"cost",
				"tasks",
			]);
		});
	},
);

describe("observeAcrossResizes when the window crosses the scroller breakpoint", () => {
	const world = buildWorld("scroller");
	let stop = () => {};

	afterEach(() => {
		stop();
		vi.unstubAllGlobals();
	});

	it("keeps the reading line right after the page stops scrolling in the scroller", () => {
		const browser = stubBrowser(world);
		const tracker = observeAcrossResizes(ids, () => {});
		stop = tracker.stop;
		browser.deliver();

		world.setLayout("page");
		browser.resize();
		browser.deliver();
		for (const [y, expected] of [
			[0, "cost"],
			[1300, "ranked"],
			[500, "tasks"],
		] as const) {
			world.setScroll(y);
			browser.deliver();
			expect(sectionInView(ids, tracker.seen)).toBe(expected);
		}
	});

	it("does not remake its observers while a resize leaves them current", () => {
		const browser = stubBrowser(world);
		world.setLayout("scroller");
		const tracker = observeAcrossResizes(ids, () => {});
		stop = tracker.stop;
		browser.deliver();
		const before = vi.fn();
		vi.stubGlobal("IntersectionObserver", before);
		browser.resize();
		expect(before).not.toHaveBeenCalled();
	});
});
