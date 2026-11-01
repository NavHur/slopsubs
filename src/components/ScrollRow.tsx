import { type ReactNode, useEffect, useRef, useState } from "react";

/** Which ends of a row still hide content past its edge. */
type Overflow = { start: boolean; end: boolean };

/** Within this many pixels of an edge, the row counts as scrolled to it. */
const EDGE_SLACK_PX = 2;
const FADE = "1.5rem";

function overflowOf(row: HTMLElement): Overflow {
	const maxScroll = row.scrollWidth - row.clientWidth;
	return {
		start: row.scrollLeft > EDGE_SLACK_PX,
		end: row.scrollLeft < maxScroll - EDGE_SLACK_PX,
	};
}

function fadeMask({ start, end }: Overflow): string | undefined {
	if (!start && !end) return undefined;
	const from = start ? `transparent, black ${FADE}` : "black";
	const to = end ? `black calc(100% - ${FADE}), transparent` : "black";
	return `linear-gradient(to right, ${from}, ${to})`;
}

/**
 * Scrolls the row, and only the row, so `target` sits fully inside it.
 * The row is positioned, so `offsetLeft` measures from its own left edge.
 */
function revealInRow(row: HTMLElement, target: HTMLElement) {
	const left = target.offsetLeft;
	const right = left + target.offsetWidth;
	if (left < row.scrollLeft) row.scrollLeft = left;
	else if (right > row.scrollLeft + row.clientWidth)
		row.scrollLeft = right - row.clientWidth;
}

/**
 * A single line of controls that scrolls sideways instead of widening the
 * page, fading the edge that hides more, and bringing the pressed control
 * into view whenever `selectedKey` changes.
 */
export function ScrollRow({
	selectedKey,
	className = "",
	children,
}: {
	selectedKey: string;
	className?: string;
	children: ReactNode;
}) {
	const ref = useRef<HTMLDivElement>(null);
	const [overflow, setOverflow] = useState<Overflow>({
		start: false,
		end: false,
	});

	useEffect(() => {
		const row = ref.current;
		if (!row) return;
		// Only a changed edge re-renders, not every scrolled pixel.
		const update = () => {
			const next = overflowOf(row);
			setOverflow((prev) =>
				prev.start === next.start && prev.end === next.end ? prev : next,
			);
		};
		update();
		const observer = new ResizeObserver(update);
		observer.observe(row);
		row.addEventListener("scroll", update, { passive: true });
		return () => {
			observer.disconnect();
			row.removeEventListener("scroll", update);
		};
	}, []);

	// oxlint-disable-next-line react-hooks/exhaustive-deps -- the key is the trigger; the pressed control is read from the DOM
	useEffect(() => {
		const row = ref.current;
		const pressed = row?.querySelector<HTMLElement>("[aria-pressed=true]");
		if (row && pressed) revealInRow(row, pressed);
	}, [selectedKey]);

	const mask = fadeMask(overflow);
	return (
		<div
			ref={ref}
			className={`relative overflow-x-auto [scrollbar-width:none] ${className}`}
			style={{ maskImage: mask, WebkitMaskImage: mask }}
		>
			{children}
		</div>
	);
}
