import { describe, expect, it } from "vitest";
import { formatDay } from "./format";

describe("formatDay", () => {
	it("names the UTC day of an ISO timestamp", () => {
		expect(formatDay("2026-10-13T08:00:00Z")).toBe("Oct 13, 2026");
	});

	it("keeps the UTC day late in the evening", () => {
		expect(formatDay("2026-10-13T23:30:00Z")).toBe("Oct 13, 2026");
	});
});
