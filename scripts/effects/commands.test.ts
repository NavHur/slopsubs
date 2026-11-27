import { Effect } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { Commands } from "./commands.ts";

const run = <A, E>(effect: Effect.Effect<A, E, Commands>) =>
	Effect.runPromise(effect.pipe(Effect.provide(Commands.layer)));

describe("command service", () => {
	it("captures stdout without a shell", async () => {
		await expect(
			run(
				Effect.flatMap(Commands, (commands) =>
					commands.capture(
						process.execPath,
						["-e", "process.stdout.write(process.argv[1])", "a b"],
						{},
					),
				),
			),
		).resolves.toBe("a b");
	});

	it("preserves a failed command's cause", async () => {
		await expect(
			run(
				Effect.flatMap(Commands, (commands) =>
					commands.capture(process.execPath, ["-e", "process.exit(7)"], {}),
				),
			),
		).rejects.toMatchObject({ _tag: "CommandError", cause: { code: 7 } });
	});

	it("reports an inherited command's exit status", async () => {
		await expect(
			run(
				Effect.flatMap(Commands, (commands) =>
					commands.inherit(process.execPath, ["-e", "process.exit(7)"]),
				),
			),
		).resolves.toEqual({ status: 7, signal: null });
	});
});
