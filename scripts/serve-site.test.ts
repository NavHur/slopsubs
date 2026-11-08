import { readFile } from "node:fs/promises";
import {
	createServer,
	type IncomingMessage,
	type RequestListener,
	type Server,
	type ServerResponse,
} from "node:http";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { originOf, serveSite } from "./serve-site.ts";

vi.mock("node:fs/promises", () => ({ readFile: vi.fn() }));
vi.mock("node:http", async (importOriginal) => {
	const http = await importOriginal<typeof import("node:http")>();
	return { ...http, createServer: vi.fn(http.createServer) };
});
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
	it("answers 500 and rethrows any other read failure", async () => {
		const failure = Object.assign(new Error("denied"), { code: "EACCES" });
		vi.mocked(readFile).mockRejectedValue(failure);
		server = await serveSite();
		const handle = vi.mocked(createServer).mock.calls[0][0] as RequestListener;
		const response = { writeHead: vi.fn(), end: vi.fn() };
		response.writeHead.mockReturnValue(response);
		await expect(
			handle(
				{ url: "/app.js" } as IncomingMessage,
				response as unknown as ServerResponse,
			),
		).rejects.toBe(failure);
		expect(response.writeHead).toHaveBeenCalledWith(500);
		expect(response.end).toHaveBeenCalledOnce();
	});
});
