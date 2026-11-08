// Measures paint, layout shift, font arrival, and the benchmark picker's reveal
// on the built site. Build first; see README.md, "Paint Metrics".

import { parseArgs } from "node:util";
import { type Browser, chromium, type Page } from "playwright-core";
import { BENCHMARK_IDS } from "../src/domain/enums.ts";
import { median, requirePainted } from "./paint-stats.ts";
import { readPickerClearance } from "./picker-clearance.ts";
import { originOf, serveSite } from "./serve-site.ts";

const PHONE = { width: 390, height: 844 };
type Throttle = {
	latencyMs: number;
	downloadBytesPerSec: number;
	uploadBytesPerSec: number;
	cpuSlowdown: number;
};
const KBPS = 1024 / 8;
/** Lighthouse's simulated networks and CPUs.
 * ceiling: Chromium splits bandwidth evenly where HTTP/2 sends CSS before a
 * preloaded font; a WebPageTest run on the deployed site is the upgrade. */
const THROTTLES: Record<string, Throttle> = {
	mobile: {
		latencyMs: 150,
		downloadBytesPerSec: 1638 * KBPS,
		uploadBytesPerSec: 750 * KBPS,
		cpuSlowdown: 4,
	},
	desktop: {
		latencyMs: 40,
		downloadBytesPerSec: 10240 * KBPS,
		uploadBytesPerSec: 10240 * KBPS,
		cpuSlowdown: 1,
	},
};
const { values: args } = parseArgs({
	options: {
		runs: { type: "string", default: "5" },
		throttle: { type: "string", default: "mobile" },
	},
});
const runs = Number(args.runs);
if (!Number.isSafeInteger(runs) || runs < 1) {
	throw new Error("--runs takes a positive whole number");
}
const throttle = THROTTLES[args.throttle];
if (!throttle) {
	throw new Error(`--throttle takes ${Object.keys(THROTTLES).join(" or ")}`);
}

/** DNS, TCP, and TLS before the first request to a new origin. Chromium's
 * throttle adds latency per request only, which would make a third-party
 * origin look free. */
const CONNECT_RTTS = 3;
/** Late shifts (a font swap) land after network idle; wait this long for them. */
const SETTLE_MS = 1000;
/** ScrollRow.tsx's FADE_PX; Node cannot load that JSX module. */
const FADE_PX = 24;
/** ScrollRow.tsx's EDGE_SLACK_PX; Node cannot load that JSX module. */
const EDGE_SLACK_PX = 2;
/** Sub-pixel rounding below the fade's edge that still counts as clear. */
const CLEARANCE_TOLERANCE_PX = 0.5;
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

/** Holds the first requests to each origin other than the site's for a
 * connection setup; later requests reuse the connection. */
async function chargeConnectionSetup(page: Page, siteOrigin: string) {
	const setupMs = CONNECT_RTTS * throttle.latencyMs;
	const connections = new Map<string, Promise<void>>();
	await page.route(
		(url) => url.origin !== siteOrigin,
		async (route) => {
			const { origin } = new URL(route.request().url());
			let connected = connections.get(origin);
			if (!connected) {
				connected = new Promise((resolve) => setTimeout(resolve, setupMs));
				connections.set(origin, connected);
			}
			await connected;
			await route.continue();
		},
	);
}

async function throttledPage(browser: Browser, url: string): Promise<Page> {
	const context = await browser.newContext({
		viewport: PHONE,
		colorScheme: "light",
	});
	const page = await context.newPage();
	const cdp = await context.newCDPSession(page);
	await cdp.send("Network.emulateNetworkConditions", {
		offline: false,
		latency: throttle.latencyMs,
		downloadThroughput: throttle.downloadBytesPerSec,
		uploadThroughput: throttle.uploadBytesPerSec,
	});
	await cdp.send("Emulation.setCPUThrottlingRate", {
		rate: throttle.cpuSlowdown,
	});
	await chargeConnectionSetup(page, new URL(url).origin);
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

/** When each web font finished arriving, in epoch ms; `requestfinished`
 * reports it directly. */
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
	const page = await throttledPage(browser, url);
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
		if (fontArrivals.length === 0) {
			throw new Error(`${url} requested no web font (woff2) to time`);
		}
		requirePainted(url, sample);
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
function measureClearance(page: Page): Promise<number> {
	return page.evaluate(readPickerClearance, {
		picker: PICKER,
		fade: FADE_PX,
		slack: EDGE_SLACK_PX,
	});
}

/** Holds every font request until `release` runs. */
async function holdFonts(page: Page): Promise<() => void> {
	let release = () => {};
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route("**/*.woff2", async (route) => {
		await gate;
		await route.continue();
	});
	return release;
}

/** Waits until the linked view has rendered and been shown, which is after
 * ScrollRow revealed its benchmark, with the fonts still held. */
async function waitForFallbackReveal(page: Page): Promise<void> {
	await page.waitForFunction((picker) => {
		const pressed = document.querySelector(`${picker} [aria-pressed=true]`);
		const shown = !("viewPending" in document.documentElement.dataset);
		return pressed && shown && document.fonts.status === "loading";
	}, PICKER);
}

/** Loads the view with its fonts held until the reveal has run in the
 * fallback face, then lets them arrive and measures. */
async function pickerClearance(browser: Browser, url: string) {
	const page = await throttledPage(browser, url);
	try {
		const release = await holdFonts(page);
		await page.goto(url, { waitUntil: "domcontentloaded" });
		await waitForFallbackReveal(page);
		release();
		await page.evaluate(() => document.fonts.ready);
		await page.waitForTimeout(SETTLE_MS);
		return await measureClearance(page);
	} finally {
		await page.context().close();
	}
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

const server = await serveSite();
const browser = await chromium.launch();
try {
	const origin = originOf(server);
	const samples: PaintSample[] = [];
	for (let run = 0; run < runs; run++) {
		samples.push(await samplePaint(browser, origin));
	}
	console.log(`Paint over ${runs} cold loads of /, ${args.throttle} throttle:`);
	console.table(summarize(samples));

	const clearance: Record<string, number> = {};
	for (const id of BENCHMARK_IDS) {
		const px = await pickerClearance(browser, `${origin}?benchmark=${id}`);
		clearance[id] = Math.round(px * 10) / 10;
	}
	console.log("Selected benchmark's clearance from a fade, px:");
	console.table(clearance);
	const hidden = Object.entries(clearance).filter(
		([, px]) => px < -CLEARANCE_TOLERANCE_PX,
	);
	if (hidden.length > 0) {
		throw new Error(`Faded or hidden: ${hidden.map(([id]) => id).join(", ")}`);
	}
} finally {
	await browser.close();
	server.close();
}
