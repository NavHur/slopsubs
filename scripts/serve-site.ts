// Serves the prerendered build in dist/client for the scripts that drive it
// in a browser.

import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const SITE_DIR = fileURLToPath(new URL("../dist/client", import.meta.url));

const CONTENT_TYPES: Record<string, string> = {
	".html": "text/html",
	".js": "text/javascript",
	".css": "text/css",
	".svg": "image/svg+xml",
	".png": "image/png",
	".json": "application/json",
};

/** A request for a path the build lacks: a 404, not a failure. */
function isMissingFile(error: unknown): boolean {
	const code = (error as NodeJS.ErrnoException).code;
	return code === "ENOENT" || code === "EISDIR";
}

export interface Site {
	/** The site's root URL, ending in a slash. */
	origin: string;
	close(): void;
}

/** Serves the prerendered build on a free port, with / mapped to index.html. */
export function serveSite(): Promise<Site> {
	const server = createServer(async (request, response) => {
		const path = normalize(new URL(request.url ?? "/", "http://x").pathname);
		const file = join(
			SITE_DIR,
			path.endsWith("/") ? `${path}index.html` : path,
		);
		try {
			const body = await readFile(file);
			response.writeHead(200, {
				"content-type":
					CONTENT_TYPES[extname(file)] ?? "application/octet-stream",
			});
			response.end(body);
		} catch (error) {
			if (!isMissingFile(error)) {
				response.writeHead(500).end();
				throw error;
			}
			response.writeHead(404).end();
		}
	});
	return new Promise((resolve) =>
		server.listen(0, "127.0.0.1", () => {
			const { port } = server.address() as AddressInfo;
			resolve({
				origin: `http://127.0.0.1:${port}/`,
				close: () => server.close(),
			});
		}),
	);
}
