// Serves the prerendered build in dist/client for scripts that drive it in a
// browser. Build first: `vp build`.

import { readFile } from "node:fs/promises";
import {
	createServer,
	type Server,
	type IncomingMessage,
	type ServerResponse,
} from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { Context, Data, Effect, Layer, ManagedRuntime, Schema } from "effect";

const SITE_DIR = fileURLToPath(new URL("../dist/client", import.meta.url));

const CONTENT_TYPES: Record<string, string> = {
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".svg": "image/svg+xml",
	".png": "image/png",
	".json": "application/json",
	".woff2": "font/woff2",
};

const BASE_URL = "http://127.0.0.1";
const RequestTarget = Schema.String.check(
	Schema.makeFilter(
		(value) =>
			(value.startsWith("/") &&
				!/^\/[/\\]/.test(value) &&
				URL.canParse(value, BASE_URL)) ||
			"Expected a local request path",
	),
);

const isMissingFile = Schema.is(
	Schema.Struct({
		code: Schema.Literals(["ENOENT", "EISDIR"]),
	}),
);

class AssetNotFound extends Data.TaggedError("AssetNotFound")<{
	path: string;
}> {}

class AssetReadFailed extends Data.TaggedError("AssetReadFailed")<{
	path: string;
	cause: unknown;
}> {
	override get message() {
		return `Cannot read built asset ${this.path}: ${String(this.cause)}`;
	}
}

class BuiltAssets extends Context.Service<
	BuiltAssets,
	{
		readonly read: (
			path: string,
		) => Effect.Effect<Uint8Array, AssetNotFound | AssetReadFailed>;
	}
>()("slopsubs/BuiltAssets") {
	static readonly layer = Layer.succeed(this, {
		read: (path) =>
			Effect.tryPromise({
				try: (signal) => readFile(path, { signal }),
				catch: (cause) =>
					isMissingFile(cause)
						? new AssetNotFound({ path })
						: new AssetReadFailed({ path, cause }),
			}),
	});
}

function emptyResponse(response: ServerResponse, status: number) {
	return Effect.sync(() => {
		response.writeHead(status).end();
	});
}

/** Serves the prerendered build, with / mapped to index.html. */
function serveAsset(request: IncomingMessage, response: ServerResponse) {
	return Effect.gen(function* () {
		const target = yield* Schema.decodeUnknownEffect(RequestTarget)(
			request.url ?? "/",
		);
		const path = normalize(new URL(target, BASE_URL).pathname);
		const file = join(
			SITE_DIR,
			path.endsWith("/") ? `${path}index.html` : path,
		);
		const assets = yield* BuiltAssets;
		const body = yield* assets.read(file);
		response.writeHead(200, {
			"content-type":
				CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
		});
		response.end(body);
	}).pipe(
		Effect.catchTags({
			SchemaError: () => emptyResponse(response, 400),
			AssetNotFound: () => emptyResponse(response, 404),
			AssetReadFailed: (error) =>
				emptyResponse(response, 500).pipe(Effect.andThen(Effect.fail(error))),
		}),
	);
}

class SiteListenFailed extends Data.TaggedError("SiteListenFailed")<{
	cause: Error;
}> {
	override get message() {
		return `Cannot listen on the preview loopback address: ${this.cause.message}`;
	}
}

function listen(server: Server) {
	return Effect.callback<Server, SiteListenFailed>((resume) => {
		const onError = (cause: Error) =>
			resume(Effect.fail(new SiteListenFailed({ cause })));
		server.once("error", onError);
		server.listen(0, "127.0.0.1", () => {
			server.removeListener("error", onError);
			resume(Effect.succeed(server));
		});
	});
}

export async function serveSite(): Promise<Server> {
	const runtime = ManagedRuntime.make(BuiltAssets.layer);
	const server = createServer((request, response) =>
		runtime.runPromise(serveAsset(request, response)),
	);
	server.once("close", () => {
		void runtime.dispose();
	});
	try {
		return await runtime.runPromise(listen(server));
	} catch (cause) {
		await runtime.dispose();
		throw cause;
	}
}

/** The server's origin, with a trailing slash. */
export function originOf(server: Server): string {
	const address = server.address();
	if (!address || typeof address === "string") {
		throw new Error("The site server has no TCP address");
	}
	return `${BASE_URL}:${address.port}/`;
}
