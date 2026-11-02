import { useEffect, useEffectEvent, useRef, useState } from "react";

/** How far down the viewport a section's top must have risen to count as in view. */
const READING_LINE = 0.4;
/** Longest a smooth scroll to a section takes; the spy waits it out. */
const JUMP_MS = 1000;

/**
 * What the observers last saw: whether each rendered section's top has
 * reached the reading line, and whether the scroller is at its end.
 */
export type Sighting<T extends string> = {
	reached: ReadonlyMap<T, boolean>;
	atEnd: boolean;
};

/**
 * The section in view: the last one whose top has reached the reading line, or
 * the last one at all once the scroller is at its end (a short last section
 * can never bring its top up to the line). Sections not seen are not rendered.
 */
export function sectionInView<T extends string>(
	ids: readonly T[],
	seen: Sighting<T>,
): T | undefined {
	const shown = ids.filter((id) => seen.reached.has(id));
	if (seen.atEnd) return shown.at(-1);
	return shown.filter((id) => seen.reached.get(id)).at(-1) ?? shown[0];
}

/** The nearest ancestor that scrolls on its own; null when the page scrolls. */
function scrollerOf(el: Element): Element | null {
	for (let p = el.parentElement; p; p = p.parentElement) {
		const { overflowY } = getComputedStyle(p);
		if (overflowY === "auto" || overflowY === "scroll") return p;
	}
	return null;
}

/** Whether the scroller, or the page when there is none, has more to scroll. */
function canScroll(scroller: Element | null): boolean {
	const el = scroller ?? document.scrollingElement ?? document.documentElement;
	return el.scrollHeight > el.clientHeight;
}

/**
 * The element at the very end of the scrolling content, a pixel high: it
 * intersects the viewport once the scroller is within a pixel of its end.
 */
export const SCROLL_END_ID = "sections-end";

/** The sections of `ids` that are rendered, with their elements. */
function renderedSections<T extends string>(ids: readonly T[]) {
	return ids.flatMap((id) => {
		const el = document.getElementById(id);
		return el ? [{ id, el }] : [];
	});
}

/** The observer root box runs from here down to the reading line: past any page. */
const ABOVE_PAGE_PX = 1_000_000;
const BELOW_LINE_PERCENT = Math.round((1 - READING_LINE) * 100);

/** What `observeSections` keeps current: a Sighting whose map it fills in. */
type Tracked<T extends string> = {
	reached: Map<T, boolean>;
	atEnd: boolean;
};

/** The observer root and margin that put the reading line at 40% of the window. */
type LineBox = { root: Element | null; margin: string };

/**
 * The box from far above the page down to the reading line. The page scrolls
 * in the viewport, whose percent margin follows its size. A scroller is the
 * root, or its own clip would hide the sections above it; its margin is in
 * pixels, to put the line where the window's 40% is rather than the scroller's.
 */
function lineBoxOf(scroller: Element | null): LineBox {
	if (!scroller) {
		return {
			root: null,
			margin: `${ABOVE_PAGE_PX}px 0px -${BELOW_LINE_PERCENT}% 0px`,
		};
	}
	const { top } = scroller.getBoundingClientRect();
	const bottom = top + scroller.clientTop + scroller.clientHeight;
	const line = Math.round(window.innerHeight * READING_LINE - bottom);
	return { root: scroller, margin: `${ABOVE_PAGE_PX}px 0px ${line}px 0px` };
}

/**
 * Watches each section against the box down to the reading line, so a section
 * meets it exactly when its top has reached the line, however far one jump
 * moves it: a section that skips a narrower band would send no entry.
 */
function observeReached<T extends string>(
	sections: ReturnType<typeof renderedSections<T>>,
	box: LineBox,
	seen: Tracked<T>,
	onChange: (seen: Sighting<T>) => void,
) {
	const idOf = new Map<Element, T>(sections.map(({ id, el }) => [el, id]));
	const observer = new IntersectionObserver(
		(entries) => {
			for (const { target, isIntersecting } of entries) {
				const id = idOf.get(target);
				if (id) seen.reached.set(id, isIntersecting);
			}
			onChange(seen);
		},
		{ root: box.root, rootMargin: box.margin },
	);
	for (const { el } of sections) observer.observe(el);
	return observer;
}

/** Watches the end marker, which says whether the scroller is at its end. */
function observeEnd<T extends string>(
	scroller: Element | null,
	endMarker: Element | null,
	seen: Tracked<T>,
	onChange: (seen: Sighting<T>) => void,
) {
	const observer = new IntersectionObserver((entries) => {
		const marker = entries.at(-1);
		if (!marker) return;
		seen.atEnd = marker.isIntersecting && canScroll(scroller);
		onChange(seen);
	});
	if (endMarker) observer.observe(endMarker);
	return observer;
}

/**
 * Keeps `seen` current from IntersectionObserver entries and calls `onChange`
 * after each update. The section observer reads no layout; the end check
 * reads it once per crossing of the scroller's end. The scroller and the
 * line's margin come from the layout at the time, so `isCurrent` says when a
 * resize has moved them.
 */
