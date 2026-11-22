import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";

export class FontAssetError extends Data.TaggedError("FontAssetError")<{
	message: string;
	cause?: unknown;
}> {}

export class FontAssets extends Context.Service<
	FontAssets,
	{
		readonly read: (url: string) => Effect.Effect<Blob, FontAssetError>;
	}
>()("slopsubs/FontAssets") {
	static readonly layer = Layer.succeed(this, { read: readFont });
}

function readFont(url: string) {
	return Effect.gen(function* () {
		const response = yield* Effect.tryPromise({
			try: (signal) => fetch(url, { signal }),
			catch: (cause) =>
				new FontAssetError({ message: `Cannot fetch ${url}`, cause }),
		});
		if (!response.ok)
			return yield* new FontAssetError({
				message: `${url} returned ${response.status}`,
			});
		return yield* Effect.tryPromise({
			try: () => response.blob(),
			catch: (cause) =>
				new FontAssetError({ message: `Cannot read ${url}`, cause }),
		});
	});
}

const Woff2Header = Schema.decodeUnknownEffect(Schema.Literal("wOF2"));
const DataUrl = Schema.decodeUnknownEffect(
	Schema.String.check(Schema.isPattern(/^data:[^,]*;base64,/)),
);

function verifyFontHeader(url: string, blob: Blob) {
	return Effect.tryPromise({
		try: () => blob.slice(0, 4).text(),
		catch: (cause) =>
			new FontAssetError({
				message: `Cannot read WOFF2 header for ${url}`,
				cause,
			}),
	}).pipe(
		Effect.flatMap((header) =>
			Woff2Header(header).pipe(
				Effect.mapError(
					(cause) =>
						new FontAssetError({
							message: `${url} is not a WOFF2 font`,
							cause,
						}),
				),
			),
		),
	);
}

function readDataUrl(url: string, blob: Blob) {
	return Effect.callback<string, FontAssetError>((resume) => {
		const reader = new FileReader();
		reader.onload = () => {
			resume(
				DataUrl(reader.result).pipe(
					Effect.mapError(
						(cause) =>
							new FontAssetError({ message: `Cannot embed ${url}`, cause }),
					),
				),
			);
		};
		reader.onerror = () =>
			resume(
				Effect.fail(
					new FontAssetError({
						message: `Cannot embed ${url}`,
						cause: reader.error,
					}),
				),
			);
		reader.readAsDataURL(blob);
		return Effect.sync(() => {
			if (reader.readyState === FileReader.LOADING) reader.abort();
		});
	});
}

/** Reuse a successful font conversion across exports. Retry on the next export if it fails. */
export function cachedFontDataUrl(url: string) {
	const convert = Effect.gen(function* () {
		const fonts = yield* FontAssets;
		const blob = yield* fonts.read(url);
		yield* verifyFontHeader(url, blob);
		return yield* readDataUrl(url, blob);
	});
	return Effect.runSync(
		Effect.cachedWithTTL(convert, (exit) =>
			Exit.isSuccess(exit) ? Duration.infinity : Duration.zero,
		),
	);
}
