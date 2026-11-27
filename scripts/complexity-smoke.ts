// Checks the built page before and after a refactor. Record a baseline first;
// rerun with --compare against it to check screenshots as well as interactions.
import { join } from "node:path";
import { parseArgs } from "node:util";
import { Effect, Schema } from "effect";
import { type Browser, type Locator, type Page } from "playwright-core";
import { commandOptions } from "./effects/arguments.ts";
import {
	browserOperation,
	browserRead,
	checkEqual,
	checkTrue,
	checkDeepEqual,
	openBrowserPage,
	launchBrowser,
	siteOrigin,
} from "./effects/browser.ts";
import { TextFiles } from "./effects/files.ts";
import { VIEWPORTS } from "./page-session.ts";
import { baselineDirectory } from "./smoke-dirs.ts";

const Options = Schema.Struct({
	origin: Schema.optional(
		Schema.String.check(
			Schema.makeFilter((url) => URL.canParse(url) || "Expected an origin URL"),
		),
	),
	out: Schema.NonEmptyString,
	compare: Schema.optional(Schema.String),
});
const MAX_CHANNEL_DELTA = 1;
const MAX_CHANGED_CHANNEL_SHARE = 0.0001;
/** Long enough for the pointer-leave preview to clear before a screenshot. */
const PREVIEW_CLEAR_MS = 400;
/** Long enough for a section-jump scroll to end and the nav to mark its target. */
const SECTION_JUMP_MS = 1100;
/** The viewport width from which the chart settings menu is shown. */
const SETTINGS_MENU_MIN_WIDTH = 640;

const ImageDifference = Schema.Struct({
	sameSize: Schema.Boolean,
	maxDelta: Schema.Finite,
	changedChannels: Schema.Int,
	channels: Schema.Int,
});

const imageDifference = Effect.fnUntraced(function* (
	page: Page,
	before: Buffer,
	after: Buffer,
) {
	return yield* browserRead(ImageDifference, "Decode screenshots", () =>
		page.evaluate(
			async (images) => {
				async function pixels(image: string) {
					const bytes = Uint8Array.from(atob(image), (char) =>
						char.charCodeAt(0),
					);
					const blob = new Blob([bytes], { type: "image/png" });
					const bitmap = await createImageBitmap(blob);
					const canvas = document.createElement("canvas");
					canvas.width = bitmap.width;
					canvas.height = bitmap.height;
					const context = canvas.getContext("2d");
					if (!context) throw new Error("No screenshot decoding context");
					context.drawImage(bitmap, 0, 0);
					return context.getImageData(0, 0, canvas.width, canvas.height).data;
				}
				const [a, b] = await Promise.all(images.map(pixels));
				let maxDelta = 0;
				let changedChannels = 0;
				a.forEach((value, i) => {
					const delta = Math.abs(value - b[i]);
					maxDelta = Math.max(maxDelta, delta);
					changedChannels += Number(delta !== 0);
				});
				return {
					sameSize: a.length === b.length,
					maxDelta,
					changedChannels,
					channels: a.length,
				};
			},
			[before.toString("base64"), after.toString("base64")],
		),
	);
});

type CapturePaths = { out: string; baselineDir?: string };

const capture = Effect.fnUntraced(function* (
	page: Page,
	name: string,
	paths: CapturePaths,
) {
	const files = yield* TextFiles;
	yield* browserOperation("move", () => page.mouse.move(0, 0));
	yield* browserOperation("waitForTimeout", () =>
		page.waitForTimeout(PREVIEW_CLEAR_MS),
	);
	const image = yield* browserOperation("screenshot", () =>
		page.screenshot({ animations: "disabled" }),
	);
	const before =
		paths.baselineDir === undefined
			? undefined
			: yield* files.readBytes(join(paths.baselineDir, `${name}.png`));
	yield* files.write(join(paths.out, `${name}.png`), image);
	if (before === undefined) return;
	const difference = yield* imageDifference(page, before, image);
	console.log(name, difference);
	yield* checkTrue(difference.sameSize, `${name}: screenshot size differs`);
	// Chromium's clipped edge fades can differ by one channel level on a few pixels.
	yield* checkTrue(
		difference.maxDelta <= MAX_CHANNEL_DELTA,
		`${name}: rendered pixels differ`,
	);
	yield* checkTrue(
		difference.changedChannels <=
			difference.channels * MAX_CHANGED_CHANNEL_SHARE,
		`${name}: too many pixels differ`,
	);
});

