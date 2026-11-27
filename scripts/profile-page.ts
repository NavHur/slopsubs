// Profiles the home page's re-renders and scroll cost on the built site; see
// README, "Profiling The Home Page". Run: node scripts/profile-page.ts

import { parseArgs } from "node:util";
import { Effect, Schema } from "effect";
import { type Browser, type Page } from "playwright-core";
import { commandOptions } from "./effects/arguments.ts";
import {
	browserOperation,
	browserRead,
	launchBrowser,
	siteOrigin,
} from "./effects/browser.ts";
import { TextFiles } from "./effects/files.ts";
import { countedProbe, type ProbeStats, uncountedProbe } from "./page-probe.ts";
import {
	openPage,
	pointAtGutter,
	settle,
	VIEWPORTS,
	type ViewportName,
} from "./page-session.ts";
import { CPU_SLOWDOWN, scrollTimings } from "./scroll-timing.ts";
import { stepUntil } from "./step-until.ts";

const WHEEL_STEP_PX = 120;
/** Stops a pass that never reaches the end. */
const MAX_STEPS = 200;
/** Points hovered per chart. */
const HOVERS_PER_CHART = 12;
/** Outlasts the nav's jump window, after which the spy reports again. */
const JUMP_SETTLE_MS = 1300;
const CHARTS = ["cost-vs-score", "tasks-per-week", "ranked-cost"] as const;

/** Where the page stands after one wheel step. */
type Step = { scrollTop: number; active: string; chartParam: string | null };

type ScrollPass = { steps: Step[]; wheel: number[]; probe: ProbeStats };

const resetProbe = Effect.fnUntraced(function* (page: Page) {
	return yield* browserOperation("resetProbe", () =>
		page.evaluate(() =>
			// SAFETY: the init script set window.__probe before the page loaded.
			(window as unknown as { __probe: { reset: () => void } }).__probe.reset(),
		),
	);
});

const ProbeStatsWire = Schema.Struct({
	commits: Schema.Int,
	renders: Schema.Record(Schema.String, Schema.Int),
	scrollEvents: Schema.Int,
	rectReads: Schema.Int,
	styleReads: Schema.Int,
});
const StepWire = Schema.Struct({
	scrollTop: Schema.Finite,
	active: Schema.String,
	atEnd: Schema.Boolean,
	chartParam: Schema.NullOr(Schema.String),
});
const PointCentresWire = Schema.Array(
	Schema.Struct({ x: Schema.Finite, y: Schema.Finite }),
);

const readProbe = Effect.fnUntraced(function* (page: Page) {
	return yield* browserRead(ProbeStatsWire, "Read probe", () =>
		page.evaluate(() =>
			structuredClone(
				// SAFETY: the init script set window.__probe before the page loaded.
				(window as unknown as { __probe: { stats: ProbeStats } }).__probe.stats,
			),
		),
	);
});

/** The scroll position, the section the nav marks, and the URL's chart. */
const readStep = Effect.fnUntraced(function* (page: Page) {
	return yield* browserRead(StepWire, "Read step", () =>
		page.evaluate(() => {
			// No getComputedStyle here: the probe counts the page's own calls.
			const main = document.querySelector("main");
			const scroller =
				main && main.scrollHeight > main.clientHeight
					? main
					: (document.scrollingElement ?? document.documentElement);
			const { scrollTop, scrollHeight, clientHeight } = scroller;
			return {
				scrollTop: Math.round(scrollTop),
				atEnd: scrollHeight - scrollTop - clientHeight <= 1,
				active:
					document.querySelector('[aria-current="location"]')?.textContent ??
					"",
				chartParam: new URL(location.href).searchParams.get("chart"),
			};
		}),
	);
});

/** Wheels in one direction until `done` says the page has reached its end. */
const wheelUntil = Effect.fnUntraced(function* (
	page: Page,
	viewport: ViewportName,
	direction: 1 | -1,
	done: (step: Step & { atEnd: boolean }) => boolean,
) {
	const delta = direction * WHEEL_STEP_PX;
	const reached = yield* stepUntil(
		() =>
			Effect.gen(function* () {
				yield* browserOperation("Wheel", () => page.mouse.wheel(0, delta));
				yield* settle(page);
				return yield* readStep(page);
			}),
		done,
		MAX_STEPS,
		`${viewport} wheel pass to the ${direction === 1 ? "end" : "top"}`,
	);
	const steps = reached.map(({ scrollTop, active, chartParam }): Step => ({
		scrollTop,
		active,
		chartParam,
	}));
	return { steps, wheel: steps.map(() => delta) };
});

/**
 * Wheels from the top to the end and back, recording each step and the wheel
 * deltas that made the pass.
 */
const wheelPass = Effect.fnUntraced(function* (
	page: Page,
	viewport: ViewportName,
) {
	yield* pointAtGutter(page, viewport);
	const down = yield* wheelUntil(page, viewport, 1, (step) => step.atEnd);
	const up = yield* wheelUntil(
		page,
		viewport,
		-1,
		(step) => step.scrollTop === 0,
	);
	return {
		steps: [...down.steps, ...up.steps],
		wheel: [...down.wheel, ...up.wheel],
	};
});

const countedScroll = Effect.fnUntraced(function* (
	browser: Browser,
	origin: string,
	viewport: ViewportName,
) {
	const page = yield* openPage(browser, origin, viewport, countedProbe);
	yield* resetProbe(page);
	const { steps, wheel } = yield* wheelPass(page, viewport);
	const probe = yield* readProbe(page);

	return { steps, wheel, probe };
}, Effect.scoped);

