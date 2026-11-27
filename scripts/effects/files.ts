import { type Dirent, realpathSync } from "node:fs";
import {
	appendFile,
	mkdir,
	readdir,
	readFile,
	writeFile,
} from "node:fs/promises";
import { Context, Data, Effect, Layer, Schema } from "effect";

export class FileReadError extends Data.TaggedError("FileReadError")<{
	path: string;
	cause: unknown;
}> {
	override get message() {
		return `Cannot read ${this.path}: ${String(this.cause)}`;
	}
}

export class FileWriteError extends Data.TaggedError("FileWriteError")<{
	path: string;
	cause: unknown;
}> {
	override get message() {
		return `Cannot write ${this.path}: ${String(this.cause)}`;
	}
}

export class InvalidJsonFile extends Data.TaggedError("InvalidJsonFile")<{
	path: string;
	cause: Schema.SchemaError;
}> {
	override get message() {
		return `${this.path}: ${this.cause.message}`;
	}
}

export class TextFiles extends Context.Service<
	TextFiles,
	{
		readonly readBytes: (
			path: string | URL,
		) => Effect.Effect<Buffer, FileReadError>;
		readonly makeDirectory: (
			path: string | URL,
		) => Effect.Effect<void, FileWriteError>;
		readonly realPath: (path: string) => Effect.Effect<string, FileReadError>;
		readonly read: (path: string | URL) => Effect.Effect<string, FileReadError>;
		readonly list: (
			path: string | URL,
		) => Effect.Effect<Dirent[], FileReadError>;
		readonly append: (
			path: string | URL,
			text: string,
		) => Effect.Effect<void, FileWriteError>;
		readonly write: (
			path: string | URL,
			text: string | Uint8Array,
		) => Effect.Effect<void, FileWriteError>;
	}
>()("slopsubs/TextFiles") {
	static readonly layer = Layer.succeed(this, {
		readBytes: (path) =>
			Effect.tryPromise({
				try: (signal) => readFile(path, { signal }),
				catch: (cause) => new FileReadError({ path: String(path), cause }),
			}),
		makeDirectory: (path) =>
			Effect.tryPromise({
				try: () => mkdir(path, { recursive: true }),
				catch: (cause) => new FileWriteError({ path: String(path), cause }),
			}).pipe(Effect.asVoid),
		realPath: (path) =>
			Effect.try({
				// Node's JS realpath normalizes dot segments, unlike the native async variant.
				try: () => realpathSync(path),
				catch: (cause) => new FileReadError({ path, cause }),
			}),
		read: (path) =>
			Effect.tryPromise({
				try: (signal) => readFile(path, { encoding: "utf8", signal }),
				catch: (cause) => new FileReadError({ path: String(path), cause }),
			}),
		list: (path) =>
			Effect.tryPromise({
				try: () => readdir(path, { withFileTypes: true }),
				catch: (cause) => new FileReadError({ path: String(path), cause }),
			}),
		append: (path, text) =>
			Effect.tryPromise({
				try: () => appendFile(path, text),
				catch: (cause) => new FileWriteError({ path: String(path), cause }),
			}),
		write: (path, text) =>
			Effect.tryPromise({
				try: (signal) => writeFile(path, text, { signal }),
				catch: (cause) => new FileWriteError({ path: String(path), cause }),
			}),
	});
}

export const decodeFileValue = <S extends Schema.Constraint>(
	schema: S,
	path: string | URL,
	value: unknown,
) =>
	Schema.decodeUnknownEffect(schema)(value).pipe(
		Effect.mapError(
			(cause) => new InvalidJsonFile({ path: String(path), cause }),
		),
	);

export const decodeJsonFile = <S extends Schema.Constraint>(
	schema: S,
	path: string | URL,
	text: string,
) => decodeFileValue(Schema.fromJsonString(schema), path, text);

export const readJsonFile = <S extends Schema.Constraint>(
	schema: S,
	path: string | URL,
) =>
	Effect.gen(function* () {
		const files = yield* TextFiles;
		return yield* decodeJsonFile(schema, path, yield* files.read(path));
	});
