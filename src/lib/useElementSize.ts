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
		observer.observe(node);
		return () => observer.disconnect();
	}, []);
	return [ref, size] as const;
}
