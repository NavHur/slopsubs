import { useCallback, useState } from "react";

const SSR_WIDTH = 960;

/** Tracks an element's content width; renders at SSR_WIDTH before mount. */
export function useElementWidth<T extends HTMLElement>() {
	const [width, setWidth] = useState(SSR_WIDTH);
	const ref = useCallback((node: T | null) => {
		if (!node) return;
		const observer = new ResizeObserver(([entry]) =>
			setWidth(entry.contentRect.width),
		);
		observer.observe(node);
		return () => observer.disconnect();
	}, []);
	return [ref, width] as const;
}
