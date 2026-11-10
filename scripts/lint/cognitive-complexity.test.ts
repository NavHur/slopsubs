import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vite-plus/test";
import config from "../../vite.config.ts";

const directory = mkdtempSync(join(tmpdir(), "slopsubs-complexity-"));
const plugin = fileURLToPath(
	new URL("./cognitive-complexity.mjs", import.meta.url),
);
// oxlint is vite-plus's dependency; resolve it from there so the path holds
// whether or not the installer hoists it to the project root.
const fromVitePlus = createRequire(
	createRequire(import.meta.url).resolve("vite-plus/package.json"),
);
const oxlint = join(
	dirname(fromVitePlus.resolve("oxlint/package.json")),
	"bin/oxlint",
);
afterAll(() => rmSync(directory, { recursive: true, force: true }));

// The caps the repository enforces, read from its own lint config.
const repositoryRules = {
	"pbp/cognitive-complexity": config.lint?.rules?.["pbp/cognitive-complexity"],
	complexity: config.lint?.rules?.complexity,
};

function lintWith(source: string, rules: object) {
	const configFile = join(directory, "config.json");
	const file = join(directory, "fixture.ts");
	writeFileSync(
		configFile,
		JSON.stringify({
			categories: { correctness: "off" },
			jsPlugins: [{ name: "pbp", specifier: plugin }],
			rules,
		}),
	);
	writeFileSync(file, source);
	const result = spawnSync(
		process.execPath,
		[oxlint, "--config", configFile, "--format=json", "--threads=1", file],
		{ encoding: "utf8" },
	);
	expect(result.error).toBeUndefined();
	expect(result.status, result.stderr).not.toBeNull();
	return result;
}

const lintRepository = (source: string) => lintWith(source, repositoryRules);
const lintCognitive = (source: string, max: number) =>
	lintWith(source, { "pbp/cognitive-complexity": ["error", { max }] });

describe("local complexity rules", () => {
	it("accepts cognitive 6 and rejects cognitive 7", () => {
		const checks = "if (x) x--;";
		const atCap = lintRepository(`function f(x) { ${checks.repeat(6)} }`);
		expect(atCap.status).toBe(0);
		const over = lintRepository(`function f(x) { ${checks.repeat(7)} }`);
		expect(over.status).toBe(1);
		expect(over.stdout).toContain("cognitive complexity 7");
	});
	it.each([
		["function f(x) { if (x) { while (x) { if (x) x--; } } }", 6],
		["function f(x) { if (x) x--; else if (x) x++; else x = 0; }", 3],
		["function f(x) { while (x) { if (x) x--; else if (x) x++; } }", 4],
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
		["function f(x) { return x ? 1 : 2; }", 1],
		["function f(x,y) { return x ? (y ? 1 : 2) : 3; }", 3],
		["function f(a) { for (const x of a) { if (x) return 1; } }", 3],
		["function f(x) { do { if (x) x--; } while (x); }", 3],
		["function f(a,b,c) { return (a && b) ?? c; }", 1],
		["function f(a,b,c) { return (a ?? b) && c; }", 1],
	])("scores %s as %s", (source, score) => {
		expect(lintCognitive(source, score).status).toBe(0);
		if (score === 0) return;
		const over = lintCognitive(source, score - 1);
		expect(over.status).toBe(1);
		expect(over.stdout).toContain(`cognitive complexity ${score}`);
	});
	it("reports only the top-level function, scoring nested ones in it", () => {
		const source =
			"function outer(x) { function inner(y) { if (y) { if (y) y--; } } if (x) x--; }";
		const result = lintCognitive(source, 5);
		const messages = JSON.parse(result.stdout).diagnostics.map(
			(diagnostic: { message: string }) => diagnostic.message,
		);
		expect(messages).toHaveLength(1);
		expect(messages[0]).toContain("`outer` has cognitive complexity 6");
	});
	it("accepts classic cyclomatic 18 and rejects 19", () => {
		const expression = (conditions: number) =>
			`function f(x) { return ${Array.from({ length: conditions }, () => "x").join(" ?? ")}; }`;
		expect(lintRepository(expression(18)).status).toBe(0);
		const over = lintRepository(expression(19));
		expect(over.status).toBe(1);
		expect(over.stdout).toContain("complexity of 19");
	});
});
