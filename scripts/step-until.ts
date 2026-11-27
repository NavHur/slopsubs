import { Data, Effect } from "effect";

export class StepLimitReached extends Data.TaggedError("StepLimitReached")<{
	what: string;
	maxSteps: number;
}> {
	override get message() {
		return `${this.what} did not finish in ${this.maxSteps} steps`;
	}
}

/** Runs steps until done holds, or fails when the bounded pass is exhausted. */
export function stepUntil<T, E, R>(
	step: () => Effect.Effect<T, E, R>,
	done: (result: T) => boolean,
	maxSteps: number,
	what: string,
) {
	return Effect.gen(function* () {
		const results: T[] = [];
		for (let i = 0; i < maxSteps; i++) {
			const result = yield* step();
			results.push(result);
			if (done(result)) return results;
		}
		return yield* new StepLimitReached({ what, maxSteps });
	});
}