/** Playwright's observations are decoded like any value out of the browser. */
const menuExpanded = (trigger: Locator) =>
	browserRead(Schema.NullOr(Schema.String), "Read aria-expanded", () =>
		trigger.getAttribute("aria-expanded"),
	);
const hasFocus = (locator: Locator) =>
	browserRead(Schema.Boolean, "Read focus", () =>
		locator.evaluate((el) => el === document.activeElement),
	);
const countOf = (locator: Locator) =>
	browserRead(Schema.Int, "Count elements", () => locator.count());
const currentSection = (nav: Locator) =>
	browserRead(Schema.NullOr(Schema.String), "Read current section", () =>
		nav.locator('[aria-current="location"]').textContent(),
	);

/** Moves focus off the trigger, so Escape has to bring it back. */
const focusInsideMenu = Effect.fnUntraced(function* (trigger: Locator) {
	yield* browserOperation("focus", () =>
		trigger
			.locator("xpath=following-sibling::div")
			.getByRole("button", { name: "Labels", exact: true })
			.focus(),
	);
});

function settingsTrigger(page: Page) {
	return page.getByRole("button", { name: "Chart settings", exact: true });
}

function detailsCloser(page: Page) {
	return page.getByRole("button", { name: "Close details" });
}

/** Pins the first point of the cost vs score chart from the keyboard. */
const pinFirstPoint = Effect.fnUntraced(function* (page: Page) {
	yield* browserOperation("focus", () =>
		page.locator('#cost-vs-score svg g[role="button"]').first().focus(),
	);
	yield* browserOperation("press", () => page.keyboard.press("Enter"));
});

const settings = Effect.fnUntraced(function* (page: Page) {
	const trigger = settingsTrigger(page);
	yield* browserOperation("click", () => trigger.click());
	yield* checkEqual(yield* menuExpanded(trigger), "true");
	yield* focusInsideMenu(trigger);
	yield* browserOperation("press", () => page.keyboard.press("Escape"));
	yield* checkEqual(yield* menuExpanded(trigger), "false");
	yield* checkEqual(yield* hasFocus(trigger), true);
	yield* browserOperation("click", () => trigger.click());
	yield* browserOperation("dispatchEvent", () =>
		page.getByRole("heading", { level: 1 }).dispatchEvent("pointerdown"),
	);
	yield* checkEqual(yield* menuExpanded(trigger), "false");
	yield* browserOperation("click", () => trigger.click());
	yield* browserOperation("focus", () =>
		page.getByRole("button", { name: "Toggle light and dark theme" }).focus(),
	);
	yield* checkEqual(yield* menuExpanded(trigger), "false");
});

/** Escape that closes the menu must stop there, leaving a pinned point open. */
const menuEscapeKeepsPinnedPoint = Effect.fnUntraced(function* (page: Page) {
	const details = detailsCloser(page);
	yield* pinFirstPoint(page);
	yield* checkEqual(yield* countOf(details), 1);
	const trigger = settingsTrigger(page);
	yield* browserOperation("click", () => trigger.click());
	yield* focusInsideMenu(trigger);
	yield* browserOperation("press", () => page.keyboard.press("Escape"));
	yield* checkEqual(yield* menuExpanded(trigger), "false");
	yield* checkEqual(yield* hasFocus(trigger), true);
	yield* checkEqual(yield* countOf(details), 1);
	yield* browserOperation("press", () => page.keyboard.press("Escape"));
	yield* checkEqual(yield* countOf(details), 0);
});

const points = Effect.fnUntraced(function* (page: Page) {
	const details = detailsCloser(page);
	yield* pinFirstPoint(page);
	yield* checkEqual(yield* countOf(details), 1);
	yield* browserOperation("press", () => page.keyboard.press("Escape"));
	yield* checkEqual(yield* countOf(details), 0);
});

