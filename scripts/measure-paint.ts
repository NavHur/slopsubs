// Measures first paint, layout shift, and web font arrival on the built site,
// and checks that the benchmark picker keeps the selected benchmark in view
// once the fonts have loaded. Build first; see README.md, "Paint Metrics".
//
//   bun run measure-paint [--runs 5]
//
// Each load gets a fresh browser context (cold cache) on a phone viewport,
// throttled like Lighthouse's mobile profile.

import { parseArgs } from "node:util";
import { type Browser, chromium, type Page } from "playwright-core";
import { BENCHMARK_IDS } from "../src/domain/model.ts";
import { originOf, serveSite } from "./serve-site.ts";

const PHONE = { width: 390, height: 844 };
/** Lighthouse's simulated mobile network and CPU. */
const THROTTLE = {
	latencyMs: 150,
	downloadBytesPerSec: (1.6 * 1024 * 1024) / 8,
	uploadBytesPerSec: (750 * 1024) / 8,
	cpuSlowdown: 4,
};
/** Late shifts (a font swap) land after network idle; wait this long for them. */
const SETTLE_MS = 1000;
/** ScrollRow.tsx's FADE_PX; Node cannot load that JSX module. */
const FADE_PX = 24;
const PICKER = 'fieldset[aria-label="Benchmark that defines a task"]';

type PaintSample = {
	firstPaintMs: number;
	fcpMs: number;
	lcpMs: number;
	cls: number;
	fontsDoneMs: number;
};

/** Collects layout shifts and the largest paint from the first byte on. */
function observePaint() {
	const paint = { cls: 0, lcp: 0 };
	Object.assign(window, { __paint: paint });
	new PerformanceObserver((list) => {
		for (const entry of list.getEntries() as (PerformanceEntry & {
			value: number;
			hadRecentInput: boolean;
		})[]) {
			if (!entry.hadRecentInput) paint.cls += entry.value;
		}
	}).observe({ type: "layout-shift", buffered: true });
	new PerformanceObserver((list) => {
		paint.lcp = list.getEntries().at(-1)?.startTime ?? paint.lcp;
	}).observe({ type: "largest-contentful-paint", buffered: true });
}

async function throttledPage(browser: Browser): Promise<Page> {
	const context = await browser.newContext({
		viewport: PHONE,
		colorScheme: "light",
	});
	const page = await context.newPage();
	const cdp = await context.newCDPSession(page);
	await cdp.send("Network.emulateNetworkConditions", {
		offline: false,
		latency: THROTTLE.latencyMs,
		downloadThroughput: THROTTLE.downloadBytesPerSec,
		uploadThroughput: THROTTLE.uploadBytesPerSec,
	});
	await cdp.send("Emulation.setCPUThrottlingRate", {
		rate: THROTTLE.cpuSlowdown,
	});
	await page.addInitScript(observePaint);
	return page;
}

async function loadSettled(page: Page, url: string): Promise<void> {
	const response = await page.goto(url, { waitUntil: "networkidle" });
	if (!response?.ok()) {
		throw new Error(`${url} answered ${response?.status()}: build first`);
	}
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(SETTLE_MS);
}

/** When each web font finished arriving, in epoch ms. Resource timing
 * leaves out fonts a cross-origin stylesheet requests, so this listens. */
function recordFontArrivals(page: Page): number[] {
	const arrivals: number[] = [];
	page.on("requestfinished", (request) => {
		if (request.resourceType() !== "font") return;
		const timing = request.timing();
		arrivals.push(timing.startTime + timing.responseEnd);
	});
	return arrivals;
}

async function samplePaint(browser: Browser, url: string) {
	const page = await throttledPage(browser);
	const fontArrivals = recordFontArrivals(page);
	try {
		await loadSettled(page, url);
		const sample = await page.evaluate(() => {
			const { cls, lcp } = (
				window as unknown as { __paint: { cls: number; lcp: number } }
			).__paint;
			const paintAt = (name: string) =>
				performance.getEntriesByName(name)[0]?.startTime ?? Number.NaN;
			return {
				firstPaintMs: paintAt("first-paint"),
				fcpMs: paintAt("first-contentful-paint"),
				lcpMs: lcp,
				cls,
				timeOrigin: performance.timeOrigin,
			};
		});
		const { timeOrigin, ...paint } = sample;
		return {
			...paint,
			fontsDoneMs: Math.max(...fontArrivals) - timeOrigin,
		} satisfies PaintSample;
	} finally {
		await page.context().close();
	}
}

/** How far the pressed benchmark sits inside the picker's unfaded band;
 * negative means part of it is faded or hidden. */
async function pickerClearance(browser: Browser, url: string) {
	const page = await throttledPage(browser);
	try {
		await loadSettled(page, url);
		return await page.evaluate(
			({ picker, fade }) => {
				const fieldset = document.querySelector(picker);
				const row = fieldset?.parentElement;
				const pressed = fieldset?.querySelector("[aria-pressed=true]");
				if (!row || !pressed) throw new Error("No benchmark picker");
				const box = row.getBoundingClientRect();
				const target = pressed.getBoundingClientRect();
				const maxScroll = row.scrollWidth - row.clientWidth;
				const fadeStart = row.scrollLeft > 2 ? fade : 0;
				const fadeEnd = row.scrollLeft < maxScroll - 2 ? fade : 0;
				return Math.min(
					target.left - (box.left + fadeStart),
					box.right - fadeEnd - target.right,
				);
			},
			{ picker: PICKER, fade: FADE_PX },
		);
	} finally {
		await page.context().close();
	}
}

function median(values: number[]): number {
	const sorted = values.toSorted((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)];
}

function summarize(samples: PaintSample[]) {
	const keys = Object.keys(samples[0]) as (keyof PaintSample)[];
	return Object.fromEntries(
		keys.map((key) => {
			const values = samples.map((sample) => sample[key]);
			const digits = key === "cls" ? 4 : 0;
			return [
				key,
				{
					median: Number(median(values).toFixed(digits)),
					min: Number(Math.min(...values).toFixed(digits)),
					max: Number(Math.max(...values).toFixed(digits)),
				},
			];
		}),
	);
}

const { values: args } = parseArgs({
	options: { runs: { type: "string", default: "5" } },
});
const runs = Number(args.runs);

const server = await serveSite();
const browser = await chromium.launch();
try {
	const origin = originOf(server);
	const samples: PaintSample[] = [];
	for (let run = 0; run < runs; run++) {
		samples.push(await samplePaint(browser, origin));
	}
	console.log(`Paint over ${runs} cold loads of /:`);
	console.table(summarize(samples));

	const clearance: Record<string, number> = {};
	for (const id of BENCHMARK_IDS) {
		const px = await pickerClearance(browser, `${origin}?benchmark=${id}`);
		clearance[id] = Math.round(px * 10) / 10;
	}
	console.log("Selected benchmark's clearance from a fade, px:");
	console.table(clearance);
	const hidden = Object.entries(clearance).filter(([, px]) => px < -0.5);
	if (hidden.length > 0) {
		throw new Error(`Faded or hidden: ${hidden.map(([id]) => id).join(", ")}`);
	}
} finally {
	await browser.close();
	server.close();
}
