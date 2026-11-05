import { useCallback, useRef } from "react";
import { useElementSize } from "#/lib/useElementSize";

/** useElementSize's ref, plus a ref object so handlers can read the element. */
export function useChartRef() {
	const [sizeRef, size] = useElementSize<HTMLDivElement>();
	const element = useRef<HTMLDivElement | null>(null);
	const ref = useCallback(
		(node: HTMLDivElement | null) => {
			element.current = node;
			return sizeRef(node);
		},
		[sizeRef],
	);
	return { ref, element, size };
}
