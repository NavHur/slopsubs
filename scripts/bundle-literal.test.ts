import { describe, expect, it } from "vite-plus/test";
import { extract } from "./bundle-literal.ts";

const ANCHOR = /=\{data:/;

describe("extract", () => {
	it("rewrites minified values as JSON", () => {
		const bundle =
			'var a=1;const d={data:{name:`Opus`,empty:``,label:"say \\"hi\\"",open:!0,deprecated:!1,half:.5,big:1e6,neg:-2.5,none:null}};f(d)';
		expect(extract(bundle, ANCHOR)).toEqual({
			data: {
				name: "Opus",
				empty: "",
				label: 'say "hi"',
				open: true,
				deprecated: false,
				half: 0.5,
				big: 1_000_000,
				neg: -2.5,
				none: null,
			},
		});
	});

	it("reads nested objects and arrays and stops at the matching brace", () => {
		const bundle = "x={data:{models:[{id:1,tags:[`a`,`b`]},{id:2}]}},y={z:1}";
		expect(extract(bundle, ANCHOR)).toEqual({
			data: { models: [{ id: 1, tags: ["a", "b"] }, { id: 2 }] },
		});
	});

	it("ignores braces inside backtick and double-quoted strings", () => {
		const bundle = 'x={data:{a:`}{`,b:"}}\\"{",c:`]`}}rest}';
		expect(extract(bundle, ANCHOR)).toEqual({
			data: { a: "}{", b: '}}"{', c: "]" },
		});
	});

	it("skips braces inside single-quoted strings when finding the end", () => {
		// The rewrite leaves single-quoted strings alone, so the slice is not JSON;
		// the error proves the scan reached the closing brace after the string.
		expect(() => extract("x={data:'}'}", ANCHOR)).toThrow(SyntaxError);
		expect(() => extract("x={data:'}'", ANCHOR)).toThrow(
			"Unbalanced literal starting at 2",
		);
	});

	it("keeps keys that look like values when they precede a colon", () => {
		expect(extract("x={data:{e1:1,n:2}}", ANCHOR)).toEqual({
			data: { e1: 1, n: 2 },
		});
	});

	it("throws when the anchor is missing", () => {
		expect(() => extract("x={other:1}", ANCHOR)).toThrow(
			`Anchor ${ANCHOR} not found in bundle`,
		);
	});

	it("throws when the literal never closes", () => {
		expect(() => extract("x={data:{a:1}", ANCHOR)).toThrow(
			"Unbalanced literal starting at 2",
		);
	});
});
