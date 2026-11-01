// Runs inside the page (via addInitScript) before React loads. Counts which
// components render in each commit, through the hook React DevTools uses, and
// how often the page reads layout or receives scroll events.
//
// Serialized into the page as source: everything it uses must live inside it.

export type ProbeStats = {
	commits: number;
	/** Renders per component name, mounts included. */
	renders: Record<string, number>;
	scrollEvents: number;
	/** Calls to getBoundingClientRect, each a possible forced layout. */
	rectReads: number;
	/** Calls to getComputedStyle, each a possible forced style recalc. */
	styleReads: number;
};

/** A React fiber, as far as the probe reads it. */
type Fiber = {
	tag: number;
	flags: number;
	type: unknown;
	child: Fiber | null;
	sibling: Fiber | null;
	alternate: Fiber | null;
};

export function installProbe(countRenders: boolean) {
	/** React's PerformedWork flag: the component ran in this commit. */
	const PERFORMED_WORK = 1;
	/** Function, class, forwardRef and simple-memo components. */
	const COMPONENT_TAGS = new Set([0, 1, 11, 15]);
	const stats: ProbeStats = {
		commits: 0,
		renders: {},
		scrollEvents: 0,
		rectReads: 0,
		styleReads: 0,
	};
	const reset = () => {
		Object.assign(stats, {
			commits: 0,
			renders: {},
			scrollEvents: 0,
			rectReads: 0,
			styleReads: 0,
		});
	};
	Object.assign(window, { __probe: { stats, reset } });

	const nameOf = (fiber: Fiber) => {
		const type = fiber.type as {
			displayName?: string;
			name?: string;
			render?: { name?: string };
		} | null;
		return type?.displayName || type?.name || type?.render?.name || "?";
	};
	const count = (fiber: Fiber, mounted: boolean) => {
		if (!COMPONENT_TAGS.has(fiber.tag)) return;
		if (!mounted && (fiber.flags & PERFORMED_WORK) === 0) return;
		const name = nameOf(fiber);
		stats.renders[name] = (stats.renders[name] ?? 0) + 1;
	};
	// React DevTools' walk: a subtree whose child pointer is unchanged bailed
	// out, so nothing in it rendered.
	const walk = (next: Fiber, prev: Fiber | null) => {
		count(next, prev === null);
		if (prev !== null && next.child === prev.child) return;
		for (let child = next.child; child; child = child.sibling) {
			walk(child, prev === null ? null : child.alternate);
		}
	};

	if (countRenders) {
		Object.assign(window, {
			__REACT_DEVTOOLS_GLOBAL_HOOK__: {
				supportsFiber: true,
				renderers: new Map(),
				inject: () => 1,
				checkDCE: () => {},
				onScheduleFiberRoot: () => {},
				onCommitFiberUnmount: () => {},
				onPostCommitFiberRoot: () => {},
				onCommitFiberRoot: (_id: number, root: { current: Fiber }) => {
					stats.commits++;
					walk(root.current, root.current.alternate);
				},
			},
		});
	}

	const measure = Object.getOwnPropertyDescriptor(
		Element.prototype,
		"getBoundingClientRect",
	)?.value as (this: Element) => DOMRect;
	Element.prototype.getBoundingClientRect = function (this: Element) {
		stats.rectReads++;
		return measure.call(this);
	};
	const style = window.getComputedStyle.bind(window);
	window.getComputedStyle = (element, pseudo) => {
		stats.styleReads++;
		return style(element, pseudo);
	};
	window.addEventListener("scroll", () => stats.scrollEvents++, {
		capture: true,
		passive: true,
	});
}
