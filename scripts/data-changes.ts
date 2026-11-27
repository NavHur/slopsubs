import { Commands } from "./effects/commands.ts";
// Prints what the working tree's generated data changed since a git ref.
// Usage and the "No data changed." last line: README.md, "Benchmark Data".

import { Effect, Layer, Schema } from "effect";
import { renderDataChanges } from "./data-changes-markdown.ts";
import { changesSince } from "./data-snapshot.ts";
import { InvalidCommandArguments } from "./effects/arguments.ts";
import { TextFiles } from "./effects/files.ts";

const Args = Schema.Union([
	Schema.Tuple([Schema.NonEmptyString]),
	Schema.Tuple([
		Schema.NonEmptyString,
		Schema.Literal("--summary"),
		Schema.NonEmptyString,
	]),
]);

const main = Effect.gen(function* () {
	const [ref, , path] = yield* Schema.decodeUnknownEffect(Args)(
		process.argv.slice(2),
	).pipe(
		Effect.mapError(
			(cause) =>
				new InvalidCommandArguments({
					message: "Usage: data-changes.ts <ref> [--summary <file.md>]",
					cause,
				}),
		),
	);
	const { changes } = yield* changesSince(ref);
	const summary = yield* renderDataChanges(changes);
	const files = yield* TextFiles;
	if (path) yield* files.write(path, `${summary}\n`);
	console.log(summary);
});

await Effect.runPromise(
	main.pipe(Effect.provide(Layer.mergeAll(TextFiles.layer, Commands.layer))),
);
