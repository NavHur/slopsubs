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

/** Whether the nearest ancestor that scrolls on its own, else the page, can. */
function canScroll(el: Element): boolean {
	for (let p = el.parentElement; p; p = p.parentElement) {
		const { overflowY } = getComputedStyle(p);
		if (overflowY === "auto" || overflowY === "scroll") {
			return p.scrollHeight > p.clientHeight;
		}
	}
	const page = document.scrollingElement ?? document.documentElement;
	return page.scrollHeight > page.clientHeight;
}

/**
 * The element at the very end of the scrolling content, a pixel high: it
 * intersects the viewport once the scroller is within a pixel of its end.
 */
export const SCROLL_END_ID = "sections-end";

/**
 * Keeps a Sighting of the sections of `ids` current from IntersectionObserver
 * entries, so nothing reads layout, and calls `onChange` after each update.
 */
function observeSections<T extends string>(
	ids: readonly T[],
	onChange: (seen: Sighting<T>) => void,
) {
	const reached = new Map<T, boolean>();
	const seen = { reached, atEnd: false };
	const idOf = new Map<Element, T>();
	// The viewport above the reading line. A section's top crosses the line
	// exactly when the section enters or leaves this band from below, so each
	// section's last entry says whether its top has reached the line.
	const aboveLine = new IntersectionObserver(
		(entries) => {
			const line = window.innerHeight * READING_LINE;
			for (const { target, boundingClientRect } of entries) {
				const id = idOf.get(target);
				if (id) reached.set(id, boundingClientRect.top <= line);
			}
			onChange(seen);
		},
		{ rootMargin: `0px 0px -${Math.round((1 - READING_LINE) * 100)}% 0px` },
	);
	const end = new IntersectionObserver((entries) => {
		const marker = entries.at(-1);
		if (!marker) return;
		seen.atEnd = marker.isIntersecting && canScroll(marker.target);
		onChange(seen);
	});
	for (const id of ids) {
		const section = document.getElementById(id);
		if (!section) continue;
		idOf.set(section, id);
		aboveLine.observe(section);
	}
	const endMarker = document.getElementById(SCROLL_END_ID);
	if (endMarker) end.observe(endMarker);
	return {
		seen,
		stop: () => {
			aboveLine.disconnect();
			end.disconnect();
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
		const sections = observeSections(ids, report);
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
