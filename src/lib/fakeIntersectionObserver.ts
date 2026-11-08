/** A vertical extent in viewport pixels. */
export type Span = { top: number; bottom: number };

/** What the fake needs to know about an observed element or a root. */
export type FakeBox = {
	/** Where the element sits in the viewport now, ignoring any clipping. */
	span: () => Span;
	/** The scroller that clips the element, when one does. */
	clip?: Span;
	/** The element's parent, for telling whether a root contains it. */
	parentElement?: FakeBox | null;
};

type Entry = {
	target: FakeBox;
	isIntersecting: boolean;
	boundingClientRect: Span;
};
type Init = { root?: FakeBox | null; rootMargin?: string };

function marginPx(token: string | undefined, rootHeight: number): number {
	if (token === undefined) throw new Error("rootMargin needs four values");
	const value = Number.parseFloat(token);
	if (token.endsWith("%")) return (value / 100) * rootHeight;
	if (token.endsWith("px")) return value;
	if (value === 0) return 0;
	throw new Error(`rootMargin value ${token} needs a unit`);
}

/** The root box, grown by `rootMargin` (top and bottom of four CSS values). */
function rootBox(root: Span, rootMargin: string): Span {
	const tokens = rootMargin.split(/\s+/);
	if (tokens.length !== 4) throw new Error("rootMargin needs four values");
	const height = root.bottom - root.top;
	return {
		top: root.top - marginPx(tokens[0], height),
		bottom: root.bottom + marginPx(tokens[2], height),
	};
}

/** Edge-inclusive, like the real thing: touching counts as intersecting. */
function touches(a: Span, b: Span): boolean {
	return a.top <= b.bottom && a.bottom >= b.top;
}

type Observer = { update: () => void };

/** A root that does not contain its target never meets it, as in a browser. */
function isInside(target: FakeBox, root: FakeBox): boolean {
	for (let p = target.parentElement; p; p = p.parentElement ?? null) {
		if (p === root) return true;
	}
	return false;
}

/** Whether `target` meets the root box of `init` now. */
function meetsRootBox(target: FakeBox, init: Init, viewport: number): boolean {
	const { root = null, rootMargin = "0px 0px 0px 0px" } = init;
	if (root && !isInside(target, root)) return false;
	const rootSpan = root ? root.span() : { top: 0, bottom: viewport };
	const seen = visibleSpan(target, root);
	return (
		seen.top <= seen.bottom && touches(seen, rootBox(rootSpan, rootMargin))
	);
}

/** The viewport clips through the target's scroller; an explicit root does not. */
function visibleSpan(target: FakeBox, root: FakeBox | null): Span {
	if (root || !target.clip) return target.span();
	return clipTo(target.span(), target.clip);
}

/** Records each target's new state and returns an entry for those that flipped. */
function flips(
	last: Map<FakeBox, boolean | undefined>,
	init: Init,
	viewport: number,
): Entry[] {
	const entries: Entry[] = [];
	for (const [target, before] of last) {
		const now = meetsRootBox(target, init, viewport);
		if (before === now) continue;
		last.set(target, now);
		const boundingClientRect = target.span();
		entries.push({ target, isIntersecting: now, boundingClientRect });
	}
	return entries;
}

/**
 * A faithful stand-in for IntersectionObserver on one axis. It reports a
 * target only when its `isIntersecting` flips (and once on the first update),
 * so a target that skips the observed box between two updates gets no entry.
 * With no root, targets are clipped by their scroller, as in a browser.
 */
export function createFakeObservers(viewportHeight: () => number) {
	const all = new Set<Observer>();

	class FakeIntersectionObserver implements Observer {
		private readonly last = new Map<FakeBox, boolean | undefined>();
		constructor(
			private readonly callback: (entries: Entry[]) => void,
			private readonly init: Init = {},
		) {
			all.add(this);
		}
		observe(target: FakeBox) {
			this.last.set(target, undefined);
		}
		disconnect() {
			this.last.clear();
			all.delete(this);
		}
		update() {
			const entries = flips(this.last, this.init, viewportHeight());
			if (entries.length > 0) this.callback(entries);
		}
	}

	return {
		FakeIntersectionObserver,
		/** Lets every observer see the page as it is now. */
		deliver: () => {
			for (const observer of all) observer.update();
		},
	};
}

function clipTo(span: Span, clip: Span): Span {
	return {
		top: Math.max(span.top, clip.top),
		bottom: Math.min(span.bottom, clip.bottom),
	};
}
