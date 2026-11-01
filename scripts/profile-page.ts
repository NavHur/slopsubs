// Profiles the home page's re-renders and scroll cost on the built site.
//
//   vp build --minify false   (component names survive; React stays in
//                              production mode)
//   node scripts/profile-page.ts [--out profile.json]
//
// Scrolls the page down to the end and back with the wheel, at a desktop and
// a phone width, follows each nav link and a deep link, then hovers each
// chart's points. Render counts come from a probe on the React DevTools hook.

import { writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { parseArgs } from "node:util";
import { type Browser, chromium, type Page } from "playwright-core";
import type { ProbeStats } from "./page-probe.ts";
import {
	openPage,
	pointAtGutter,
	settle,
	VIEWPORTS,
	type ViewportName,
} from "./page-session.ts";
import { serveSite } from "./serve-site.ts";

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

function resetProbe(page: Page) {
	return page.evaluate(() =>
		(window as unknown as { __probe: { reset: () => void } }).__probe.reset(),
	);
}

function readProbe(page: Page): Promise<ProbeStats> {
	return page.evaluate(() =>
		structuredClone(
			(window as unknown as { __probe: { stats: ProbeStats } }).__probe.stats,
		),
	);
}

/** The scroll position, the section the nav marks, and the URL's chart. */
function readStep(page: Page): Promise<Step & { atEnd: boolean }> {
	return page.evaluate(() => {
		// No getComputedStyle here: the probe counts the page's own calls.
		const main = document.querySelector("main");
		const scroller =
			main && main.scrollHeight > main.clientHeight
				? main
				: (document.scrollingElement as HTMLElement);
		const { scrollTop, scrollHeight, clientHeight } = scroller;
		return {
			scrollTop: Math.round(scrollTop),
			atEnd: scrollHeight - scrollTop - clientHeight <= 1,
			active:
				document.querySelector('[aria-current="location"]')?.textContent ?? "",
			chartParam: new URL(location.href).searchParams.get("chart"),
		};
	});
}

/**
 * Wheels from the top to the end and back, recording each step and the wheel
 * deltas that made the pass.
 */
async function wheelPass(page: Page, viewport: ViewportName) {
	await pointAtGutter(page, viewport);
	const steps: Step[] = [];
	const wheel: number[] = [];
	for (const direction of [1, -1]) {
		for (let i = 0; i < MAX_STEPS; i++) {
			wheel.push(direction * WHEEL_STEP_PX);
			await page.mouse.wheel(0, direction * WHEEL_STEP_PX);
			await settle(page);
			const { atEnd, ...step } = await readStep(page);
			steps.push(step);
			if (direction > 0 ? atEnd : step.scrollTop === 0) break;
		}
	}
	return { steps, wheel };
}

async function countedScroll(
	browser: Browser,
	origin: string,
	viewport: ViewportName,
): Promise<ScrollPass> {
	const page = await openPage(browser, origin, viewport, true);
	await resetProbe(page);
	const { steps, wheel } = await wheelPass(page, viewport);
	const probe = await readProbe(page);
	await page.close();
	return { steps, wheel, probe };
}

/** Centres of the chart's first points that sit inside the viewport. */
function pointCentres(page: Page, chart: string) {
	return page.evaluate(
		({ id, limit }) =>
			[...document.querySelectorAll(`#${id} svg [role="button"]`)]
				.map((point) => point.getBoundingClientRect())
				.filter((r) => r.top > 120 && r.bottom < innerHeight)
				.slice(0, limit)
				.map((r) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 })),
		{ id: chart, limit: HOVERS_PER_CHART },
	);
}

/** Renders while the pointer visits each chart's points and leaves. */
async function countedHover(browser: Browser, origin: string) {
	const page = await openPage(browser, origin, "desktop", true);
	const result: Record<string, ProbeStats & { hovered: number }> = {};
	for (const chart of CHARTS) {
		await page.locator(`#${chart}`).evaluate((el) => el.scrollIntoView());
		await settle(page, 300);
		const centres = await pointCentres(page, chart);
		await page.mouse.move(6, 600);
		await resetProbe(page);
		for (const { x, y } of centres) {
			await page.mouse.move(x, y);
			await settle(page);
		}
		await page.mouse.move(6, 600);
		await settle(page);
		result[chart] = { hovered: centres.length, ...(await readProbe(page)) };
	}
	await page.close();
	return result;
}

/** Where the nav and URL land after each link click, and after a deep link. */
async function navJumps(browser: Browser, origin: string) {
	const page = await openPage(browser, origin, "desktop", false);
	const landed = async () => {
		await settle(page, JUMP_SETTLE_MS);
		const { atEnd: _, ...step } = await readStep(page);
		return step;
	};
	const result: Record<string, Step> = {};
	const nav = page.getByRole("navigation", { name: "Charts" });
	for (const label of ["Cost per task", "Tasks per week", "Cost vs score"]) {
		await nav.getByRole("link", { name: label }).click();
		result[`click ${label}`] = await landed();
	}
	await page.goto(`${origin}?chart=ranked-cost`, { waitUntil: "networkidle" });
	result["open ?chart=ranked-cost"] = await landed();
	await page.close();
	return result;
}

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

const { values } = parseArgs({ options: { out: { type: "string" } } });
const server = await serveSite();
const browser = await chromium.launch({ args: ["--disable-smooth-scrolling"] });
try {
	const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
	const report: Record<string, unknown> = {};
	for (const viewport of Object.keys(VIEWPORTS) as ViewportName[]) {
		const counted = await countedScroll(browser, origin, viewport);
		report[`scroll-${viewport}`] = counted;
		summarize(`scroll, ${viewport}`, counted.probe, {
			steps: counted.steps.length,
			sectionChanges: sectionChanges(counted.steps),
		});
	}
	report.jumps = await navJumps(browser, origin);
	console.log("\nnav jumps", report.jumps);
	const hover = await countedHover(browser, origin);
	report.hover = hover;
	for (const [chart, probe] of Object.entries(hover)) {
		summarize(`hover, ${chart}`, probe, { hovered: probe.hovered });
	}
	if (values.out)
		await writeFile(values.out, JSON.stringify(report, null, "\t"));
} finally {
	await browser.close();
	server.close();
}