const navigation = Effect.fnUntraced(function* (page: Page) {
	const nav = page.getByRole("navigation", { name: "Charts", exact: true });
	yield* browserOperation("click", () =>
		nav.getByRole("link", { name: "Tasks per week", exact: true }).click(),
	);
	yield* browserOperation("waitForFunction", () =>
		page.waitForFunction(
			() =>
				new URL(location.href).searchParams.get("chart") === "tasks-per-week",
		),
	);
	yield* browserOperation("waitForTimeout", () =>
		page.waitForTimeout(SECTION_JUMP_MS),
	);
	yield* checkEqual(yield* currentSection(nav), "Tasks per week");
	yield* browserOperation("click", () =>
		nav.getByRole("link", { name: "Cost vs score", exact: true }).click(),
	);
	yield* browserOperation("waitForTimeout", () =>
		page.waitForTimeout(SECTION_JUMP_MS),
	);
	yield* checkEqual(yield* currentSection(nav), "Cost vs score");
});

const overflow = Effect.fnUntraced(function* (page: Page) {
	const picker = page.locator(
		'fieldset[aria-label="Benchmark that defines a task"]',
	);
	const frame = picker.locator("../..");
	yield* browserOperation("evaluate", () =>
		picker.locator("..").evaluate((row) => {
			row.scrollLeft = row.scrollWidth;
			row.dispatchEvent(new Event("scroll"));
		}),
	);
	yield* browserOperation("waitFor", () =>
		frame.getByRole("button", { name: "Scroll left", exact: true }).waitFor(),
	);
	yield* checkEqual(
		yield* countOf(
			frame.getByRole("button", { name: "Scroll right", exact: true }),
		),
		0,
	);
	yield* browserOperation("evaluate", () =>
		page.evaluate(() => document.fonts.dispatchEvent(new Event("loadingdone"))),
	);
	yield* browserOperation("waitFor", () =>
		frame.getByRole("button", { name: "Scroll right", exact: true }).waitFor(),
	);
	yield* checkEqual(
		yield* countOf(
			frame.getByRole("button", { name: "Scroll left", exact: true }),
		),
		0,
	);
});

const viewport = Effect.fnUntraced(function* (
	browser: Browser,
	size: { width: number; height: number },
	origin: string,
	paths: CapturePaths,
) {
	const { width } = size;
	const page = yield* openBrowserPage(browser, {
		viewport: size,
		reducedMotion: "reduce",
		colorScheme: "dark",
	});
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	yield* browserOperation("goto", () =>
		page.goto(origin, { waitUntil: "networkidle" }),
	);
	yield* browserOperation("waitFor", () =>
		page.locator('[aria-current="location"]').waitFor(),
	);
	yield* browserOperation("waitForFunction", () =>
		page.waitForFunction(() => {
			const plot = document.querySelector<HTMLElement>(
				"#cost-vs-score [data-chart-width]",
			);
			return (
				plot !== null &&
				Math.abs(
					Number(plot.dataset.chartWidth) - plot.getBoundingClientRect().width,
				) < 1
			);
		}),
	);
	yield* browserOperation("evaluate", () =>
		page.evaluate(() => document.fonts.ready),
	);
	yield* capture(page, `${width}-initial`, paths);
	if (width >= SETTINGS_MENU_MIN_WIDTH) {
		yield* settings(page);
		yield* menuEscapeKeepsPinnedPoint(page);
		yield* browserOperation("click", () => settingsTrigger(page).click());
		yield* capture(page, `${width}-settings`, paths);
		yield* browserOperation("press", () => page.keyboard.press("Escape"));
	}
	yield* points(page);
	yield* overflow(page);
	yield* navigation(page);
	yield* checkDeepEqual(errors, []);

	console.log(
		`${width}px: point pinning, overflow arrows and section jumps passed, ${paths.baselineDir === undefined ? "screenshots recorded" : "screenshots matched"} (settings on desktop)`,
	);
}, Effect.scoped);

const main = Effect.gen(function* () {
	const values = yield* commandOptions(
		Options,
		() =>
			parseArgs({
				options: {
					origin: { type: "string" },
					out: { type: "string", default: "/tmp/slopsubs-smoke" },
					compare: { type: "string" },
				},
			}).values,
	);
	const baselineDir = yield* baselineDirectory(values.out, values.compare);
	const files = yield* TextFiles;
	yield* files.makeDirectory(values.out);
	const origin = yield* siteOrigin(values.origin);
	const browser = yield* launchBrowser({ headless: true });
	const paths = { out: values.out, baselineDir };
	yield* viewport(browser, VIEWPORTS.desktop, origin, paths);
	yield* viewport(browser, VIEWPORTS.phone, origin, paths);
});
await Effect.runPromise(
	Effect.scoped(main).pipe(Effect.provide(TextFiles.layer)),
);
