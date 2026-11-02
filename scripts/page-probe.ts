// Page-side probe, run via addInitScript before React loads. The functions
// are serialized as source: each may use only itself, its listed helpers, globals.

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

/** Counts layout reads and scroll events, and exposes `window.__probe`. */
function installInstrumentation() {
	// Inside the function: only its own source is serialized into the page.
	const zeroed = (): ProbeStats => ({
		commits: 0,
		renders: {},
		scrollEvents: 0,
		rectReads: 0,
		styleReads: 0,
	});
	const stats = zeroed();
	const reset = () => {
		Object.assign(stats, zeroed());
	};
	Object.assign(window, { __probe: { stats, reset } });

	const patchLayoutReads = () => {
		const measure = Object.getOwnPropertyDescriptor(
			Element.prototype,
			"getBoundingClientRect",
		)?.value;
		if (typeof measure !== "function") {
			throw new Error(
				"Element.prototype.getBoundingClientRect is not a function",
			);
		}
		Element.prototype.getBoundingClientRect = function (this: Element) {
			stats.rectReads++;
			return measure.call(this);
		};
		const style = window.getComputedStyle.bind(window);
		window.getComputedStyle = (element, pseudo) => {
			stats.styleReads++;
			return style(element, pseudo);
		};
	};
	patchLayoutReads();
	window.addEventListener("scroll", () => stats.scrollEvents++, {
		capture: true,
		passive: true,
	});
}

/** The component's name, from the type React keeps on its fiber. */
function fiberName(fiber: Fiber) {
	// SAFETY: component fibers hold a function or object with these names.
	const type = fiber.type as {
		displayName?: string;
		name?: string;
		render?: { name?: string };
	} | null;
	return type?.displayName || type?.name || type?.render?.name || "?";
}

/** Whether a function, class, forwardRef or simple-memo fiber ran in this commit. */
function renderedIn(fiber: Fiber, mounted: boolean) {
	/** React's PerformedWork flag: the component ran in this commit. */
	const PERFORMED_WORK = 1;
	const isComponent = [0, 1, 11, 15].includes(fiber.tag);
	return isComponent && (mounted || (fiber.flags & PERFORMED_WORK) !== 0);
}

/**
 * React DevTools' walk: a subtree whose child pointer is unchanged bailed
 * out, so nothing in it rendered.
 */
function countFibers(stats: ProbeStats, next: Fiber, prev: Fiber | null) {
	if (renderedIn(next, prev === null)) {
		const name = fiberName(next);
		stats.renders[name] = (stats.renders[name] ?? 0) + 1;
	}
	if (prev !== null && next.child === prev.child) return;
	for (let child = next.child; child; child = child.sibling) {
		countFibers(stats, child, prev && child.alternate);
	}
}

/** Counts each commit's rendered components through the DevTools hook. */
function installRenderCounter() {
	// SAFETY: installInstrumentation ran first and set window.__probe.
	const { stats } = (window as unknown as { __probe: { stats: ProbeStats } })
		.__probe;
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
				countFibers(stats, root.current, root.current.alternate);
			},
		},
	});
}

/** An init script for `addInitScript`. */
export type ProbeScript = { content: string };

/** Any function, to serialize it. */
type Serializable = (...args: never[]) => unknown;

/** Declares each helper, then calls each setup, as soon as the script loads. */
function scriptOf(
	helpers: readonly Serializable[],
	setups: readonly (() => void)[],
): ProbeScript {
	const declared = helpers.map((fn) => fn.toString()).join("\n");
	const called = setups.map((fn) => `(${fn.toString()})();`).join("\n");
	return { content: `${declared}\n${called}` };
}

/** Init script for a page whose probe counts renders. */
export const countedProbe = scriptOf(
	[fiberName, renderedIn, countFibers],
	[installInstrumentation, installRenderCounter],
);

/** Init script for a page that only counts layout reads and scrolls. */
export const uncountedProbe = scriptOf([], [installInstrumentation]);
