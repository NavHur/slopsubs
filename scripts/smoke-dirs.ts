// Where complexity-smoke reads its baseline screenshots, kept apart from where
// it writes new ones so a comparison run cannot overwrite what it compares to.

import { resolve } from "node:path";
import { Effect, Schema } from "effect";
import { InvalidCommandArguments } from "./effects/arguments.ts";
import { TextFiles } from "./effects/files.ts";

const missing = Schema.is(Schema.Struct({ code: Schema.Literal("ENOENT") }));

/** The directory itself, even through a symlink; a missing one is its own path. */
const directoryIdentity = Effect.fnUntraced(function* (dir: string) {
	const files = yield* TextFiles;
	return yield* files
		.realPath(dir)
		.pipe(
			Effect.catchTag("FileReadError", (error) =>
				missing(error.cause)
					? Effect.succeed(resolve(dir))
					: Effect.fail(error),
			),
		);
});

/** Rejects an empty or identical baseline before any screenshots are written. */
export const baselineDirectory = Effect.fnUntraced(function* (
	out: string,
	compare: string | undefined,
) {
	if (compare === undefined) return undefined;
	if (!compare)
		return yield* new InvalidCommandArguments({
			message: "--compare needs a baseline directory.",
		});
	const outDir = yield* directoryIdentity(out);
	if ((yield* directoryIdentity(compare)) === outDir)
		return yield* new InvalidCommandArguments({
			message: `--compare and --out are both ${outDir}: a comparison run would overwrite its baseline. Pass a different --out.`,
		});
	return compare;
});
