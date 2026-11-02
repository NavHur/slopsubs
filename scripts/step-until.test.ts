import { describe, expect, it } from "vite-plus/test";
import { stepUntil } from "./step-until.ts";

describe("stepUntil", () => {
	it("returns every result once done holds", async () => {
		let n = 0;
		const results = await stepUntil(
			async () => ++n,
			(result) => result === 3,
			10,
			"wheel pass",
		);
		expect(results).toEqual([1, 2, 3]);
	});

	it("rejects naming the pass when done never holds", async () => {
		await expect(
			stepUntil(
				async () => 0,
				() => false,
				5,
				"phone wheel pass to the end",
			),
		).rejects.toThrow(/phone wheel pass to the end did not finish in 5 steps/);
	});
});
