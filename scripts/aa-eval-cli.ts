// The command-line flags and first summary line of scripts/import-aa-evals.ts.

import { Effect, Schema } from "effect";
import { decodeArgument, FlagValue } from "./effects/arguments.ts";

const Flag = Schema.Literals(["--html", "--eval-html"]);

export function parseArgs(argv: string[]) {
	return Effect.gen(function* () {
		const html: string[] = [];
		const evalHtml: string[] = [];
		for (let i = 0; i < argv.length; i++) {
			const token = argv[i];
			const flag = yield* decodeArgument(
				Flag,
				token,
				`Unknown argument ${token}`,
			);
			const value = yield* decodeArgument(
				FlagValue,
				argv[++i],
				`${flag} needs a file path`,
			);
			if (flag === "--html") html.push(value);
			else evalHtml.push(value);
		}
		return { html, evalHtml };
	});
}

/** How many eval rows were read and for how many model variants. */
export function summaryLine(
	rows: readonly { family: string; effort: string }[],
): string {
	const variants = new Set(rows.map((r) => `${r.family}@${r.effort}`));
	return `Read ${rows.length} eval rows for ${variants.size} model variants`;
}
