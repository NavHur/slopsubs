import { describe, expect, it, vi } from "vitest";

// UTC+14, so a formatter that follows the host zone names the next day for
// any time after 10:00 UTC. Set before ./format builds its formatter.
vi.hoisted(() => {
	process.env.TZ = "Pacific/Kiritimati";
});

import { formatDay, formatIntelligence } from "./format";

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