/** Centres of the chart's first points that sit inside the viewport. */
const pointCentres = Effect.fnUntraced(function* (page: Page, chart: string) {
	return yield* browserRead(PointCentresWire, "Read point centres", () =>
		page.evaluate(
			({ id, limit }) =>
				[...document.querySelectorAll(`#${id} svg [role="button"]`)]
					.map((point) => point.getBoundingClientRect())
					.filter((r) => r.top > 120 && r.bottom < innerHeight)
					.slice(0, limit)
					.map((r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })),
			{ id: chart, limit: HOVERS_PER_CHART },
		),
	);
});

/** Renders while the pointer visits each chart's points and leaves. */
const countedHover = Effect.fnUntraced(function* (
	browser: Browser,
	origin: string,
) {
	const page = yield* openPage(browser, origin, "desktop", countedProbe);
	const result: Record<string, ProbeStats & { hovered: number }> = {};
	for (const chart of CHARTS) {
		yield* browserOperation("evaluate", () =>
			page.locator(`#${chart}`).evaluate((el) => el.scrollIntoView()),
		);
		yield* settle(page, 300);
		const centres = yield* pointCentres(page, chart);
		yield* browserOperation("move", () => page.mouse.move(6, 600));
		yield* resetProbe(page);
		for (const { x, y } of centres) {
			yield* browserOperation("move", () => page.mouse.move(x, y));
			yield* settle(page);
		}
		yield* browserOperation("move", () => page.mouse.move(6, 600));
		yield* settle(page);
		result[chart] = { hovered: centres.length, ...(yield* readProbe(page)) };
	}

	return result;
}, Effect.scoped);

/** Where the nav and URL land after each link click, and after a deep link. */
const navJumps = Effect.fnUntraced(function* (
	browser: Browser,
	origin: string,
) {
	const page = yield* openPage(browser, origin, "desktop", uncountedProbe);
	const landed = () =>
		Effect.gen(function* () {
			yield* settle(page, JUMP_SETTLE_MS);
			const { atEnd: _, ...step } = yield* readStep(page);
			return step;
		});
	const result: Record<string, Step> = {};
	const nav = page.getByRole("navigation", { name: "Charts" });
	for (const label of ["Cost per task", "Tasks per week", "Cost vs score"]) {
		yield* browserOperation("click", () =>
			nav.getByRole("link", { name: label }).click(),
		);
		result[`click ${label}`] = yield* landed();
	}
	yield* browserOperation("goto", () =>
		page.goto(`${origin}?chart=ranked-cost`, { waitUntil: "networkidle" }),
	);
	result["open ?chart=ranked-cost"] = yield* landed();

	return result;
}, Effect.scoped);

/** Section changes in a pass: steps where the marked section differs. */
function sectionChanges(steps: readonly Step[]) {
	return steps.filter((s, i) => i > 0 && s.active !== steps[i - 1].active)
		.length;
}

function totalRenders(probe: ProbeStats) {
	return Object.values(probe.renders).reduce((sum, n) => sum + n, 0);
}

function summarize(name: string, probe: ProbeStats, extra: object = {}) {
	const top = Object.entries(probe.renders)
		.sort((a, b) => b[1] - a[1])
		.slice(0, 8)
		.map(([component, n]) => `${component} ${n}`)
		.join(", ");
	console.log(`\n${name}`, {
		...extra,
		commits: probe.commits,
		renders: totalRenders(probe),
		scrollEvents: probe.scrollEvents,
		rectReads: probe.rectReads,
		styleReads: probe.styleReads,
	});
	console.log(`  most rendered: ${top || "none"}`);
}

const main = Effect.gen(function* () {
	const values = yield* commandOptions(
		Schema.Struct({ out: Schema.optional(Schema.NonEmptyString) }),
		() => parseArgs({ options: { out: { type: "string" } } }).values,
	);
	const files = yield* TextFiles;
	const origin = yield* siteOrigin();
	const browser = yield* launchBrowser({
		args: ["--disable-smooth-scrolling"],
	});
	const report: Record<string, unknown> = {};
	for (const viewport of Object.keys(VIEWPORTS) as ViewportName[]) {
		const counted: ScrollPass = yield* countedScroll(browser, origin, viewport);
		const timed = yield* scrollTimings(
			browser,
			origin,
			viewport,
			counted.wheel,
		);
		report[`scroll-${viewport}`] = { ...counted, timed };
		summarize(`scroll, ${viewport}`, counted.probe, {
			steps: counted.steps.length,
			sectionChanges: sectionChanges(counted.steps),
		});
		console.log(`  timed at ${CPU_SLOWDOWN}x slowdown:`, timed);
	}
	report.jumps = yield* navJumps(browser, origin);
	console.log("\nnav jumps", report.jumps);
	const hover = yield* countedHover(browser, origin);
	report.hover = hover;
	for (const [chart, probe] of Object.entries(hover)) {
		summarize(`hover, ${chart}`, probe, { hovered: probe.hovered });
	}
	if (values.out)
		yield* files.write(values.out, JSON.stringify(report, null, "\t"));
});
await Effect.runPromise(
	Effect.scoped(main).pipe(Effect.provide(TextFiles.layer)),
);
