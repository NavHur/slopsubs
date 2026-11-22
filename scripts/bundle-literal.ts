// Reads data literals out of slopalytics' minified JS bundle.

import { Data, Effect, Option, Schema } from "effect";
import { stringLiteralEnd } from "../src/domain/flight.ts";

export class BundleLayoutError extends Data.TaggedError("BundleLayoutError")<{
	message: string;
}> {}

const QUOTES = new Set(["`", '"', "'"]);
const BRACE_DELTA: Record<string, number> = { "{": 1, "}": -1 };

/** End of the object literal opening at `start`, skipping string contents. */
function objectEnd(source: string, start: number): Option.Option<number> {
	let depth = 0;
	for (let i = start; i < source.length; i++) {
		if (QUOTES.has(source[i])) i = stringLiteralEnd(source, i);
		else depth += BRACE_DELTA[source[i]] ?? 0;
		if (depth === 0) return Option.some(i + 1);
	}
	return Option.none();
}

/** Minified tokens: a backtick string, a double-quoted string (left as is), a
 * !0/!1 boolean, a bare key, a .5 or 1e6 number, or any other character. */
const TOKEN =
	/`(?<backtick>[^`$\\]*)`|"(?:[^"\\]|\\.)*"|(?<boolean>!0|!1)|(?<key>[A-Za-z_$][\w$]*)(?=\s*:)|(?<number>-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)|[\s\S]/g;

/** The JSON form of each rewritten token kind, by its group in TOKEN. */
const TOKEN_TO_JSON: Record<string, (text: string) => string> = {
	backtick: (text) => JSON.stringify(text),
	boolean: (flag) => (flag === "!0" ? "true" : "false"),
	key: (name) => JSON.stringify(name),
	number: (digits) => String(Number(digits)),
};

function tokenToJson({ 0: token, groups = {} }: RegExpExecArray): string {
	for (const [kind, toJson] of Object.entries(TOKEN_TO_JSON)) {
		const text = groups[kind];
		if (text !== undefined) return toJson(text);
	}
	return token;
}

/** Rewrites a minified JS data literal as JSON, token by token. */
function literalToJson(literal: string): string {
	return Array.from(literal.matchAll(TOKEN), tokenToJson).join("");
}

/** The object literal the first match of `anchor` opens, as JSON data. */
export function extract(source: string, anchor: RegExp) {
	return Effect.gen(function* () {
		const found = anchor.exec(source);
		if (!found)
			return yield* new BundleLayoutError({
				message: `Anchor ${anchor} not found in bundle`,
			});
		const start = found.index + found[0].indexOf("{");
		const end = objectEnd(source, start);
		if (Option.isNone(end))
			return yield* new BundleLayoutError({
				message: `Unbalanced literal starting at ${start}`,
			});
		return yield* Schema.decodeUnknownEffect(
			Schema.fromJsonString(Schema.Unknown),
		)(literalToJson(source.slice(start, end.value)));
	});
}