export function observeSections<T extends string>(
	ids: readonly T[],
	onChange: (seen: Sighting<T>) => void,
	seen: Tracked<T> = { reached: new Map(), atEnd: false },
) {
	const sections = renderedSections(ids);
	const endMarker = document.getElementById(SCROLL_END_ID);
	if (sections.length > 0 && !endMarker) {
		throw new Error(`#${SCROLL_END_ID} is not rendered`);
	}
	const scrollerNow = () => (sections[0] ? scrollerOf(sections[0].el) : null);
	const scroller = scrollerNow();
	const box = lineBoxOf(scroller);
	const observers = [
		observeReached(sections, box, seen, onChange),
		observeEnd(scroller, endMarker, seen, onChange),
	];
	return {
		seen,
		isCurrent: () => {
			const now = scrollerNow();
			return now === scroller && lineBoxOf(now).margin === box.margin;
		},
		stop: () => {
			for (const observer of observers) observer.disconnect();
		},
	};
}

/**
 * `observeSections`, made again whenever a resize moves the scroller (at a
 * breakpoint) or the reading line, keeping what the old observers saw.
 */
export function observeAcrossResizes<T extends string>(
	ids: readonly T[],
	onChange: (seen: Sighting<T>) => void,
) {
	let sections = observeSections(ids, onChange);
	const onResize = () => {
		if (sections.isCurrent()) return;
		sections.stop();
		sections = observeSections(ids, onChange, sections.seen);
	};
	window.addEventListener("resize", onResize, { passive: true });
	return {
		seen: sections.seen,
		stop: () => {
			window.removeEventListener("resize", onResize);
			sections.stop();
		},
	};
}

/**
 * Calls `onCross` with the section in view whenever it changes, from the
 * reader's first scroll on. IntersectionObservers report each crossing of
 * the reading line and of the scroller's end, the only moments the section
 * in view can change, so nothing runs on the scroll events in between.
 */
function useScrollSpy<T extends string>(
	ids: readonly T[],
	onCross: (id: T) => void,
) {
	const cross = useEffectEvent(onCross);
	useEffect(() => {
		let reported: T | undefined;
		let scrolled = false;
		const report = (seen: Sighting<T>) => {
			if (!scrolled) return;
			const id = sectionInView(ids, seen);
			if (id === undefined || id === reported) return;
			reported = id;
			cross(id);
		};
		const sections = observeAcrossResizes(ids, report);
		// Quiet until the reader first scrolls: a tall screen keeps its URL on
		// load even when a later section starts in view.
		const onFirstScroll = () => {
			scrolled = true;
			report(sections.seen);
		};
		// Capture: an element's scroll events do not bubble to the window.
		window.addEventListener("scroll", onFirstScroll, {
			capture: true,
			passive: true,
			once: true,
		});
		return () => {
			window.removeEventListener("scroll", onFirstScroll, true);
			sections.stop();
		};
	}, [ids]);
}

/** A window after a jump that lasts JUMP_MS, cleared if the page unmounts. */
function useJumpWindow() {
	const open = useRef(false);
	const timer = useRef(0);
	useEffect(() => () => window.clearTimeout(timer.current), []);
	return {
		isOpen: () => open.current,
		begin: () => {
			open.current = true;
			window.clearTimeout(timer.current);
			timer.current = window.setTimeout(() => {
				open.current = false;
			}, JUMP_MS);
		},
	};
}

/** Brings a section into view, smoothly unless motion is reduced, and focuses its heading. */
function revealSection(section: HTMLElement) {
	const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
	section.scrollIntoView({
		behavior: reduceMotion.matches ? "auto" : "smooth",
	});
	section.querySelector("h2")?.focus({ preventScroll: true });
}

/**
 * Scrolls to the section named by the URL once, after the prerendered top.
 * `beginJump` runs first so the spy ignores the scroll this causes.
 */
function useInitialScroll<T extends string>(
	current: T | undefined,
	onFound: (id: T) => void,
	beginJump: () => void,
) {
	const initial = useRef(current);
	const found = useEffectEvent(onFound);
	const begin = useEffectEvent(beginJump);
	useEffect(() => {
		if (!initial.current) return;
		begin();
		found(initial.current);
		document.getElementById(initial.current)?.scrollIntoView();
	}, []);
}

/**
 * Scroll-spy navigation between page sections whose element ids are `ids`.
 * Reports the section in view through `onChange` (undefined for the first,
 * which is the top of the page), scrolls to `current` once on load, and
 * `scrollTo` jumps to a section without reporting the ones it passes. The page
 * must render #SCROLL_END_ID as the scroller's last child; it throws when the
 * marker is missing.
 */
export function useSectionNav<T extends string>(
	ids: readonly T[],
	current: T | undefined,
	onChange: (id: T | undefined) => void,
) {
	// The page is prerendered at the top, so `current` takes over after mount.
	const [active, setActive] = useState<T>(ids[0]);
	const jump = useJumpWindow();
	const select = (id: T) => {
		setActive(id);
		const next = id === ids[0] ? undefined : id;
		if (next !== current) onChange(next);
	};

	useScrollSpy(ids, (id) => {
		if (!jump.isOpen()) select(id);
	});
	useInitialScroll(current, setActive, jump.begin);

	const scrollTo = (id: T) => {
		const section = document.getElementById(id);
		if (!section) return;
		jump.begin();
		select(id);
		revealSection(section);
	};

	return { active, scrollTo };
}
