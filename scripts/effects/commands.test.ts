import { Effect, Exit, Option } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { type CommandError, Commands } from "./commands.ts";

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

	it("fails with CommandError when Node rejects the startup arguments", async () => {
		// A Die has no error, so this finds only a typed failure.
		const failureOf = async <A>(
			effect: Effect.Effect<A, CommandError, Commands>,
		) =>
			Option.getOrUndefined(
				Exit.findErrorOption(
					await Effect.runPromiseExit(
						effect.pipe(Effect.provide(Commands.layer)),
					),
				),
			);
		await expect(
			failureOf(
				Effect.flatMap(Commands, (commands) =>
					commands.capture(process.execPath, [], {
						cwd: new URL("https://example.invalid/"),
					}),
				),
			),
		).resolves.toMatchObject({ _tag: "CommandError" });
		await expect(
			failureOf(
				Effect.flatMap(Commands, (commands) =>
					commands.inherit(process.execPath, ["a\0b"]),
				),
			),
		).resolves.toMatchObject({ _tag: "CommandError" });
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
