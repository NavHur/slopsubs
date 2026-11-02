/**
 * Runs `step` until `done` holds for its result, returning every result. Throws
 * when `maxSteps` run out first, so a stuck pass is not read as a full one.
 */
export async function stepUntil<T>(
	step: () => Promise<T>,
	done: (result: T) => boolean,
	maxSteps: number,
	what: string,
): Promise<T[]> {
	const results: T[] = [];
	for (let i = 0; i < maxSteps; i++) {
		const result = await step();
		results.push(result);
		if (done(result)) return results;
	}
	throw new Error(`${what} did not finish in ${maxSteps} steps`);
}
