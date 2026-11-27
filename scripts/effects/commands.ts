import { execFile, spawn } from "node:child_process";
import { Context, Data, Effect, Layer } from "effect";

export class CommandError extends Data.TaggedError("CommandError")<{
	command: string;
	cause: unknown;
}> {
	override get message() {
		return `${this.command}: ${String(this.cause)}`;
	}
}

type CapturedOptions = { cwd?: URL; maxBuffer?: number };
type CommandExit = { status: number; signal: NodeJS.Signals | null };

export class Commands extends Context.Service<
	Commands,
	{
		readonly capture: (
			command: string,
			args: readonly string[],
			options: CapturedOptions,
		) => Effect.Effect<string, CommandError>;
		readonly inherit: (
			command: string,
			args: readonly string[],
		) => Effect.Effect<CommandExit, CommandError>;
	}
>()("slopsubs/Commands") {
	static readonly layer = Layer.succeed(this, {
		capture: (command, args, options) =>
			Effect.callback((resume, signal) => {
				execFile(
					command,
					args,
					{ ...options, signal, encoding: "utf8" },
					(cause, stdout) => {
						resume(
							cause
								? Effect.fail(new CommandError({ command, cause }))
								: Effect.succeed(stdout),
						);
					},
				);
			}),
		inherit: (command, args) =>
			Effect.callback((resume, signal) => {
				const child = spawn(command, args, { stdio: "inherit", signal });
				child.once("error", (cause) =>
					resume(Effect.fail(new CommandError({ command, cause }))),
				);
				child.once("exit", (status, signal) =>
					resume(Effect.succeed({ status: status ?? 1, signal })),
				);
			}),
	});
}
