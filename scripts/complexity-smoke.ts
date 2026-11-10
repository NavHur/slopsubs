// Checks the built page before and after a refactor. Record a baseline first;
// rerun with --compare against it to check screenshots as well as interactions.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { chromium, type Locator, type Page } from "playwright-core";
import { VIEWPORTS } from "./page-session.ts";
import { originOf, serveSite } from "./serve-site.ts";
import { baselineDirectory } from "./smoke-dirs.ts";

// Without --origin the prerendered build is served from dist/client: `vp build` first.
const { values } = parseArgs({
	options: {
		origin: { type: "string" },
		out: { type: "string", default: "/tmp/slopsubs-smoke" },
		compare: { type: "string" },
	},
});
const baselineDir = baselineDirectory(values.out, values.compare);
const screenshotResult =
	baselineDir === undefined ? "screenshots recorded" : "screenshots matched";
const browser = await chromium.launch({ headless: true });
const MAX_CHANNEL_DELTA = 1;
const MAX_CHANGED_CHANNEL_SHARE = 0.0001;
/** Long enough for the pointer-leave preview to clear before a screenshot. */
const PREVIEW_CLEAR_MS = 400;
/** Long enough for a section-jump scroll to end and the nav to mark its target. */
const SECTION_JUMP_MS = 1100;
/** The viewport width from which the chart settings menu is shown. */
const SETTINGS_MENU_MIN_WIDTH = 640;
await mkdir(values.out, { recursive: true });

