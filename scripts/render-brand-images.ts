// Regenerates public/og.png and public/apple-touch-icon.png from dist/client.
// `bun run render-brand-images` builds it first; see README.md, "Brand Images".

import { readFile, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Browser } from "playwright-core";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SITE_DIR = join(ROOT, "dist/client");
const CARD_PATH = join(ROOT, "public/og.png");
const ICON_PATH = join(ROOT, "public/apple-touch-icon.png");
const CARD_SIZE = { width: 1200, height: 630 };
const ICON_PX = 180;
/** The light theme's page background, from src/styles.css. */
const LIGHT_BG = "#fbfaf8";

const CONTENT_TYPES: Record<string, string> = {
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".svg": "image/svg+xml",
	".png": "image/png",
	".json": "application/json",
};

/** A request for a path the build lacks: a 404, not a failure. */
function isMissingFile(error: unknown): boolean {
	const code = (error as NodeJS.ErrnoException).code;
	return code === "ENOENT" || code === "EISDIR";
}

/** Serves the prerendered build, with / mapped to index.html. */
function serveSite(): Promise<Server> {
	const server = createServer(async (request, response) => {
		const path = normalize(new URL(request.url ?? "/", "http://x").pathname);
		const file = join(
			SITE_DIR,
			path.endsWith("/") ? `${path}index.html` : path,
		);
		try {
			const body = await readFile(file);
			response.writeHead(200, {
				"content-type":
					CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
			});
			response.end(body);
		} catch (error) {
			if (!isMissingFile(error)) {
				response.writeHead(500).end();
				throw error;
			}
			response.writeHead(404).end();
		}
	});
	return new Promise((resolve) =>
		server.listen(0, "127.0.0.1", () => resolve(server)),
	);
}

/** Clicks the cost-vs-score chart's Download PNG button and returns the
 * exported image. */
async function exportDefaultChart(
	browser: Browser,
	origin: string,
): Promise<Buffer> {
	const page = await browser.newPage({
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
	const response = await page.goto(origin, { waitUntil: "networkidle" });
	if (!response?.ok()) {
		throw new Error(`${origin} answered ${response?.status()}: build first`);
	}
	const [download] = await Promise.all([
		page.waitForEvent("download"),
		page
			.locator("#cost-vs-score")
			.getByRole("button", { name: "Download PNG" })
			.click(),
	]).catch((waitFailure: unknown) => {
		const causes = [...errors, ...consoleErrors];
		if (causes.length === 0) throw waitFailure;
		throw new AggregateError(causes, "The export failed", {
			cause: waitFailure,
		});
	});
	// Read before closing: the download's file goes with its page.
	const png = await readFile(await download.path());
	await page.close();
	if (errors.length > 0) throw new AggregateError(errors, "The page threw");
	return png;
}

/** Draws `png` centred on a `size` canvas of `background`, scaled to fit. */
async function fitOnto(
	browser: Browser,
	png: Buffer,
	size: { width: number; height: number },
	background: string,
): Promise<Buffer> {
	const page = await browser.newPage();
	const dataUrl = await page.evaluate(
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
	);
	await page.close();
	return Buffer.from(dataUrl.split(",")[1], "base64");
}

async function renderIcon(browser: Browser): Promise<Buffer> {
	const svg = await readFile(join(ROOT, "public/favicon.svg"), "utf8");
	const page = await browser.newPage({
		colorScheme: "light",
		viewport: { width: ICON_PX, height: ICON_PX },
	});
	// The tile's rounded corners are filled so iOS gets an opaque square.
	await page.setContent(
		`<body style="margin:0;background:${LIGHT_BG}">` +
			`<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"` +
			` width="${ICON_PX}" height="${ICON_PX}" style="display:block"></body>`,
	);
	const png = await page.screenshot({ omitBackground: false });
	await page.close();
	return png;
}

const server = await serveSite();
const browser = await chromium.launch();
try {
	const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
	const exported = await exportDefaultChart(browser, origin);
	await writeFile(
		CARD_PATH,
		await fitOnto(browser, exported, CARD_SIZE, LIGHT_BG),
	);
	await writeFile(ICON_PATH, await renderIcon(browser));
	console.log(`Wrote ${CARD_PATH} and ${ICON_PATH}`);
} finally {
	await browser.close();
	server.close();
}
