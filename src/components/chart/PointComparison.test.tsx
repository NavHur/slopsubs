import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { leaderboards, plans, samples } from "#/data";
import { BENCHMARK_IDS } from "#/domain/enums";
import type { FamilyId } from "#/domain/model";
import type { ValuePoint } from "#/domain/value";
import { valuePoints } from "#/domain/value";
import { BENCHMARK_VIEWS } from "#/lib/benchmarks";
import {
	formatDuration,
	formatMultiple,
	formatTokens,
	formatUsd,
} from "#/lib/format";
import { PointComparison, WIDEST_FIGURE_CHARS } from "./PointComparison";

const family = "claude-opus-5-5" as FamilyId;

function pointWith(costPerTaskUsd: number): ValuePoint {
	return {
		seriesId: `${family}@api`,
		benchmark: {
			id: `${family}-max`,
			family,
			name: "Claude Opus 5.5",
			lab: "anthropic",
			labName: "Anthropic",
			deprecated: false,
			effort: "max",
			effortLabel: "max",
			effortOrder: 0,
			score: 45,
			costPerTaskUsd,
			tokensPerTask: 200000,
			secondsPerTask: 700,
			inputPricePerMTokUsd: 5,
			outputPricePerMTokUsd: 25,
		},
		score: 45,
		costPerTaskUsd,
		pricing: { kind: "api" },
	};
}

const REM_PX = 16;
/** Tabular digits at 12px DM Sans, per character. */
const FIGURE_CHAR_PX = 7.2;
/** 11px medium text in a chip, per character, measured in the shipped font. */
const CHIP_CHAR_PX = 5.8;
const CELL_PADDING_PX = 4;
const CHIP_PADDING_PX = 8;
/**
 * Table widths at 360px, 375px and 390px viewports, and the 28rem desktop
 * card. By ruling, phones narrower than 360px are out of scope.
 */
const PHONE_TABLES_PX = [286, 301, 316];
const DESKTOP_TABLE_PX = 422;

/** Every shipped point, per benchmark: the comparison never crosses benchmarks. */
function shippedPointsByBenchmark(): ValuePoint[][] {
	return BENCHMARK_IDS.map((id) => {
		const models = leaderboards[id].models;
		return valuePoints({
			benchmarks: models,
			families: [...new Set(models.map((m) => m.family))],
			plans,
			samples,
			showApi: true,
			hiddenEfforts: [],
		});
	});
}

/** Every figure the comparison can show, for every shipped point. */
function shippedFigures(): string[] {
	const figures: string[] = [];
	for (const [i, points] of shippedPointsByBenchmark().entries()) {
		const view = BENCHMARK_VIEWS[BENCHMARK_IDS[i]];
		for (const p of points) {
			figures.push(view.formatScore(p.score), formatUsd(p.costPerTaskUsd));
			figures.push(formatTokens(p.benchmark.tokensPerTask ?? 0));
			if (p.benchmark.secondsPerTask !== null) {
				figures.push(formatDuration(p.benchmark.secondsPerTask));
			}
		}
	}
	return figures;
}

const METRICS: { value: (p: ValuePoint) => number | null; word: string }[] = [
	{ value: (p) => p.costPerTaskUsd, word: "cheaper" },
	{ value: (p) => p.benchmark.tokensPerTask, word: "fewer" },
	{ value: (p) => p.benchmark.secondsPerTask, word: "faster" },
];

/**
 * The widest chip any shipped pair can show: the largest ratio between two
 * points of one benchmark in each metric, with that metric's wording.
 */
function widestChipChars(): number {
	const widths = shippedPointsByBenchmark().flatMap((points) =>
		METRICS.map(({ value, word }) => {
			const values = points.flatMap((p) => value(p) ?? []).filter((v) => v > 0);
			const ratio = Math.max(...values) / Math.min(...values);
			return `${formatMultiple(ratio)} ${word}`.length;
		}),
	);
	return Math.max(...widths);
}

const widestFigureChars = Math.max(...shippedFigures().map((f) => f.length));
const widestFigurePx = widestFigureChars * FIGURE_CHAR_PX;

