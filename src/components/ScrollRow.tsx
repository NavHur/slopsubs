import {
	type ReactNode,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react";

/** Which ends of a row still hide content past its edge. */
type Overflow = { start: boolean; end: boolean };

/** Within this many pixels of an edge, the row counts as scrolled to it. */
const EDGE_SLACK_PX = 2;
/** Width of the faded band at a hiding edge; the mask and the reveal share it. */
export const FADE_PX = 24;

function overflowOf(row: HTMLElement): Overflow {
	const maxScroll = row.scrollWidth - row.clientWidth;
	return {
		start: row.scrollLeft > EDGE_SLACK_PX,
		end: row.scrollLeft < maxScroll - EDGE_SLACK_PX,
	};
}

function fadeMask({ start, end }: Overflow): string | undefined {
	if (!start && !end) return undefined;
	const from = start ? `transparent, black ${FADE_PX}px` : "black";
	const to = end ? `black calc(100% - ${FADE_PX}px), transparent` : "black";
	return `linear-gradient(to right, ${from}, ${to})`;
}

type Reveal = {
	left: number;
	width: number;
	scrollLeft: number;
	clientWidth: number;
	margin: number;
};

/**
 * The scrollLeft that puts a control fully inside the row, `margin` clear of
 * both edges, or the current one if it already is. The browser clamps the
 * result to the scrollable range, so a first or last control (no fade on
 * that side) lands flush.
 */
export function revealScrollLeft(r: Reveal): number {
	const right = r.left + r.width;
	if (r.left < r.scrollLeft + r.margin) return Math.max(0, r.left - r.margin);
	if (right > r.scrollLeft + r.clientWidth - r.margin)
		return right + r.margin - r.clientWidth;
	return r.scrollLeft;
}

/** Tracks which ends of the row hide content; only a changed edge re-renders. */
function useOverflowEdges(ref: RefObject<HTMLElement | null>): Overflow {
	const [overflow, setOverflow] = useState<Overflow>({
		start: false,
		end: false,
	});

	useEffect(() => {
		const row = ref.current;
		if (!row) return;
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
	}, [ref]);

	return overflow;
}

/**
 * Scrolls the row, and only the row, to the pressed control when
 * `selectedKey` changes. The row is positioned, so `offsetLeft` measures
 * from its own left edge.
 */
function useRevealSelected(
	ref: RefObject<HTMLElement | null>,
	selectedKey: string,
) {
	// The key is the trigger; the pressed control is read from the DOM.
	useEffect(() => {
		const row = ref.current;
		const pressed = row?.querySelector<HTMLElement>("[aria-pressed=true]");
		if (!row || !pressed) return;
		row.scrollLeft = revealScrollLeft({
			left: pressed.offsetLeft,
			width: pressed.offsetWidth,
			scrollLeft: row.scrollLeft,
			clientWidth: row.clientWidth,
			margin: FADE_PX,
		});
	}, [ref, selectedKey]);
}

/**
 * A single line of controls that scrolls sideways instead of widening the
 * page, fading each edge that hides content, and bringing the pressed control
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
	const overflow = useOverflowEdges(ref);
	useRevealSelected(ref, selectedKey);

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
