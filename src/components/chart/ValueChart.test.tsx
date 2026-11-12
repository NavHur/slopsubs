import { scaleLinear } from "d3-scale";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vite-plus/test";
import { leaderboards } from "#/data";
import type { ValuePoint } from "#/domain/value";
import { BENCHMARK_VIEWS } from "#/lib/benchmarks";
import { familyName } from "#/lib/families";
import { type LineEmphasis, SeriesLine } from "./ChartParts";
import { markerPath } from "./geometry";
import { buildSeries } from "./series";
import { ValueChart } from "./ValueChart";

const size = vi.hoisted(() => ({ width: 960, height: 620 }));
vi.mock("./useChartRef", () => ({
	useChartRef: () => ({
		ref: () => {},
		element: { current: null },
		size,
	}),
}));

const point: ValuePoint = {
	seriesId: "example@api",
	score: 40,
	costPerTaskUsd: 1,
	benchmark: {
		...leaderboards.intelligence.models[0],
		score: 40,
		costPerTaskUsd: 1,
	},
	pricing: { kind: "api" },
};
const benchmark = BENCHMARK_VIEWS.intelligence;

function chart(points: ValuePoint[], labels = true, pareto = false) {
	return renderToStaticMarkup(
		<ValueChart
			points={points}
			scale="log"
			showPareto={pareto}
			showLabels={labels}
			benchmark={benchmark}
		/>,
	);
}

/** An API point of the nth family in the fixture, own series and benchmark. */
function apiPoint(n: number, score: number, costPerTaskUsd: number) {
	const { models } = leaderboards.intelligence;
	const family = [...new Set(models.map((m) => m.family))][n];
	const model = models.find((m) => m.family === family);
	if (!model) throw new Error(`fixture needs ${n + 1} families`);
	return {
		seriesId: `${family}@api`,
		score,
		costPerTaskUsd,
		benchmark: { ...model, score, costPerTaskUsd },
		pricing: { kind: "api" },
	} satisfies ValuePoint;
}

function indexOfLabel(html: string, label: string) {
	const index = html.indexOf(`aria-label="${label}`);
	if (index < 0) throw new Error(`no element labelled ${label}`);
	return index;
}

const pointLabelOf = (p: ValuePoint) =>
	`${familyName(p.benchmark.family)} · API, ${p.benchmark.effortLabel},`;

const OPACITY = /opacity="([\d.]+)"/g;
const opacitiesIn = (html: string) =>
	[...html.matchAll(OPACITY)].map((m) => Number(m[1]));

const TAG = /<(\/?)[a-zA-Z][^\s>/]*([^>]*?)(\/?)>/g;
const OWN_OPACITY = / opacity="([\d.]+)"/;

/** The opacity of each element still open at the end of `html`; 1 if unset. */
function openOpacities(html: string) {
	const open: number[] = [];
	for (const [, closing, attrs, selfClosing] of html.matchAll(TAG)) {
		if (closing) open.pop();
		else if (!selfClosing)
			open.push(Number(attrs.match(OWN_OPACITY)?.[1] ?? 1));
	}
	return open;
}

/** The opacities among them that fade. */
const fading = (opacities: readonly number[]) => opacities.filter((o) => o < 1);

const product = (factors: readonly number[]) =>
	factors.reduce((acc, factor) => acc * factor, 1);

/** The markup before each point's `<g>`, found by the point's aria-label. */
const beforePoint = (html: string, p: ValuePoint) =>
	html.slice(0, indexOfLabel(html, pointLabelOf(p)));

/** The markup before the path of the series whose first point is `p`. */
function beforeLine(html: string, p: ValuePoint) {
	const before = beforePoint(html, p);
	return before.slice(0, before.lastIndexOf("<path d="));
}

/** What a user sees of each point: its open ancestors' opacities multiplied. */
function pointOpacities(html: string, points: readonly ValuePoint[]) {
	return points.map((p) => product(openOpacities(beforePoint(html, p))));
}

/** The same for each series' line, not counting the path's own opacity. */
function lineOpacities(html: string, firstPoints: readonly ValuePoint[]) {
	return firstPoints.map((p) => product(openOpacities(beforeLine(html, p))));
}

/** Each point's model tag, whose opacity follows its aria-label. */
function tagOpacities(html: string, points: readonly ValuePoint[]) {
	return points.map((p) => {
		const label = `Highlight ${familyName(p.benchmark.family)}`;
		return opacitiesIn(html.slice(indexOfLabel(html, label)))[0];
	});
}