function render() {
	return renderToStaticMarkup(
		<PointComparison
			selected={pointWith(1000)}
			hovered={pointWith(1)}
			view={BENCHMARK_VIEWS.intelligence}
		/>,
	);
}

/**
 * A column's width in a table of `table` px: its rem width, or the one of a
 * container-query variant the table is wide enough for. Throws on any class
 * it cannot read, so a changed class fails instead of reading as 0px.
 */
function widthPx(classes: string, table: number): number {
	const rules = [
		...classes.matchAll(/(?:@\[([\d.]+)rem\]:)?w-\[([\d.]+)rem\]/g),
	];
	const applicable = rules
		.map((m) => ({
			from: Number(m[1] ?? 0) * REM_PX,
			px: Number(m[2]) * REM_PX,
		}))
		.filter((rule) => table >= rule.from)
		.sort((a, b) => b.from - a.from);
	if (applicable.length === 0 || Number.isNaN(applicable[0].px)) {
		throw new Error(`no readable width in "${classes}" at ${table}px`);
	}
	return applicable[0].px;
}

function columnClasses(): string[] {
	const cols = [...render().matchAll(/<col(?: class="([^"]*)")?\/>/g)];
	expect(cols).toHaveLength(4);
	return cols.map((m) => m[1] ?? "");
}

function labelAndChange(table: number) {
	const classes = columnClasses();
	return {
		label: widthPx(classes[0], table),
		change: widthPx(classes[3], table),
	};
}

function chipText() {
	const chip = render().match(
		/<span class="[^"]*rounded[^"]*">([^<]*cheaper)<\/span>/,
	);
	expect(chip).not.toBeNull();
	return chip?.[1] ?? "";
}

describe("comparison table columns", () => {
	it("sizes the figure budget for the widest figure the shipped data produces", () => {
		expect(widestFigureChars).toBeLessThanOrEqual(WIDEST_FIGURE_CHARS);
	});

	it.each([...PHONE_TABLES_PX, DESKTOP_TABLE_PX])(
		"leave each figure column room for the widest shipped figure in a %ipx table",
		(table) => {
			const { label, change } = labelAndChange(table);
			const figure = (table - label - change) / 2;
			expect(figure).toBeGreaterThanOrEqual(widestFigurePx + CELL_PADDING_PX);
		},
	);

	it("holds the widest chip the shipped data produces on one line in the desktop card", () => {
		expect(chipText()).toMatch(/× cheaper$/);
		const chipPx =
			widestChipChars() * CHIP_CHAR_PX + CHIP_PADDING_PX + CELL_PADDING_PX;
		expect(labelAndChange(DESKTOP_TABLE_PX).change).toBeGreaterThanOrEqual(
			chipPx,
		);
	});

	it("reads no width from a class it cannot parse", () => {
		expect(() => widthPx("w-4", PHONE_TABLES_PX[0])).toThrow();
		expect(() => widthPx("", PHONE_TABLES_PX[0])).toThrow();
	});

	it("lets names, labels and chips wrap, and keeps figures on one line", () => {
		const html = render();
		expect(html).not.toMatch(/class="[^"]*truncate[^"]*"/);
		expect(html).toMatch(/class="[^"]*break-words[^"]*">Opus 5.5/);
		const chip = html.match(/<span class="[^"]*rounded[^"]*"/)?.[0];
		expect(chip).toBeDefined();
		expect(chip).not.toContain("whitespace-nowrap");
		expect(html.match(/<td class="[^"]*whitespace-nowrap/g)).toHaveLength(8);
	});
});

describe("comparison column heads", () => {
	it("show the whole effort and pricing line, since a tooltip title cannot appear", () => {
		const html = renderToStaticMarkup(
			<PointComparison
				selected={pointWith(1000)}
				hovered={pointWith(1)}
				view={BENCHMARK_VIEWS.intelligence}
			/>,
		);
		const details = html.match(/<span class="[^"]*">max · API<\/span>/g);
		expect(details).toHaveLength(2);
		expect(details?.join("")).not.toContain("truncate");
		expect(html).not.toContain("title=");
	});
});
