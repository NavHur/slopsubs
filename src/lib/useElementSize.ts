import { useCallback, useState } from "react";

export type Size = { width: number; height: number };

const SSR_SIZE: Size = { width: 960, height: 620 };

/** Tracks an element's content box; renders at SSR_SIZE before mount. */
export function useElementSize<T extends HTMLElement>() {
	const [size, setSize] = useState(SSR_SIZE);
	const ref = useCallback((node: T | null) => {
		if (!node) return;
		const observer = new ResizeObserver(([entry]) =>
			setSize({
				width: entry.contentRect.width,
				height: entry.contentRect.height,
			}),
		);
		// False positive: a React 19 ref callback is not an effect, and the cleanup
		// it returns on the next line runs on detach, which the rule cannot see.
		// react-doctor-disable-next-line react-doctor/effect-needs-cleanup
		observer.observe(node);
		return () => observer.disconnect();
	}, []);
	return [ref, size] as const;
}
