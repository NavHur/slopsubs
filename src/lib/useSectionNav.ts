import { useEffect, useEffectEvent, useRef, useState } from "react";

/** How far down the viewport a section's top must have risen to count as in view. */
const READING_LINE = 0.4;
/** Longest a smooth scroll to a section takes; the spy waits it out. */
const JUMP_MS = 1000;
/** Sub-pixel slack when deciding a scroller has reached its end. */
const END_SLACK_PX = 1;

interface Scroller {
	scrollTop: number;
	clientHeight: number;
	scrollHeight: number;
}

/** Whether a scroller that can scroll has been scrolled all the way down. */
export function isAtEnd(s: Scroller) {
	if (s.scrollHeight <= s.clientHeight) return false;
	return s.scrollHeight - s.scrollTop - s.clientHeight <= END_SLACK_PX;
}

/**
 * The section in view: the last one whose top has reached the reading line, or
 * the last one at all once the scroller is at its end (a short last section
 * can never bring its top up to the line).
 */
export function sectionInView<T extends string>(
	sections: readonly { id: T; top: number }[],
	line: number,
	atEnd: boolean,
): T | undefined {
	if (atEnd) return sections.at(-1)?.id;
	const reached = sections.filter((section) => section.top <= line);
	return (reached.at(-1) ?? sections[0])?.id;
}

/** The nearest ancestor that scrolls on its own, else the page. */
function scrollerOf(el: HTMLElement): Scroller {
	for (let p = el.parentElement; p; p = p.parentElement) {
		const { overflowY } = getComputedStyle(p);
		if (overflowY === "auto" || overflowY === "scroll") return p;
	}
	return document.scrollingElement ?? document.documentElement;
}

/** The rendered section of `ids` in view on the page now. */
function readSectionInView<T extends string>(ids: readonly T[]): T | undefined {
	const elements = ids.flatMap((id) => {
		const el = document.getElementById(id);
		return el ? [{ id, el }] : [];
	});
	const first = elements[0];
	if (!first) return undefined;
	return sectionInView(
		elements.map(({ id, el }) => ({ id, top: el.getBoundingClientRect().top })),
		window.innerHeight * READING_LINE,
		isAtEnd(scrollerOf(first.el)),
	);
}

/**
 * The element at the very end of the scrolling content: it intersects the
 * viewport once the scroller is within a pixel of its end.
 */
export const SCROLL_END_ID = "sections-end";

/**
 * Calls `onCrossing` when a section's top crosses the reading line, or the
 * scroller reaches or leaves its end. Returns the cleanup.
 */
function observeCrossings(ids: readonly string[], onCrossing: () => void) {
	// The viewport above the reading line: a section's top crosses the line
	// exactly when the section enters or leaves this band from below.
	const aboveLine = new IntersectionObserver(onCrossing, {
		rootMargin: `0px 0px -${Math.round((1 - READING_LINE) * 100)}% 0px`,
	});
	const end = new IntersectionObserver(onCrossing);
	for (const id of ids) {
		const section = document.getElementById(id);
		if (section) aboveLine.observe(section);
	}
	const endMarker = document.getElementById(SCROLL_END_ID);
	if (endMarker) end.observe(endMarker);
	return () => {
		aboveLine.disconnect();
		end.disconnect();
	};
}

/**
 * Calls `onCross` with the section in view whenever it changes, from the
 * reader's first scroll on. The section in view only changes when a
 * section's top crosses the reading line or the scroller reaches or leaves
 * its end, so after that first scroll it is read at those crossings, which
 * IntersectionObservers report, not on every scroll event.
 */
function useScrollSpy<T extends string>(
	ids: readonly T[],
	onCross: (id: T) => void,
) {
	const cross = useEffectEvent(onCross);
	useEffect(() => {
		let reported: T | undefined;
		let scrolled = false;
		const report = () => {
			const id = readSectionInView(ids);
			if (id === undefined || id === reported) return;
			reported = id;
			cross(id);
		};
		const onCrossing = () => {
			if (scrolled) report();
		};
		// Quiet until the reader first scrolls, then read once: a tall screen
		// keeps its URL on load even when a later section starts in view.
		const onFirstScroll = () => {
			scrolled = true;
			report();
		};
		// Capture: an element's scroll events do not bubble to the window.
		window.addEventListener("scroll", onFirstScroll, {
			capture: true,
			passive: true,
			once: true,
		});
		const stopObserving = observeCrossings(ids, onCrossing);
		return () => {
			window.removeEventListener("scroll", onFirstScroll, true);
			stopObserving();
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
 * `scrollTo` jumps to a section without reporting the ones it passes.
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
