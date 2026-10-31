import { describe, expect, it } from "vite-plus/test";
import { familyLabId } from "#/lib/families";
import { COVERED_FAMILIES } from "#/lib/view";
import { PROVIDER_MARKS } from "./providerMarks";

describe("PROVIDER_MARKS", () => {
	it("has a mark for the lab of every model a plan covers", () => {
		const missing = COVERED_FAMILIES.map(familyLabId).filter(
			(lab) => !PROVIDER_MARKS[lab],
		);
		expect(missing).toEqual([]);
	});
});
