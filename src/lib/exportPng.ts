import { createElement, Fragment, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_HEIGHT } from "#/components/chart/geometry";

/** The chart lays out at this size for export, whatever the screen size, so
 * phones get the labelled desktop layout too. Height is the chart's default
 * so it is stable whether or not the host fills the screen. */
const CHART_SIZE = { width: 1200, height: DEFAULT_HEIGHT };
const PADDING_PX = 32;
const TITLE_BAND_PX = 40;
const TITLE_FONT = '600 20px "DM Sans", sans-serif';
/** The legend's row, level with the 20px title at the top of its band. */
const LEGEND_ROW_PX = 24;
const PIXEL_RATIO = 2;
/** Frames to wait for the offscreen chart to measure itself and re-render. */
const MAX_LAYOUT_FRAMES = 20;

/** Styles that come from CSS classes and must be inlined, since an SVG
 * drawn as an image sees none of the page's stylesheets. */
const INLINED_STYLES = [
	"fill",
	"stroke",
	"stroke-width",
	"stroke-dasharray",
	"opacity",
	"font-family",
	"font-size",
	"font-weight",
	"font-variant-numeric",
] as const;

/** A laid-out piece of the image, placed relative to the title band's top left. */
type Box = { x: number; y: number; width: number; height: number };
type SvgLayer = Box & { svg: string };
/** HTML text, such as the legend's labels. */
type TextRun = Box & { text: string; font: string; color: string };
type Rendered = {
	layers: SvgLayer[];
	texts: TextRun[];
	background: string;
	foreground: string;
};

/**
 * Renders `chart` offscreen and downloads it as a PNG titled `title`, with
 * `legend` right-aligned beside the title: a downloaded image has no side
 * panel to explain the chart's lines.
 */
export async function downloadChartPng({
	chart,
	legend,
	title,
	fileName,
}: {
	chart: ReactNode;
	legend: ReactNode;
	title: string;
	fileName: string;
}): Promise<void> {
	const [rendered, fontCss] = await Promise.all([
		renderOffscreen(chart, legend),
		embeddedFontCss(),
	]);
	const blob = await rasterize(rendered, fontCss, title);
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	link.click();
	URL.revokeObjectURL(url);
}

async function renderOffscreen(
	chart: ReactNode,
	legend: ReactNode,
): Promise<Rendered> {
	const host = document.createElement("div");
	host.inert = true;
	host.setAttribute("aria-hidden", "true");
	host.className = "flex flex-col bg-bg text-fg";
	Object.assign(host.style, {
		position: "fixed",
		top: "0",
		left: "-100000px",
		width: `${CHART_SIZE.width}px`,
		height: `${TITLE_BAND_PX + CHART_SIZE.height}px`,
		paddingTop: `${TITLE_BAND_PX}px`,
	});
	document.body.append(host);
	const root = createRoot(host);
	try {
		root.render(
			createElement(
				Fragment,
				null,
				chart,
				createElement(
					"div",
					{
						className: "absolute top-0 right-0 flex items-center",
						style: { height: LEGEND_ROW_PX },
					},
					legend,
				),
			),
		);
		await waitForLayout(host);
		const origin = host.getBoundingClientRect();
		const style = getComputedStyle(host);
		return {
			layers: outerSvgs(host).map((svg) => ({
				...boxIn(svg.getBoundingClientRect(), origin),
				svg: serializeWithStyles(svg),
			})),
			texts: htmlTexts(host, origin),
			background: style.backgroundColor,
			foreground: style.color,
		};
	} finally {
		root.unmount();
		host.remove();
	}
}

async function waitForLayout(host: HTMLElement): Promise<void> {
	for (let frame = 0; frame < MAX_LAYOUT_FRAMES; frame++) {
		await new Promise(requestAnimationFrame);
		const svgs = [...host.querySelectorAll("svg")];
		if (svgs.some((svg) => svg.width.baseVal.value === CHART_SIZE.width)) {
			return;
		}
	}
	throw new Error("The chart never laid out at its export size");
}

function boxIn(rect: DOMRect, origin: DOMRect): Box {
	return {
		x: rect.left - origin.left,
		y: rect.top - origin.top,
		width: rect.width,
		height: rect.height,
	};
}

/** The chart's SVG plus any drawn beside it, like the legend's swatches. */
function outerSvgs(host: HTMLElement): SVGSVGElement[] {
	return [...host.querySelectorAll("svg")].filter(
		(svg) => !svg.parentElement?.closest("svg"),
	);
}

function htmlTexts(host: HTMLElement, origin: DOMRect): TextRun[] {
	const runs: TextRun[] = [];
	const walker = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
	const range = document.createRange();
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		const parent = node.parentElement;
		const text = node.textContent?.trim();
		if (!parent || !text || parent.closest("svg")) continue;
		range.selectNodeContents(node);
		const computed = getComputedStyle(parent);
		runs.push({
			...boxIn(range.getBoundingClientRect(), origin),
			text,
			font: `${computed.fontWeight} ${computed.fontSize} ${computed.fontFamily}`,
			color: computed.color,
		});
	}
	return runs;
}

