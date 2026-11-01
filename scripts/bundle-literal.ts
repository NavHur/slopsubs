// Reads data literals out of slopalytics' minified JS bundle.

import { stringLiteralEnd } from "../src/domain/flight.ts";

export type Literal =
	| null
	| boolean
	| number
	| string
	| Literal[]
	| { [key: string]: Literal };

const QUOTES = new Set(["`", '"', "'"]);
const BRACE_DELTA: Record<string, number> = { "{": 1, "}": -1 };

/** End of the object literal opening at `start`, skipping string contents. */
function objectEnd(source: string, start: number): number {
	let depth = 0;
	for (let i = start; i < source.length; i++) {
		if (QUOTES.has(source[i])) i = stringLiteralEnd(source, i);
		else depth += BRACE_DELTA[source[i]] ?? 0;
		if (depth === 0) return i + 1;
	}
	throw new Error(`Unbalanced literal starting at ${start}`);
}

// Rewrites a minified JS data literal (bare keys, backtick strings, !0/!1,
// .5 and 1e6 numbers) as JSON.
function literalToJson(literal: string): string {
	const token =
		/`([^`$\\]*)`|"((?:[^"\\]|\\.)*)"|!0|!1|([A-Za-z_$][\w$]*)(?=\s*:)|(-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)|[\s\S]/g;
	return literal.replace(token, (match, backtick, quoted, key, number) => {
		if (backtick !== undefined) return JSON.stringify(backtick);
		if (quoted !== undefined) return match;
		if (match === "!0") return "true";
		if (match === "!1") return "false";
		if (key !== undefined) return JSON.stringify(key);
		if (number !== undefined) return String(Number(number));
		return match;
	});
}

/** The object literal the first match of `anchor` opens, as JSON data. */
export function extract(source: string, anchor: RegExp): Literal {
	const found = anchor.exec(source);
	if (!found) throw new Error(`Anchor ${anchor} not found in bundle`);
	const start = found.index + found[0].indexOf("{");
	return JSON.parse(
		literalToJson(source.slice(start, objectEnd(source, start))),
	);
}
