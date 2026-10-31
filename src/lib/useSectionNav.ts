import { useEffect, useEffectEvent, useRef, useState } from "react";

/**
 * The band, as viewport margins, that a section must cross to count as the
 * one in view: a thin line 40% of the way down.
 */
const READING_LINE = "-40% 0px -59% 0px";
/** Longest a smooth scroll to a section takes; the spy waits it out. */
const JUMP_MS = 1000;

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
	const jumping = useRef(false);
	const jumpTimer = useRef(0);
	const report = (id: T) => {
		const next = id === ids[0] ? undefined : id;
		if (next !== current) onChange(next);
	};
	const spy = useEffectEvent((id: T) => {
		if (jumping.current) return;
		setActive(id);
		report(id);
	});
	const initial = useRef(current);

	useEffect(() => {
		if (!initial.current) return;
		setActive(initial.current);
		document.getElementById(initial.current)?.scrollIntoView();
	}, []);

	useEffect(() => {
		const observer = new IntersectionObserver(
			(entries) => {
				const crossing = entries.find((entry) => entry.isIntersecting);
				if (crossing) spy(crossing.target.id as T);
			},
			{ rootMargin: READING_LINE },
		);
		for (const id of ids) {
			const section = document.getElementById(id);
			if (section) observer.observe(section);
		}
		return () => observer.disconnect();
	}, [ids]);

	useEffect(() => () => window.clearTimeout(jumpTimer.current), []);

	const scrollTo = (id: T) => {
		const section = document.getElementById(id);
		if (!section) return;
		jumping.current = true;
		window.clearTimeout(jumpTimer.current);
		jumpTimer.current = window.setTimeout(() => {
			jumping.current = false;
		}, JUMP_MS);
		setActive(id);
		report(id);
		const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
		section.scrollIntoView({
			behavior: reduceMotion.matches ? "auto" : "smooth",
		});
		section.querySelector("h2")?.focus({ preventScroll: true });
	};

	return { active, scrollTo };
}