async function imageDifference(page: Page, before: Buffer, after: Buffer) {
	return page.evaluate(
		async (images) => {
			async function pixels(image: string) {
				const blob = await (
					await fetch(`data:image/png;base64,${image}`)
				).blob();
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
	);
}

async function capture(page: Page, name: string) {
	await page.mouse.move(0, 0);
	await page.waitForTimeout(PREVIEW_CLEAR_MS);
	const image = await page.screenshot({ animations: "disabled" });
	const before =
		baselineDir === undefined
			? undefined
			: await readFile(join(baselineDir, `${name}.png`));
	await writeFile(join(values.out, `${name}.png`), image);
	if (before === undefined) return;
	const difference = await imageDifference(page, before, image);
	console.log(name, difference);
	assert.ok(difference.sameSize, `${name}: screenshot size differs`);
	// Chromium's clipped edge fades can differ by one channel level on a few pixels.
	assert.ok(
		difference.maxDelta <= MAX_CHANNEL_DELTA,
		`${name}: rendered pixels differ`,
	);
	assert.ok(
		difference.changedChannels <=
			difference.channels * MAX_CHANGED_CHANNEL_SHARE,
		`${name}: too many pixels differ`,
	);
}

/** Moves focus off the trigger, so Escape has to bring it back. */
async function focusInsideMenu(trigger: Locator) {
	await trigger
		.locator("xpath=following-sibling::div")
		.getByRole("button", { name: "Labels", exact: true })
		.focus();
}

function settingsTrigger(page: Page) {
	return page.getByRole("button", { name: "Chart settings", exact: true });
}

function detailsCloser(page: Page) {
	return page.getByRole("button", { name: "Close details" });
}

/** Pins the first point of the cost vs score chart from the keyboard. */
async function pinFirstPoint(page: Page) {
	await page.locator('#cost-vs-score svg g[role="button"]').first().focus();
	await page.keyboard.press("Enter");
}

async function settings(page: Page) {
	const trigger = settingsTrigger(page);
	await trigger.click();
	assert.equal(await trigger.getAttribute("aria-expanded"), "true");
	await focusInsideMenu(trigger);
	await page.keyboard.press("Escape");
	assert.equal(await trigger.getAttribute("aria-expanded"), "false");
	assert.equal(
		await trigger.evaluate((el) => el === document.activeElement),
		true,
	);
	await trigger.click();
	await page.getByRole("heading", { level: 1 }).dispatchEvent("pointerdown");
	assert.equal(await trigger.getAttribute("aria-expanded"), "false");
	await trigger.click();
	await page
		.getByRole("button", { name: "Toggle light and dark theme" })
		.focus();
	assert.equal(await trigger.getAttribute("aria-expanded"), "false");
}

/** Escape that closes the menu must stop there, leaving a pinned point open. */
async function menuEscapeKeepsPinnedPoint(page: Page) {
	const details = detailsCloser(page);
	await pinFirstPoint(page);
	assert.equal(await details.count(), 1);
	const trigger = settingsTrigger(page);
	await trigger.click();
	await focusInsideMenu(trigger);
	await page.keyboard.press("Escape");
	assert.equal(await trigger.getAttribute("aria-expanded"), "false");
	assert.equal(
		await trigger.evaluate((el) => el === document.activeElement),
		true,
	);
	assert.equal(await details.count(), 1);
	await page.keyboard.press("Escape");
	assert.equal(await details.count(), 0);
}

async function points(page: Page) {
	const details = detailsCloser(page);
	await pinFirstPoint(page);
	assert.equal(await details.count(), 1);
	await page.keyboard.press("Escape");
	assert.equal(await details.count(), 0);
}

async function navigation(page: Page) {
	const nav = page.getByRole("navigation", { name: "Charts", exact: true });
	await nav.getByRole("link", { name: "Tasks per week", exact: true }).click();
	await page.waitForFunction(
		() => new URL(location.href).searchParams.get("chart") === "tasks-per-week",
	);
	await page.waitForTimeout(SECTION_JUMP_MS);
	assert.equal(
		await nav.locator('[aria-current="location"]').textContent(),
		"Tasks per week",
	);
	await nav.getByRole("link", { name: "Cost vs score", exact: true }).click();
	await page.waitForTimeout(SECTION_JUMP_MS);
	assert.equal(
		await nav.locator('[aria-current="location"]').textContent(),
		"Cost vs score",
	);
}

async function overflow(page: Page) {
	const picker = page.locator(
		'fieldset[aria-label="Benchmark that defines a task"]',
	);
	const frame = picker.locator("../..");
	await picker.locator("..").evaluate((row) => {
		row.scrollLeft = row.scrollWidth;
		row.dispatchEvent(new Event("scroll"));
	});
	await frame
		.getByRole("button", { name: "Scroll left", exact: true })
		.waitFor();
	assert.equal(
		await frame
			.getByRole("button", { name: "Scroll right", exact: true })
			.count(),
		0,
	);
	await page.evaluate(() =>
		document.fonts.dispatchEvent(new Event("loadingdone")),
	);
	await frame
		.getByRole("button", { name: "Scroll right", exact: true })
		.waitFor();
	assert.equal(
		await frame
			.getByRole("button", { name: "Scroll left", exact: true })
			.count(),
		0,
	);
}

async function viewport(
	size: { width: number; height: number },
	origin: string,
) {
	const { width } = size;
	const page = await browser.newPage({
		viewport: size,
		reducedMotion: "reduce",
		colorScheme: "dark",
	});
	const errors: string[] = [];
	page.on("pageerror", (error) => errors.push(error.message));
	await page.goto(origin, { waitUntil: "networkidle" });
	await page.locator('[aria-current="location"]').waitFor();
	await page.waitForFunction(() => {
		const plot = document.querySelector<HTMLElement>(
			"#cost-vs-score [data-chart-width]",
		);
		return (
			plot !== null &&
			Math.abs(
				Number(plot.dataset.chartWidth) - plot.getBoundingClientRect().width,
			) < 1
		);
	});
	await page.evaluate(() => document.fonts.ready);
	await capture(page, `${width}-initial`);
	if (width >= SETTINGS_MENU_MIN_WIDTH) {
		await settings(page);
		await menuEscapeKeepsPinnedPoint(page);
		await settingsTrigger(page).click();
		await capture(page, `${width}-settings`);
		await page.keyboard.press("Escape");
	}
	await points(page);
	await overflow(page);
	await navigation(page);
	assert.deepEqual(errors, []);
	await page.close();
	console.log(
		`${width}px: point pinning, overflow arrows and section jumps passed, ${screenshotResult} (settings on desktop)`,
	);
}

/** The page to check: the --origin given, or the served build. */
async function siteToCheck(explicit: string | undefined) {
	if (explicit) return { origin: explicit, close: () => {} };
	const server = await serveSite();
	return { origin: originOf(server), close: () => server.close() };
}

const site = await siteToCheck(values.origin);
try {
	await viewport(VIEWPORTS.desktop, site.origin);
	await viewport(VIEWPORTS.phone, site.origin);
} finally {
	await browser.close();
	site.close();
}
