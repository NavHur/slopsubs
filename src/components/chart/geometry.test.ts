import { scaleLinear, scaleLog } from "d3-scale";
import { describe, expect, it } from "vitest";
import { chartLayout, xTicks } from "./geometry";

const minGap = (ticks: number[], x: (t: number) => number) =>
	Math.min(...ticks.slice(1).map((t, i) => x(t) - x(ticks[i])));

describe("xTicks", () => {
	it("keeps every log tick when the axis is wide", () => {
		const x = scaleLog().domain([0.001, 10]).range([56, 760]);
		expect(xTicks(x, "log")).toEqual([
			0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10,
		]);
	});

	it("thins a narrow log axis to decades spaced apart", () => {
		const x = scaleLog().domain([0.001, 10]).range([36, 360]);
		const ticks = xTicks(x, "log");
		expect(ticks).toEqual([0.001, 0.01, 0.1, 1, 10]);
		expect(minGap(ticks, x)).toBeGreaterThanOrEqual(44);
	});

	it("asks a narrow linear axis for fewer ticks", () => {
		const x = scaleLinear().domain([0, 10]).range([36, 200]);
		expect(minGap(xTicks(x, "linear"), x)).toBeGreaterThanOrEqual(44);
	});
});

describe("chartLayout", () => {
	const labelled = { labels: true };

	it("moves labels to a legend on phone widths", () => {
		const phone = chartLayout({ width: 358, height: 0 }, labelled);
		const desktop = chartLayout({ width: 960, height: 700 }, labelled);
		expect([phone.compact, phone.endLabels]).toEqual([true, false]);
		expect([desktop.compact, desktop.endLabels]).toEqual([false, true]);
	});

	it("fills a tall container but never draws a squashed plot", () => {
		expect(chartLayout({ width: 960, height: 700 }, labelled).height).toBe(700);
		expect(chartLayout({ width: 960, height: 200 }, labelled).height).toBe(620);
	});

	it("gives the label column to the plot when labels are off", () => {
		const size = { width: 960, height: 700 };
		const on = chartLayout(size, labelled);
		const off = chartLayout(size, { labels: false });
		expect(off.endLabels).toBe(false);
		expect(off.margin.right).toBeLessThan(on.margin.right);
		expect({ ...off.margin, right: on.margin.right }).toEqual(on.margin);
	});

	it("keeps the phone layout whatever the labels setting", () => {
		const size = { width: 358, height: 0 };
		expect(chartLayout(size, { labels: false })).toEqual(
			chartLayout(size, labelled),
		);
	});
});
