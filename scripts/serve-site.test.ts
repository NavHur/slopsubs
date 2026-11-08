import { readFile } from "node:fs/promises";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { originOf, serveSite } from "./serve-site.ts";

vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));
let server: Server | undefined;
afterEach(async () => {
	await new Promise<void>((resolve, reject) => {
		if (!server) return resolve();
		server.close((error) => (error ? reject(error) : resolve()));
	});
	vi.resetAllMocks();
});

describe("built site server", () => {
	it.each([
		["/", "index.html", "text/html"],
		["/assets/app.js", "assets/app.js", "text/javascript"],
		["/asset.bin", "asset.bin", "application/octet-stream"],
	])("serves %s", async (path, file, contentType) => {
		vi.mocked(readFile).mockResolvedValue(Buffer.from("built asset"));
		server = await serveSite();
		const response = await fetch(new URL(path, originOf(server)));
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe(contentType);
		expect(await response.text()).toBe("built asset");
		expect(readFile).toHaveBeenCalledWith(
			expect.stringContaining(`/dist/client/${file}`),
		);
	});
	it.each(["ENOENT", "EISDIR"])("returns an empty 404 for %s", async (code) => {
		vi.mocked(readFile).mockRejectedValue(
			Object.assign(new Error("missing"), { code }),
		);
		server = await serveSite();
		const response = await fetch(new URL("missing", originOf(server)));
		expect(response.status).toBe(404);
		expect(await response.text()).toBe("");
	});
});
