import { Data, Effect, Schema } from "effect";

export class InvalidCommandArguments extends Data.TaggedError(
	"InvalidCommandArguments",
)<{
	message: string;
	cause?: unknown;
}> {}

export function decodeArgument<S extends Schema.Constraint>(
	schema: S,
	value: string | undefined,
	message: string,
) {
	return Schema.decodeUnknownEffect(schema)(value).pipe(
		Effect.mapError((cause) => new InvalidCommandArguments({ message, cause })),
	);
}

/** Required values for options that do not consume the next flag. */
export const FlagValue = Schema.NonEmptyString.check(
	Schema.makeFilter(
		(value) => !value.startsWith("--") || "Expected an option value",
	),
);

export function commandOptions<S extends Schema.Constraint>(
	schema: S,
	parse: () => unknown,
) {
	return Effect.try({
		try: parse,
		catch: (cause) =>
			new InvalidCommandArguments({ message: String(cause), cause }),
	}).pipe(Effect.flatMap(Schema.decodeUnknownEffect(schema)));
}
