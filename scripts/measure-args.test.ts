import { Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { MarkArgs } from "./measure-args.ts";

const decode = (args: string[]) => Schema.decodeUnknownSync(MarkArgs)(args);

describe("measure mark arguments", () => {
	it("reads the plan, the gauge percent and the reset time", () => {
		const [plan, used, resets] = decode(["max", "37", "2026-10-20T16:00:00Z"]);
		expect([plan, used, resets.toISOString()]).toEqual([
			"max",
			37,
			"2026-10-20T16:00:00.000Z",
		]);
	});
	it.each(["", " "])("rejects a blank used percent %j", (used) => {
		expect(() => decode(["max", used, "2026-10-20T16:00:00Z"])).toThrow();
	});
	it("rejects a used percent outside the gauge", () => {
		expect(() => decode(["max", "101", "2026-10-20T16:00:00Z"])).toThrow();
	});
});
