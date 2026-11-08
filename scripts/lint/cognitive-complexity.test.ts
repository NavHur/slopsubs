import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vite-plus/test";

const directory = mkdtempSync(join(tmpdir(), "slopsubs-complexity-"));
const plugin = fileURLToPath(
	new URL("./cognitive-complexity.mjs", import.meta.url),
);
const oxlint = fileURLToPath(
	new URL("../../node_modules/oxlint/bin/oxlint", import.meta.url),
);
afterAll(() => rmSync(directory, { recursive: true, force: true }));

function lint(source: string, cognitive: number, cyclomatic = 18) {
	const config = join(directory, "config.json");
	const file = join(directory, "fixture.ts");
	writeFileSync(
		config,
		JSON.stringify({
			categories: { correctness: "off" },
			jsPlugins: [{ name: "pbp", specifier: plugin }],
			rules: {
				"pbp/cognitive-complexity": ["error", { max: cognitive }],
				complexity: ["error", { max: cyclomatic }],
			},
		}),
	);
	writeFileSync(file, source);
	const result = spawnSync(
		process.execPath,
		[oxlint, "--config", config, "--format=json", "--threads=1", file],
		{ encoding: "utf8" },
	);
	expect(result.error).toBeUndefined();
	expect(result.status, result.stderr).not.toBeNull();
	return result;
}

describe("local complexity rules", () => {
	it("accepts cognitive 6 and rejects cognitive 7", () => {
		const checks = "if (x) x--;";
		expect(lint(`function f(x) { ${checks.repeat(6)} }`, 6).status).toBe(0);
		const over = lint(`function f(x) { ${checks.repeat(7)} }`, 6);
		expect(over.status).toBe(1);
		expect(over.stdout).toContain("cognitive complexity 7");
	});
	it.each([
		["function f(x) { if (x) { while (x) { if (x) x--; } } }", 6],
		["function f(x) { if (x) x--; else if (x) x++; else x = 0; }", 3],
		["function f(a,b,c,d) { if (a && b || c && d) return 1; }", 4],
		["function f(x) { return () => { if (x) return 1; }; }", 2],
		[
			"function f(x) { if (x) switch(x) { case 1: return 1; default: return 2; } }",
			3,
		],
		["function f() { return f() + f(); }", 1],
		["const obj = { f() { return f(); } };", 0],
		["const obj = { f() { return this.f() + this.f(); } };", 1],
		["function f(x) { outer: while(x) { if (x) break outer; } }", 4],
		["function f() { try { g(); } catch (e) { if (e) throw e; } }", 3],
		["function f(x,y) { return x ?? y; }", 0],
	])("scores %s as %s", (source, score) => {
		expect(lint(source, score).status).toBe(0);
		if (score === 0) return;
		const over = lint(source, score - 1);
		expect(over.status).toBe(1);
		expect(over.stdout).toContain(`cognitive complexity ${score}`);
	});
	it("accepts classic cyclomatic 18 and rejects 19", () => {
		const expression = (conditions: number) =>
			`function f(x) { return ${Array.from({ length: conditions }, () => "x").join(" ?? ")}; }`;
		expect(lint(expression(18), 6).status).toBe(0);
		const over = lint(expression(19), 6);
		expect(over.status).toBe(1);
		expect(over.stdout).toContain("complexity of 19");
	});
});
