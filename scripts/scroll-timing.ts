// Times a wheel pass on the built page with Chrome's CPU profiler, splitting
// script time into React's work and layout reads (see README, Profiling).

import type { Browser } from "playwright-core";
import { uncountedProbe } from "./page-probe.ts";
import { openPage, pointAtGutter, type ViewportName } from "./page-session.ts";

export const CPU_SLOWDOWN = 4;
/** Timed passes per viewport; the report keeps each figure's median. */
const TIMED_RUNS = 5;
/** Time between wheel steps, long enough for a throttled commit. */
const STEP_MS = 150;
const SAMPLING_INTERVAL_US = 100;
/** Samples spent outside script. */
const NOT_SCRIPT = new Set(["(idle)", "(program)"]);
/**
 * Frames whose time, callees included, the report breaks out: React's render
 * and commit work, and the DOM calls that read layout, whoever makes them.
 * The build must be unminified for React's names to survive.
 */
const BUCKETS = {
	react: ["performWorkOnRoot"],
	layoutReads: ["getBoundingClientRect", "getComputedStyle"],
} as const;

/** The parts of a CDP Profiler.Profile the split reads. */
type Profile = {
	nodes: {
		id: number;
		callFrame: { functionName: string };
		children?: number[];
	}[];
	samples?: number[];
	timeDeltas?: number[];
};

type Split = { script: number } & Record<keyof typeof BUCKETS, number>;

/** Each node's function name and those of all its callers. */
function stacksOf(profile: Profile) {
	const parent = new Map<number, number>();
	for (const node of profile.nodes) {
		for (const child of node.children ?? []) parent.set(child, node.id);
	}
	const name = new Map(
		profile.nodes.map((n) => [n.id, n.callFrame.functionName]),
	);
	return (id: number) => {
		const names: string[] = [];
		for (
			let at: number | undefined = id;
			at !== undefined;
			at = parent.get(at)
		) {
			names.push(name.get(at) ?? "");
		}
		return names;
	};
}

/** The buckets whose frames appear in a stack. */
function bucketsIn(stack: readonly string[]) {
	// SAFETY: Object.entries(BUCKETS) yields exactly the keys of BUCKETS.
	const entries = Object.entries(BUCKETS) as [
		keyof typeof BUCKETS,
		readonly string[],
	][];
	return entries
		.filter(([, fns]) => fns.some((fn) => stack.includes(fn)))
		.map(([bucket]) => bucket);
}

function profileSamples(profile: Profile) {
	const { samples, timeDeltas } = profile;
	if (!samples) throw new Error("Chrome profile has no samples");
	if (!timeDeltas || timeDeltas.length < samples.length) {
		throw new Error("Chrome profile has fewer timeDeltas than samples");
	}
	return { samples, timeDeltas };
}

/** Milliseconds of script, and of each bucket, in a profile. */
export function split(profile: Profile): Split {
	const { samples, timeDeltas } = profileSamples(profile);
	const stackOf = stacksOf(profile);
	const totals: Split = { script: 0, react: 0, layoutReads: 0 };
	samples.forEach((id, i) => {
		// A sample lasts until the next one; the last has none.
		const ms = (timeDeltas[i + 1] ?? 0) / 1000;
		const stack = stackOf(id);
		if (NOT_SCRIPT.has(stack[0])) return;
		totals.script += ms;
		for (const bucket of bucketsIn(stack)) totals[bucket] += ms;
	});
	return totals;
}

/**
 * Replays a pass's wheel deltas on an unprobed page and profiles it. Steps
 * wait on the clock alone: evaluating script in the page would be profiled.
 */
async function timedScroll(
	browser: Browser,
	origin: string,
	viewport: ViewportName,
	wheel: readonly number[],
): Promise<Split> {
	const page = await openPage(browser, origin, viewport, uncountedProbe);
	const cdp = await page.context().newCDPSession(page);
	await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU_SLOWDOWN });
	await cdp.send("Profiler.enable");
	await cdp.send("Profiler.setSamplingInterval", {
		interval: SAMPLING_INTERVAL_US,
	});
	await pointAtGutter(page, viewport);
	await cdp.send("Profiler.start");
	for (const delta of wheel) {
		await page.mouse.wheel(0, delta);
		await page.waitForTimeout(STEP_MS);
	}
	const { profile } = await cdp.send("Profiler.stop");
	await page.close();
	return split(profile);
}

function median(values: readonly number[]) {
	const sorted = values.toSorted((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)];
}

/** Each figure's median over TIMED_RUNS fresh pages, and every run's value. */
export async function scrollTimings(
	browser: Browser,
	origin: string,
	viewport: ViewportName,
	wheel: readonly number[],
) {
	const runs: Split[] = [];
	for (let i = 0; i < TIMED_RUNS; i++) {
		runs.push(await timedScroll(browser, origin, viewport, wheel));
	}
	// SAFETY: every run is a Split, so its keys are the keys of Split.
	const names = Object.keys(runs[0]) as (keyof Split)[];
	return Object.fromEntries(
		names.map((name) => {
			const values = runs.map((run) => Math.round(run[name]));
			return [name, { medianMs: median(values), runsMs: values }];
		}),
	);
}
