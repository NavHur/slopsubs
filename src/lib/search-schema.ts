import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";

/** A shared link can contain fields this version cannot read. */
export function optionalValid<S extends Schema.Constraint>(schema: S) {
	return Schema.optional(schema).pipe(
		Schema.catchDecoding<Schema.optional<S>>(() =>
			Effect.succeed(Option.some(undefined)),
		),
	);
}

export function withFallback<S extends Schema.Constraint>(
	schema: S,
	fallback: NoInfer<S["Type"]>,
) {
	const defaulted = Schema.withDecodingDefaultType<S>(Effect.succeed(fallback))(
		schema,
	);
	return defaulted.pipe(
		Schema.catchDecoding<typeof defaulted>(() =>
			Effect.succeed(Option.some(fallback)),
		),
	);
}

/** Decode a selection item by item so retired IDs leave the remaining ones. */
export function knownItems<T extends string>(
	known: readonly T[],
	resolve: (kept: T[], providedCount: number) => T[] | undefined,
) {
	const item = Schema.Literals(known);
	const isKnown = Schema.is(item);
	const input = Schema.UndefinedOr(Schema.Array(Schema.Unknown));
	const output = Schema.UndefinedOr(Schema.mutable(Schema.Array(item)));
	return optionalValid(
		input.pipe(
			Schema.decodeTo(
				output,
				SchemaTransformation.transform({
					decode: (items) =>
						items === undefined
							? undefined
							: resolve(items.filter(isKnown), items.length),
					encode: (items) => items,
				}),
			),
		),
	);
}
