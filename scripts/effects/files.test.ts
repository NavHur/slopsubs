import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { readJsonFile, TextFiles } from "./files.ts";

const RecordCount = Schema.Struct({ count: Schema.Int });
const run = <A, E>(effect: Effect.Effect<A, E, TextFiles>) =>
	Effect.runPromise(Effect.provide(effect, TextFiles.layer));

describe("reading generated JSON", () => {
	it("distinguishes missing files, malformed JSON and invalid rows", async () => {
		const dir = await mkdtemp(join(tmpdir(), "slopsubs-json-"));
		const path = join(dir, "counts.json");
		const write = (text: string) =>
			run(Effect.flatMap(TextFiles, (files) => files.write(path, text)));
		const read = () => run(readJsonFile(RecordCount, path));
		try {
			await expect(read()).rejects.toMatchObject({
				_tag: "FileReadError",
				path,
			});
			await write("{");
			await expect(read()).rejects.toMatchObject({
				_tag: "InvalidJsonFile",
				path,
			});
			await write('{"count": 2.5}');
			await expect(read()).rejects.toMatchObject({
				_tag: "InvalidJsonFile",
				path,
			});
			await write('{"count": 2}');
			await expect(read()).resolves.toEqual({ count: 2 });
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
