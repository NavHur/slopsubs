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
/** Share of the row's width one arrow press scrolls; the rest stays as context. */
const ARROW_PAGE_SHARE = 0.8;
/** Pixels in one line of a line-mode wheel step (deltaMode 1). */
const WHEEL_LINE_PX = 16;

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

type WheelStep = Pick<
	WheelEvent,
	"deltaX" | "deltaY" | "deltaMode" | "ctrlKey"
>;
type RowScroll = Pick<
	HTMLElement,
	"scrollLeft" | "scrollWidth" | "clientWidth"
>;

/**
 * The scrollLeft a vertical wheel step moves the row to, or null when the
 * step is not the row's: a pinch, a sideways gesture (the browser scrolls
 * the row natively), or a push past an end the row has reached, which goes
 * on to scroll the page.
 */
export function wheelScrollLeft(
	step: WheelStep,
	row: RowScroll,
): number | null {
	if (step.ctrlKey || Math.abs(step.deltaX) >= Math.abs(step.deltaY))
		return null;
	const unitPx = [1, WHEEL_LINE_PX, row.clientWidth][step.deltaMode] ?? 1;
	const maxScroll = Math.max(0, row.scrollWidth - row.clientWidth);
	const next = Math.min(
		maxScroll,
		Math.max(0, row.scrollLeft + step.deltaY * unitPx),
	);
	return Math.abs(next - row.scrollLeft) < 1 ? null : next;
}

/**
 * Lets a plain mouse wheel scroll the row sideways under the pointer. It
 * listens on `frame`, which holds the edge arrows as well as the row, so a
 * wheel turned over an arrow scrolls the row too.
 */
function useWheelScroll(
	frameRef: RefObject<HTMLElement | null>,
	rowRef: RefObject<HTMLElement | null>,
) {
	useEffect(() => {
		const frame = frameRef.current;
		const row = rowRef.current;
		if (!frame || !row) return;
		// React's onWheel listener is passive, so it cannot stop the page
		// scrolling as well.
		const onWheel = (event: WheelEvent) => {
			const next = wheelScrollLeft(event, row);
			if (next === null) return;
			event.preventDefault();
			row.scrollLeft = next;
		};
		frame.addEventListener("wheel", onWheel, { passive: false });
		return () => frame.removeEventListener("wheel", onWheel);
	}, [frameRef, rowRef]);
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

type Edge = keyof Overflow;

const ARROWS: Record<
	Edge,
	{ label: string; path: string; inset: string; direction: -1 | 1 }
> = {
	start: {
		label: "Scroll left",
		path: "m15 6-6 6 6 6",
		inset: "-left-1.5",
		direction: -1,
	},
	end: {
		label: "Scroll right",
		path: "m9 6 6 6-6 6",
		inset: "-right-1.5",
		direction: 1,
	},
};

function scrollRowPage(row: HTMLElement, direction: -1 | 1) {
	const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
	row.scrollBy({
		left: direction * row.clientWidth * ARROW_PAGE_SHARE,
		behavior: reduceMotion ? "instant" : "smooth",
	});
}

/**
 * A round arrow over one faded edge, for a mouse that cannot swipe. Left
 * out of the Tab order, since Tab already reaches, and reveals, every
 * control in the row.
 */
function EdgeArrow({
	edge,
	rowRef,
}: {
	edge: Edge;
	rowRef: RefObject<HTMLElement | null>;
}) {
	const arrow = ARROWS[edge];
	return (
		<button
			type="button"
			tabIndex={-1}
			aria-label={arrow.label}
			onClick={() => {
				if (rowRef.current) scrollRowPage(rowRef.current, arrow.direction);
			}}
			className={`absolute top-1/2 ${arrow.inset} hidden size-7 -translate-y-1/2 place-items-center rounded-full border border-line bg-bg text-muted transition-colors hover:text-fg pointer-fine:grid`}
		>
			<svg
				aria-hidden="true"
				viewBox="0 0 24 24"
				className="size-3.5"
				fill="none"
				stroke="currentColor"
				strokeWidth={1.75}
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d={arrow.path} />
			</svg>
		</button>
	);
}

/**
 * A single line of controls that scrolls sideways instead of widening the
 * page, fading each edge that hides content, turning a vertical mouse wheel
 * into sideways scrolling, offering an arrow at each hiding edge to fine
 * pointers, and bringing the pressed control into view whenever
 * `selectedKey` changes. `className` places the whole control, arrows
 * included, in its parent (a bleed margin belongs here, so the arrows follow
 * the fade); `rowClassName` styles the scrolling row itself.
 */
export function ScrollRow({
	selectedKey,
	className = "",
	rowClassName = "",
	children,
}: {
	selectedKey: string;
	className?: string;
	rowClassName?: string;
	children: ReactNode;
}) {
	const frameRef = useRef<HTMLDivElement>(null);
	const ref = useRef<HTMLDivElement>(null);
	const overflow = useOverflowEdges(ref);
	useRevealSelected(ref, selectedKey);
	useWheelScroll(frameRef, ref);

	const mask = fadeMask(overflow);
	return (
		<div ref={frameRef} className={`relative flex min-w-0 ${className}`}>
			<div
				ref={ref}
				className={`relative min-w-0 overflow-x-auto [scrollbar-width:none] ${rowClassName}`}
				style={{ maskImage: mask, WebkitMaskImage: mask }}
			>
				{children}
			</div>
			{overflow.start && <EdgeArrow edge="start" rowRef={ref} />}
			{overflow.end && <EdgeArrow edge="end" rowRef={ref} />}
		</div>
	);
}