describe("ValueChart", () => {
	it("shows the empty-state message without plotting axes", () => {
		const html = chart([]);
		expect(html).toContain("Nothing to plot. Pick a model, or measure a plan.");
		expect(html).not.toContain("<svg");
	});
	it.each([390, 960])("names the model and benchmark at width %s", (width) => {
		size.width = width;
		const html = chart([point]);
		expect(html).toContain(`data-chart-width="${width}"`);
		expect(html).toContain("Effective cost per task versus Intelligence index");
		expect(html).toContain(familyName(point.benchmark.family));
	});
	it("omits desktop end labels when labels are disabled", () => {
		size.width = 960;
		expect(chart([point], false)).not.toContain(
			`>${familyName(point.benchmark.family)}<`,
		);
	});
	it("fades all but the frontier's points, and tags off it, while the Pareto line shows", () => {
		size.width = 960;
		const pricier: ValuePoint = {
			...point,
			score: 35,
			costPerTaskUsd: 3,
			benchmark: {
				...point.benchmark,
				id: `${point.benchmark.id}-pricier`,
				effortLabel: "Pricier effort",
				score: 35,
				costPerTaskUsd: 3,
			},
		};
		const dominated = apiPoint(1, 30, 2);
		const points = [point, pricier, dominated];
		const off = chart(points, true, false);
		expect(pointOpacities(off, points)).toEqual([1, 1, 1]);
		expect(lineOpacities(off, [point, dominated])).toEqual([1, 1]);
		expect(tagOpacities(off, [point, dominated])).toEqual([1, 1]);
		const on = chart(points, true, true);
		expect(pointOpacities(on, points)).toEqual([1, 0.15, 0.15]);
		expect(lineOpacities(on, [point, dominated])).toEqual([0.15, 0.15]);
		expect(tagOpacities(on, [point, dominated])).toEqual([1, 0.25]);
	});
	it("lights every point tied with a frontier vertex, and fades a dominated one", () => {
		size.width = 960;
		const twin = apiPoint(1, 40, 1);
		const dominated = apiPoint(2, 30, 2);
		const points = [point, twin, dominated];
		const html = chart(points, true, true);
		expect(pointOpacities(html, points)).toEqual([1, 1, 0.15]);
		expect(tagOpacities(html, points)).toEqual([1, 1, 0.25]);
	});
});

function renderLine(emphasis: LineEmphasis) {
	const x = scaleLinear().domain([0, 2]).range([0, 200]);
	const y = scaleLinear().domain([0, 80]).range([400, 0]);
	return renderToStaticMarkup(
		<SeriesLine
			series={buildSeries([point])[0]}
			x={x}
			y={y}
			shownPoints={[]}
			emphasis={emphasis}
			onDetails={() => {}}
			benchmark={benchmark}
		/>,
	);
}

describe("SeriesLine", () => {
	it("fades a dimmed series as one group, so its hollow marker hides the line", () => {
		const html = renderLine({ kind: "dimmed" });
		expect(pointOpacities(html, [point])).toEqual([0.15]);
		expect(lineOpacities(html, [point])).toEqual([0.15]);
		expect(fading(openOpacities(beforePoint(html, point)))).toEqual([0.15]);
		expect(fading(openOpacities(beforeLine(html, point)))).toEqual([0.15]);
		expect(html.match(/<g opacity="0.15"/g)).toHaveLength(1);
	});
	it("draws a lit series at full opacity", () => {
		const html = renderLine({ kind: "lit" });
		expect(pointOpacities(html, [point])).toEqual([1]);
		expect(lineOpacities(html, [point])).toEqual([1]);
	});
	it.each([true, false])(
		"keeps marker style and selected size for API=%s",
		(isApi) => {
			const built = buildSeries([point])[0];
			const marker = isApi ? built.pricing.marker : "diamond";
			const series = {
				...built,
				pricing: { ...built.pricing, isApi, marker },
			} as typeof built;
			const x = scaleLinear().domain([0, 2]).range([0, 200]);
			const y = scaleLinear().domain([0, 80]).range([400, 0]);
			const html = renderToStaticMarkup(
				<SeriesLine
					series={series}
					x={x}
					y={y}
					shownPoints={[point]}
					emphasis={{ kind: "dimmed" }}
					onDetails={() => {}}
					benchmark={benchmark}
				/>,
			);
			expect(html).toContain('opacity="0.15"');
			expect(html).toContain('role="button" tabindex="0"');
			expect(html).toContain(
				`d="${markerPath(series.pricing.marker, x(1), y(40), 6)}"`,
			);
			expect(html).toContain(`fill="${isApi ? "var(--bg)" : series.color}"`);
			expect(html.includes('stroke-dasharray="3 4"')).toBe(isApi);
		},
	);
});