function serializeWithStyles(svg: SVGSVGElement): string {
	const clone = svg.cloneNode(true) as SVGSVGElement;
	const sources = [svg, ...svg.querySelectorAll("*")];
	const targets = [clone, ...clone.querySelectorAll("*")];
	sources.forEach((source, i) => {
		const computed = getComputedStyle(source);
		const target = targets[i] as SVGElement;
		for (const property of INLINED_STYLES) {
			target.style.setProperty(property, computed.getPropertyValue(property));
		}
	});
	clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
	return new XMLSerializer().serializeToString(clone);
}

let fontCssPromise: Promise<string> | null = null;

/** DM Sans as data URLs: an SVG image cannot fetch the page's web fonts. */
function embeddedFontCss(): Promise<string> {
	fontCssPromise ??= loadFontCss().catch((error: unknown) => {
		fontCssPromise = null;
		throw error;
	});
	return fontCssPromise;
}

async function loadFontCss(): Promise<string> {
	const link = document.querySelector<HTMLLinkElement>(
		'link[rel="stylesheet"][href^="https://fonts.googleapis.com/"]',
	);
	if (!link) throw new Error("The web font stylesheet is missing");
	const css = await (await fetchOk(link.href)).text();
	const dataUrls = new Map<string, Promise<string>>();
	const faces = basicLatinFontFaces(css).map(async (face) => {
		const url = fontUrl(face);
		let dataUrl = dataUrls.get(url);
		if (!dataUrl) {
			dataUrl = fetchDataUrl(url);
			dataUrls.set(url, dataUrl);
		}
		return face.replace(url, await dataUrl);
	});
	return (await Promise.all(faces)).join("\n");
}

/** The @font-face rules whose unicode-range starts at U+0000 (Basic Latin),
 * which covers every glyph the chart draws. */
export function basicLatinFontFaces(css: string): string[] {
	return (css.match(/@font-face\s*\{[^}]*\}/g) ?? []).filter((face) =>
		/unicode-range:\s*U\+0000-/i.test(face),
	);
}

function fontUrl(face: string): string {
	const url = face.match(/url\(\s*['"]?([^'")]+)['"]?\s*\)/)?.[1];
	if (!url) throw new Error(`No font URL in ${face}`);
	return url;
}

async function fetchOk(url: string): Promise<Response> {
	const response = await fetch(url);
	if (!response.ok) throw new Error(`${url} returned ${response.status}`);
	return response;
}

async function fetchDataUrl(url: string): Promise<string> {
	const blob = await (await fetchOk(url)).blob();
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result as string);
		reader.onerror = () => reject(reader.error);
		reader.readAsDataURL(blob);
	});
}

async function svgImage(
	svg: string,
	fontCss: string,
): Promise<HTMLImageElement> {
	const withFonts = svg.replace(/^<svg[^>]*>/, (open) => {
		return `${open}<style>${fontCss}</style>`;
	});
	const image = new Image();
	image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withFonts)}`;
	await image.decode();
	return image;
}

async function rasterize(
	{ layers, texts, background, foreground }: Rendered,
	fontCss: string,
	title: string,
): Promise<Blob> {
	const fonts = new Set([TITLE_FONT, ...texts.map((t) => t.font)]);
	const [images] = await Promise.all([
		Promise.all(layers.map((layer) => svgImage(layer.svg, fontCss))),
		...[...fonts].map((font) => document.fonts.load(font)),
	]);

	const width = CHART_SIZE.width + PADDING_PX * 2;
	const height = PADDING_PX * 2 + TITLE_BAND_PX + CHART_SIZE.height;
	const canvas = document.createElement("canvas");
	canvas.width = width * PIXEL_RATIO;
	canvas.height = height * PIXEL_RATIO;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Canvas 2D is unavailable");
	context.scale(PIXEL_RATIO, PIXEL_RATIO);
	context.fillStyle = background;
	context.fillRect(0, 0, width, height);
	context.fillStyle = foreground;
	context.font = TITLE_FONT;
	context.textBaseline = "top";
	context.fillText(title, PADDING_PX, PADDING_PX);

	context.translate(PADDING_PX, PADDING_PX);
	layers.forEach((layer, i) => {
		context.drawImage(images[i], layer.x, layer.y, layer.width, layer.height);
	});
	context.textBaseline = "middle";
	for (const run of texts) {
		context.fillStyle = run.color;
		context.font = run.font;
		context.fillText(run.text, run.x, run.y + run.height / 2);
	}
	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(blob) =>
				blob ? resolve(blob) : reject(new Error("PNG encoding failed")),
			"image/png",
		),
	);
}
