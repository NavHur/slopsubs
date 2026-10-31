import { useEffect, useEffectEvent, useRef, useState } from "react";

/**
 * The band, as viewport margins, that a section must cross to count as the
 * one in view: a thin line 40% of the way down.
 */
const READING_LINE = "-40% 0px -59% 0px";
/** Longest a smooth scroll to a section takes; the spy waits it out. */
const JUMP_MS = 1000;

/** Calls `onCross` with the id of the section crossing the reading line. */
function useReadingLine<T extends string>(
	ids: readonly T[],
	onCross: (id: T) => void,
) {
	const cross = useEffectEvent(onCross);
	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				const crossing = entries.find((entry) => entry.isIntersecting);
				// SAFETY: only elements with an id from `ids` are observed.
				if (crossing) cross(crossing.target.id as T);
			},
			{ rootMargin: READING_LINE },
		);
		for (const id of ids) {
			const section = document.getElementById(id);
			if (section) observer.observe(section);
		}
		return () => observer.disconnect();
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

/** Scrolls to the section named by the URL once, after the prerendered top. */
function useInitialScroll<T extends string>(
	current: T | undefined,
	onFound: (id: T) => void,
) {
	const initial = useRef(current);
	const found = useEffectEvent(onFound);
	useEffect(() => {
		if (!initial.current) return;
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

	useReadingLine(ids, (id) => {
		if (!jump.isOpen()) select(id);
	});
	useInitialScroll(current, setActive);

	const scrollTo = (id: T) => {
		const section = document.getElementById(id);
		if (!section) return;
		jump.begin();
		select(id);
		revealSection(section);
	};

	return { active, scrollTo };
}
