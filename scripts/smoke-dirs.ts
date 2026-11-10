// Where complexity-smoke reads its baseline screenshots, kept apart from where
// it writes new ones so a comparison run cannot overwrite what it compares to.

import { resolve } from "node:path";

/**
 * The directory to compare against, or undefined when recording a baseline.
 * Throws when it is the output directory: each screenshot would be written
 * over its baseline and then compared with itself, so the check always passed.
 */
export function baselineDirectory(
	out: string,
	compare: string | undefined,
): string | undefined {
	if (compare === undefined) return undefined;
	if (resolve(compare) === resolve(out)) {
		throw new Error(
			`--compare and --out are both ${resolve(out)}: a comparison run would overwrite its baseline. Pass a different --out.`,
		);
	}
	return compare;
}
