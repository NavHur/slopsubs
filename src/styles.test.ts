import { readFileSync } from "node:fs";
import { describe, expect, it } from "vite-plus/test";
import { CHIP_BACKGROUND } from "#/components/chart/PointComparison";

const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

type Rgb = [number, number, number];
type Theme = 0 | 1;

/** A `--color-<name>: light-dark(#light, #dark)` token's colour in one theme. */
function token(name: string, theme: Theme): Rgb {
	const match = css.match(
		new RegExp(`--color-${name}:\\s*light-dark\\((#\\w{6}),\\s*(#\\w{6})\\)`),
	);
	if (!match) throw new Error(`no light-dark token --color-${name}`);
	const hex = match[theme + 1].slice(1);
	return [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as Rgb;
}

function luminance(rgb: Rgb) {
	const [r, g, b] = rgb.map((c) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgb, b: Rgb) {
	const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (hi + 0.05) / (lo + 0.05);
}

function over(fg: Rgb, alpha: number, bg: Rgb): Rgb {
	return fg.map((c, i) => c * alpha + bg[i] * (1 - alpha)) as Rgb;
}

/** The tint's opacity, read from the chip's class so the two cannot drift. */
function chipAlpha(tone: "better" | "worse") {
	const match = CHIP_BACKGROUND[tone].match(/\/(\d+)$/);
	if (!match) throw new Error(`no opacity in ${CHIP_BACKGROUND[tone]}`);
	return Number(match[1]) / 100;
}

describe("change chip colours", () => {
	const cases = [
		["better", "light", 0],
		["better", "dark", 1],
		["worse", "light", 0],
		["worse", "dark", 1],
	] as const;

	it.each(cases)("keep %s text legible on its tint in %s", (tone, _, theme) => {
		const text = token(tone, theme);
		const chip = over(text, chipAlpha(tone), token("panel", theme));
		expect(contrast(text, chip)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(text, token("panel", theme))).toBeGreaterThanOrEqual(4.5);
	});
});
