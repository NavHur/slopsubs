// Regenerates public/og.png and public/apple-touch-icon.png from dist/client.
// `bun run render-brand-images` builds it first; see README.md, "Brand Images".

import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Effect, Schema } from "effect";
import { type Browser } from "playwright-core";
import {
	browserOperation,
	openBrowserPage,
	BrowserCheckError,
	launchBrowser,
	siteOrigin,
} from "./effects/browser.ts";
import { TextFiles } from "./effects/files.ts";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CARD_PATH = join(ROOT, "public/og.png");
const ICON_PATH = join(ROOT, "public/apple-touch-icon.png");
const CARD_SIZE = { width: 1200, height: 630 };
const ICON_PX = 180;
/** The light theme's page background, from src/styles.css. */
const LIGHT_BG = "#fbfaf8";

/** Clicks the cost-vs-score chart's Download PNG button and returns the
 * exported image. */
const exportDefaultChart = Effect.fnUntraced(function* (
	browser: Browser,
	origin: string,
) {
	const page = yield* openBrowserPage(browser, {
		colorScheme: "light",
		acceptDownloads: true,
	});
	const errors: Error[] = [];
	page.on("pageerror", (error) => errors.push(error));
	// The Download PNG button catches export failures and logs them here.
	const consoleErrors: Error[] = [];
	page.on("console", (message) => {
		if (message.type() === "error")
			consoleErrors.push(new Error(message.text()));
	});
	const response = yield* browserOperation("goto", () =>
		page.goto(origin, { waitUntil: "networkidle" }),
	);
	if (!response?.ok()) {
		return yield* new BrowserCheckError({
			message: `${origin} answered ${response?.status()}: build first`,
		});
	}
	const [download] = yield* Effect.all(
		[
			browserOperation("Wait for chart download", () =>
				page.waitForEvent("download"),
			),
			browserOperation("Download chart", () =>
				page
					.locator("#cost-vs-score")
					.getByRole("button", { name: "Download PNG" })
					.click(),
			),
		],
		{ concurrency: "unbounded" },
	).pipe(
		Effect.mapError(
			(cause) =>
				new BrowserCheckError({
					message: "The export failed",
					cause: new AggregateError(
						[...errors, ...consoleErrors],
						"The export failed",
						{ cause },
					),
				}),
		),
	);
	const files = yield* TextFiles;
	// Read before closing: the download's file goes with its page.
	const png = yield* files.readBytes(
		yield* browserOperation("Download path", () => download.path()),
	);
	if (errors.length > 0)
		return yield* new BrowserCheckError({
			message: "The page threw",
			cause: new AggregateError(errors),
		});
	return png;
}, Effect.scoped);

/** Draws `png` centred on a `size` canvas of `background`, scaled to fit. */
const fitOnto = Effect.fnUntraced(function* (
	browser: Browser,
	png: Buffer,
	size: { width: number; height: number },
	background: string,
) {
	const page = yield* openBrowserPage(browser);
	const dataUrl = yield* browserOperation("evaluate", () =>
		page.evaluate(
			async ({ src, width, height, fill }) => {
				const image = new Image();
				image.src = src;
				await image.decode();
				const scale = Math.min(width / image.width, height / image.height);
				const drawn = { w: image.width * scale, h: image.height * scale };
				const canvas = document.createElement("canvas");
				canvas.width = width;
				canvas.height = height;
				const context = canvas.getContext("2d");
				if (!context) throw new Error("Canvas 2D is unavailable");
				context.fillStyle = fill;
				context.fillRect(0, 0, width, height);
				context.imageSmoothingQuality = "high";
				context.drawImage(
					image,
					(width - drawn.w) / 2,
					(height - drawn.h) / 2,
					drawn.w,
					drawn.h,
				);
				return canvas.toDataURL("image/png");
			},
			{
				src: `data:image/png;base64,${png.toString("base64")}`,
				...size,
				fill: background,
			},
		),
	);

	const url = yield* Schema.decodeUnknownEffect(
		Schema.String.check(Schema.isPattern(/^data:image\/png;base64,/)),
	)(dataUrl);
	return Buffer.from(url.split(",")[1], "base64");
}, Effect.scoped);

const renderIcon = Effect.fnUntraced(function* (browser: Browser) {
	const files = yield* TextFiles;
	const svg = yield* files.read(join(ROOT, "public/favicon.svg"));
	const page = yield* openBrowserPage(browser, {
		colorScheme: "light",
		viewport: { width: ICON_PX, height: ICON_PX },
	});
	// The tile's rounded corners are filled so iOS gets an opaque square.
	yield* browserOperation("setContent", () =>
		page.setContent(
			`<body style="margin:0;background:${LIGHT_BG}">` +
				`<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"` +
				` width="${ICON_PX}" height="${ICON_PX}" style="display:block"></body>`,
		),
	);
	const png = yield* browserOperation("screenshot", () =>
		page.screenshot({ omitBackground: false }),
	);

	return png;
}, Effect.scoped);

const main = Effect.gen(function* () {
	const origin = yield* siteOrigin();
	const browser = yield* launchBrowser();
	const files = yield* TextFiles;
	const exported = yield* exportDefaultChart(browser, origin);
	yield* files.write(
		CARD_PATH,
		yield* fitOnto(browser, exported, CARD_SIZE, LIGHT_BG),
	);
	yield* files.write(ICON_PATH, yield* renderIcon(browser));
	console.log(`Wrote ${CARD_PATH} and ${ICON_PATH}`);
});
await Effect.runPromise(
	Effect.scoped(main).pipe(Effect.provide(TextFiles.layer)),
);
