import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vite-plus/test";
import { createFakeObservers } from "./fakeIntersectionObserver";
import { SCROLL_END_ID, useSectionNav } from "./useSectionNav";

// No DOM environment is installed, so React's hooks are replaced by a minimal
// runner that mounts once and runs the effects, as a first render would.
const runner = vi.hoisted(() => {
	const effects: Array<() => void | (() => void)> = [];
	const runEffect = (effect: () => void | (() => void)) => {
		const cleanup = effect();
		if (cleanup) runner.cleanups.push(cleanup);
	};
	return {
		effects,
		cleanups: [] as Array<() => void>,
		mount: <R>(hook: () => R): R => {
			const result = hook();
			for (const effect of effects) runEffect(effect);
			return result;
		},
		reset: () => {
			for (const cleanup of runner.cleanups) cleanup();
			runner.cleanups.length = 0;
			effects.length = 0;
		},
	};
});

vi.mock("react", () => ({
	useState: <S>(initial: S) => [initial, () => {}],
	useRef: <S>(current: S) => ({ current }),
	useEffectEvent: <F>(fn: F) => fn,
	useEffect: (effect: () => void | (() => void)) => {
		runner.effects.push(effect);
	},
}));

const VIEWPORT = 1000;
const SECTIONS = [
	{ id: "cost", offset: 0, height: 800 },
	{ id: "tasks", offset: 800, height: 300 },
	{ id: "ranked", offset: 1100, height: 1500 },
] as const;
const ids = SECTIONS.map((s) => s.id);
type Id = (typeof ids)[number];

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** A matchMedia that matches only the reduced-motion query, and only when `reduced`. */
const motionPreference = (reduced: boolean) => (query: string) => ({
	matches: reduced && query === REDUCED_MOTION_QUERY,
});

/** A section element at `offset` that records its scroll and heading focus calls. */
function fakeElement(
	id: string,
	offset: number,
	height: number,
	scrollY: () => number,
) {
	const heading = { focus: vi.fn() };
	return {
		id,
		parentElement: null,
		heading,
		span: () => ({
			top: offset - scrollY(),
			bottom: offset + height - scrollY(),
		}),
		scrollIntoView: vi.fn(),
		querySelector: (selector: string) => (selector === "h2" ? heading : null),
	};
}

function buildBrowser() {
	let scrollY = 0;
	const fake = createFakeObservers(() => VIEWPORT);
	const element = (id: string, offset: number, height: number) =>
		fakeElement(id, offset, height, () => scrollY);
	const elements = new Map([
		...SECTIONS.map((s) => [s.id, element(s.id, s.offset, s.height)] as const),
		[SCROLL_END_ID, element(SCROLL_END_ID, 2600, 1)],
	]);
	const page = { scrollHeight: 2601, clientHeight: VIEWPORT };
	const scrollListeners = new Set<() => void>();
	vi.stubGlobal("IntersectionObserver", fake.FakeIntersectionObserver);
	vi.stubGlobal("window", {
		innerHeight: VIEWPORT,
		addEventListener: (type: string, listener: () => void) => {
			if (type === "scroll") scrollListeners.add(listener);
		},
		removeEventListener: (type: string, listener: () => void) => {
			if (type === "scroll") scrollListeners.delete(listener);
		},
		setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
		clearTimeout: (id: number) => clearTimeout(id),
	});
	vi.stubGlobal("matchMedia", motionPreference(true));
	vi.stubGlobal("getComputedStyle", () => ({ overflowY: "visible" }));
	vi.stubGlobal("document", {
		getElementById: (id: string) => elements.get(id) ?? null,
		scrollingElement: page,
		documentElement: page,
	});
	return {
		/** A rendered section's element, whose scroll and heading focus calls are recorded. */
		section: (id: Id) => elements.get(id)!,
		/** Scrolls the page to `y` and lets the observers see it. */
		scrollTo: (y: number) => {
			scrollY = y;
			fake.deliver();
		},
		/** The reader's scroll event, which the page fires on every scroll. */
		fireScroll: () => {
			for (const listener of scrollListeners) listener();
		},
	};
}

describe("useSectionNav", () => {
	let browser: ReturnType<typeof buildBrowser>;
	const onChange = vi.fn<(id: Id | undefined) => void>();

	beforeEach(() => {
		vi.useFakeTimers();
		onChange.mockClear();
		browser = buildBrowser();
	});

	afterEach(() => {
		runner.reset();
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it("leaves the URL alone on load until the reader scrolls", () => {
		const nav = runner.mount(() => useSectionNav(ids, undefined, onChange));
		expect(nav.active).toBe("cost");
		browser.scrollTo(500);
		expect(onChange).not.toHaveBeenCalled();

		browser.fireScroll();
		expect(onChange).toHaveBeenCalledExactlyOnceWith("tasks");
	});

	it("ignores what the observers see while a jump to a section runs", () => {
		const nav = runner.mount(() => useSectionNav(ids, undefined, onChange));
		browser.fireScroll();
		nav.scrollTo("ranked");
		expect(onChange).toHaveBeenCalledExactlyOnceWith("ranked");

		browser.scrollTo(500);
		expect(onChange).toHaveBeenCalledTimes(1);

		vi.advanceTimersByTime(1000);
		browser.scrollTo(1300);
		expect(onChange).toHaveBeenCalledTimes(2);
	});

	it("scrolls to the section and focuses its heading without scrolling again", () => {
		const nav = runner.mount(() => useSectionNav(ids, undefined, onChange));
		nav.scrollTo("tasks");

		const tasks = browser.section("tasks");
		expect(tasks.scrollIntoView).toHaveBeenCalledExactlyOnceWith({
			behavior: "auto",
		});
		expect(tasks.heading.focus).toHaveBeenCalledExactlyOnceWith({
			preventScroll: true,
		});
		expect(browser.section("cost").scrollIntoView).not.toHaveBeenCalled();
	});

	it("scrolls smoothly unless the reader prefers reduced motion", () => {
		vi.stubGlobal("matchMedia", motionPreference(false));
		const nav = runner.mount(() => useSectionNav(ids, undefined, onChange));
		nav.scrollTo("ranked");

		expect(browser.section("ranked").scrollIntoView).toHaveBeenCalledWith({
			behavior: "smooth",
		});
	});

	it("starts no jump for a section that is not rendered", () => {
		const unselected = vi.fn<(id: string | undefined) => void>();
		const nav = runner.mount(() =>
			useSectionNav([...ids, "ghost"], undefined, unselected),
		);
		browser.fireScroll();
		nav.scrollTo("ghost");
		expect(unselected).not.toHaveBeenCalled();

		browser.scrollTo(500);
		expect(unselected).toHaveBeenCalledExactlyOnceWith("tasks");
	});
});
