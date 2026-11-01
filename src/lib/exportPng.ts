import { createElement, Fragment, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { DEFAULT_HEIGHT } from "#/components/chart/geometry";
import { DM_SANS, DM_SANS_LATIN_URL } from "#/lib/webFont";

/** The chart lays out at this size for export, whatever the screen size, so
 * phones export the wide desktop layout too, not their compact one. A chart
 * that fills its box gets the default height, stable whether or not the host
 * fills the screen; one sized by its content keeps its own height. */
const CHART_SIZE = { width: 1200, height: DEFAULT_HEIGHT };
const PADDING_PX = 32;
const TITLE_FONT = `600 20px "${DM_SANS}", sans-serif`;
/** One line of the header: the 20px title and a single-row legend both sit
 * level in it. A wrapped legend makes the header taller. */
const HEADER_ROW_PX = 24;
/** Space between the header and the chart. */
const HEADER_GAP_PX = 16;
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

/** A laid-out piece of the image, placed relative to the header's top left. */
type Box = { x: number; y: number; width: number; height: number };
type SvgLayer = Box & { svg: string };
/** HTML text, such as the title and the legend's labels. */
type TextRun = Box & { text: string; font: string; color: string };
type Rendered = {
	/** The measured height of the header and chart together. */
	height: number;
	layers: SvgLayer[];
	texts: TextRun[];
	background: string;
};

/**
 * Renders `chart` offscreen and downloads it as a PNG titled `title`, with
 * `legend` right-aligned beside the title, wrapping onto more rows when it
 * would not fit: a downloaded image has no side panel to explain the chart's
 * lines. The chart's root marks its laid-out width with `data-chart-width`.
 */
export async function downloadChartPng({
	chart,
	legend,
	title,
	fileName,
	height = "fill",
}: {
	chart: ReactNode;
	legend: ReactNode;
	title: string;
	fileName: string;
	/** Whether the chart fills a box of the default height or sizes itself. */
	height?: "fill" | "content";
}): Promise<void> {
	const [rendered, fontCss] = await Promise.all([
		renderOffscreen({ chart, legend, title, height }),
		embeddedFontCss(),
	]);
	const blob = await rasterize(rendered, fontCss);
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	link.click();
	URL.revokeObjectURL(url);
}

/** The title on the left and the legend on the right, which wraps within the
 * width the title leaves instead of running over it. */
function headerRow(title: string, legend: ReactNode): ReactNode {
	return createElement(
		"div",
		{
			className: "flex items-start justify-between gap-6",
			style: { paddingBottom: HEADER_GAP_PX },
		},
		createElement(
			"p",
			{
				className: "shrink-0 whitespace-nowrap",
				style: { font: TITLE_FONT, lineHeight: `${HEADER_ROW_PX}px` },
			},
			title,
		),
		createElement(
			"div",
			{
				className: "flex min-w-0 items-center",
				style: { minHeight: HEADER_ROW_PX },
			},
			legend,
		),
	);
}

async function renderOffscreen({
	chart,
	legend,
	title,
	height,
}: {
	chart: ReactNode;
	legend: ReactNode;
	title: string;
	height: "fill" | "content";
}): Promise<Rendered> {
	const host = document.createElement("div");
	host.inert = true;
	host.setAttribute("aria-hidden", "true");
	host.className = "flex flex-col bg-bg text-fg";
	Object.assign(host.style, {
		position: "fixed",
		top: "0",
		left: "-100000px",
		width: `${CHART_SIZE.width}px`,
	});
	document.body.append(host);
	const root = createRoot(host);
	try {
		root.render(
			createElement(
				Fragment,
				null,
				headerRow(title, legend),
				createElement(
					"div",
					{
						className: "flex flex-col",
						style:
							height === "fill" ? { height: CHART_SIZE.height } : undefined,
					},
					chart,
				),
			),
		);
		await waitForLayout(host);
		const origin = host.getBoundingClientRect();
		return {
			height: origin.height,
			layers: outerSvgs(host).map((svg) => ({
				...boxIn(svg.getBoundingClientRect(), origin),
				svg: serializeWithStyles(svg),
			})),
			texts: htmlTexts(host, origin),
			background: getComputedStyle(host).backgroundColor,
		};
	} finally {
		root.unmount();
		host.remove();
	}
}

async function waitForLayout(host: HTMLElement): Promise<void> {
	for (let frame = 0; frame < MAX_LAYOUT_FRAMES; frame++) {
		await new Promise(requestAnimationFrame);
		const laidOut = `[data-chart-width="${CHART_SIZE.width}"]`;
		if (host.querySelector(laidOut)) return;
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
	const dataUrl = await fetchDataUrl(DM_SANS_LATIN_URL);
	return `@font-face { font-family: "${DM_SANS}"; font-weight: 100 1000; src: url(${dataUrl}) format("woff2"); }`;
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
	{ height: contentHeight, layers, texts, background }: Rendered,
	fontCss: string,
): Promise<Blob> {
	const fonts = new Set(texts.map((t) => t.font));
	const [images] = await Promise.all([
		Promise.all(layers.map((layer) => svgImage(layer.svg, fontCss))),
		...[...fonts].map((font) => document.fonts.load(font)),
	]);

	const width = CHART_SIZE.width + PADDING_PX * 2;
	const height = Math.ceil(PADDING_PX * 2 + contentHeight);
	const canvas = document.createElement("canvas");
	canvas.width = width * PIXEL_RATIO;
	canvas.height = height * PIXEL_RATIO;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("Canvas 2D is unavailable");
	context.scale(PIXEL_RATIO, PIXEL_RATIO);
	context.fillStyle = background;
	context.fillRect(0, 0, width, height);

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
