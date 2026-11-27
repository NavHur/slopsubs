// Measures paint, layout shift, font arrival, and the benchmark picker's reveal
// on the built site. Build first; see README.md, "Paint Metrics".

import { parseArgs } from "node:util";
import { Effect, Schema } from "effect";
import { type Browser, type Page } from "playwright-core";
import { BENCHMARK_IDS } from "../src/domain/enums.ts";
import { commandOptions } from "./effects/arguments.ts";
import {
	browserOperation,
	browserRead,
	BrowserCheckError,
	launchBrowser,
	siteOrigin,
} from "./effects/browser.ts";
import { median, requirePainted } from "./paint-stats.ts";
import { readPickerClearance } from "./picker-clearance.ts";

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
const Options = Schema.Struct({
	runs: Schema.NumberFromString.check(
		Schema.isInt(),
		Schema.isGreaterThan(0),
		Schema.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER),
	),
	throttle: Schema.Literals(["mobile", "desktop"]),
});

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
const chargeConnectionSetup = Effect.fnUntraced(function* (
	page: Page,
	siteOrigin: string,
	throttle: Throttle,
) {
	const setupMs = CONNECT_RTTS * throttle.latencyMs;
	const connections = new Map<string, Promise<void>>();
	yield* browserOperation("route", () =>
		page.route(
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
		),
	);
});

const throttledPage = Effect.fnUntraced(function* (
	browser: Browser,
	url: string,
	throttle: Throttle,
) {
	const context = yield* Effect.acquireRelease(
		browserOperation("Open paint context", () =>
			browser.newContext({ viewport: PHONE, colorScheme: "light" }),
		),
		(context) =>
			browserOperation("Close paint context", () => context.close()).pipe(
				Effect.orDie,
			),
	);
	const page = yield* browserOperation("newPage", () => context.newPage());
	const cdp = yield* browserOperation("newCDPSession", () =>
		context.newCDPSession(page),
	);
	yield* browserOperation("send", () =>
		cdp.send("Network.emulateNetworkConditions", {
			offline: false,
			latency: throttle.latencyMs,
			downloadThroughput: throttle.downloadBytesPerSec,
			uploadThroughput: throttle.uploadBytesPerSec,
		}),
	);
	yield* browserOperation("send", () =>
		cdp.send("Emulation.setCPUThrottlingRate", {
			rate: throttle.cpuSlowdown,
		}),
	);
	yield* chargeConnectionSetup(page, new URL(url).origin, throttle);
	yield* browserOperation("addInitScript", () =>
		page.addInitScript(observePaint),
	);
	return page;
});

const loadSettled = Effect.fnUntraced(function* (page: Page, url: string) {
	const response = yield* browserOperation("goto", () =>
		page.goto(url, { waitUntil: "networkidle" }),
	);
	if (!response?.ok()) {
		return yield* new BrowserCheckError({
			message: `${url} answered ${response?.status()}: build first`,
		});
	}
	yield* browserOperation("evaluate", () =>
		page.evaluate(() => document.fonts.ready),
	);
	yield* browserOperation("waitForTimeout", () =>
		page.waitForTimeout(SETTLE_MS),
	);
});

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

const PaintMetrics = Schema.Struct({
	firstPaintMs: Schema.Number,
	fcpMs: Schema.Number,
	lcpMs: Schema.Number,
	cls: Schema.Finite,
	timeOrigin: Schema.Finite,
});

const samplePaint = Effect.fnUntraced(function* (
	browser: Browser,
	url: string,
	throttle: Throttle,
) {
	const page = yield* throttledPage(browser, url, throttle);
	const fontArrivals = recordFontArrivals(page);
	yield* loadSettled(page, url);
	const sample = yield* browserRead(PaintMetrics, "Read paint metrics", () =>
		page.evaluate(() => {
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
		}),
	);
	if (fontArrivals.length === 0) {
		return yield* new BrowserCheckError({
			message: `${url} requested no web font (woff2) to time`,
		});
	}
	yield* requirePainted(url, sample);
	const { timeOrigin, ...paint } = sample;
	return {
		...paint,
		fontsDoneMs: Math.max(...fontArrivals) - timeOrigin,
	} satisfies PaintSample;
}, Effect.scoped);

/** Holds every font request until `release` runs. */
const holdFonts = Effect.fnUntraced(function* (page: Page) {
	let release = () => {};
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	yield* browserOperation("route", () =>
		page.route("**/*.woff2", async (route) => {
			await gate;
			await route.continue();
		}),
	);
	return release;
});

/** Waits until the linked view has rendered and been shown, which is after
 * ScrollRow revealed its benchmark, with the fonts still held. */
const waitForFallbackReveal = Effect.fnUntraced(function* (page: Page) {
	yield* browserOperation("waitForFunction", () =>
		page.waitForFunction((picker) => {
			const pressed = document.querySelector(`${picker} [aria-pressed=true]`);
			const shown = !("viewPending" in document.documentElement.dataset);
			return pressed && shown && document.fonts.status === "loading";
		}, PICKER),
	);
});

/** Loads the view with its fonts held until the reveal has run in the
 * fallback face, then lets them arrive and measures. */
const pickerClearance = Effect.fnUntraced(function* (
	browser: Browser,
	url: string,
	throttle: Throttle,
) {
	const page = yield* throttledPage(browser, url, throttle);
	const release = yield* holdFonts(page);
	yield* browserOperation("goto", () =>
		page.goto(url, { waitUntil: "domcontentloaded" }),
	);
	yield* waitForFallbackReveal(page);
	release();
	yield* browserOperation("evaluate", () =>
		page.evaluate(() => document.fonts.ready),
	);
	yield* browserOperation("waitForTimeout", () =>
		page.waitForTimeout(SETTLE_MS),
	);
	return yield* browserRead(Schema.Finite, "Read picker clearance", () =>
		page.evaluate(readPickerClearance, {
			picker: PICKER,
			fadePx: FADE_PX,
			slackPx: EDGE_SLACK_PX,
		}),
	);
}, Effect.scoped);

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

const main = Effect.gen(function* () {
	const args = yield* commandOptions(
		Options,
		() =>
			parseArgs({
				options: {
					runs: { type: "string", default: "5" },
					throttle: { type: "string", default: "mobile" },
				},
			}).values,
	);
	const runs = args.runs;
	const throttle = THROTTLES[args.throttle];
	const origin = yield* siteOrigin();
	const browser = yield* launchBrowser();
	const samples: PaintSample[] = [];
	for (let run = 0; run < runs; run++) {
		samples.push(yield* samplePaint(browser, origin, throttle));
	}
	console.log(`Paint over ${runs} cold loads of /, ${args.throttle} throttle:`);
	console.table(summarize(samples));

	const clearance: Record<string, number> = {};
	for (const id of BENCHMARK_IDS) {
		const px = yield* pickerClearance(
			browser,
			`${origin}?benchmark=${id}`,
			throttle,
		);
		clearance[id] = Math.round(px * 10) / 10;
	}
	console.log("Selected benchmark's clearance from a fade, px:");
	console.table(clearance);
	const hidden = Object.entries(clearance).filter(
		([, px]) => px < -CLEARANCE_TOLERANCE_PX,
	);
	if (hidden.length > 0) {
		return yield* new BrowserCheckError({
			message: `Faded or hidden: ${hidden.map(([id]) => id).join(", ")}`,
		});
	}
});
await Effect.runPromise(Effect.scoped(main));
