// Reads the command-line flags of scripts/import-benchmarks.ts.

import { Effect, Schema } from "effect";
import { decodeArgument } from "./effects/arguments.ts";

type Args = {
	bundle?: string;
	/** Cached AA model pages, one per `--html`; none means fetch them. */
	html: string[];
	allowMissingCost: boolean;
	allowScoreDrift: boolean;
};

const Flag = Schema.Literals([
	"--bundle",
	"--html",
	"--allow-missing-cost",
	"--allow-score-drift",
]);

export function parseArgs(argv: string[]) {
	return Effect.gen(function* () {
		const args: Args = {
			html: [],
			allowMissingCost: false,
			allowScoreDrift: false,
		};
		for (let i = 0; i < argv.length; i++) {
			const token = argv[i];
			const flag = yield* decodeArgument(
				Flag,
				token,
				`Unknown argument ${token}`,
			);
			switch (flag) {
				case "--bundle":
					args.bundle = argv[++i];
					break;
				case "--html":
					args.html.push(...argv.slice(++i, i + 1));
					break;
				case "--allow-missing-cost":
					args.allowMissingCost = true;
					break;
				case "--allow-score-drift":
					args.allowScoreDrift = true;
					break;
			}
		}
		return args;
	});
}
