import { describe, expect, it, vi } from "vite-plus/test";

// UTC+14, so a formatter that follows the host zone names the next day for
// any time after 10:00 UTC. Set before ./format builds its formatter.
vi.hoisted(() => {
	process.env.TZ = "Pacific/Kiritimati";
});

import {
	formatApiComparison,
	formatDay,
	formatDuration,
	formatIntelligence,
	formatPercent,
	formatTokens,
} from "./format";

describe("formatDay", () => {
	it("names the UTC day of an ISO timestamp", () => {
		expect(formatDay("2026-10-13T08:00:00Z")).toBe("Oct 13, 2026");
	});

	it("keeps the UTC day late in the evening", () => {
		expect(formatDay("2026-10-13T23:30:00Z")).toBe("Oct 13, 2026");
	});
});

describe("formatIntelligence", () => {
	it("shows a score to one decimal, as benchmarks report it", () => {
		expect(formatIntelligence(57.6)).toBe("57.6");
		expect(formatIntelligence(53.35)).toBe("53.4");
		expect(formatIntelligence(50)).toBe("50.0");
	});
});

describe("formatPercent", () => {
	it("shows a percentage to one decimal, with its sign", () => {
		expect(formatPercent(45.45)).toBe("45.5%");
		expect(formatPercent(4)).toBe("4.0%");
	});
});

describe("formatTokens", () => {
	it("abbreviates thousands and millions to three digits", () => {
		expect(formatTokens(850)).toBe("850");
		expect(formatTokens(38054)).toBe("38.1K");
		expect(formatTokens(162164)).toBe("162K");
		expect(formatTokens(1_234_567)).toBe("1.23M");
	});
});

describe("formatApiComparison", () => {
	it("says how many times cheaper a plan is than paying per token", () => {
		expect(formatApiComparison(41.3)).toBe("41× cheaper than API");
		expect(formatApiComparison(2.46)).toBe("2.5× cheaper than API");
	});

	it("says how many times pricier a plan is below a multiple of one", () => {
		expect(formatApiComparison(0.4)).toBe("2.5× pricier than API");
	});

	it("calls a plan the same cost when it rounds to the API price", () => {
		expect(formatApiComparison(1.02)).toBe("Same cost as API");
		expect(formatApiComparison(0.98)).toBe("Same cost as API");
	});
});

describe("formatDuration", () => {
	it("shows seconds alone under a minute", () => {
		expect(formatDuration(42.4)).toBe("42s");
	});

	it("shows minutes and seconds under an hour", () => {
		expect(formatDuration(711.4)).toBe("11m 51s");
		expect(formatDuration(59.6)).toBe("1m 0s");
	});

	it("shows hours and minutes from an hour up", () => {
		expect(formatDuration(3900)).toBe("1h 5m");
		expect(formatDuration(7170)).toBe("2h 0m");
	});
});
