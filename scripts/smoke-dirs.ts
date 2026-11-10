// Where complexity-smoke reads its baseline screenshots, kept apart from where
// it writes new ones so a comparison run cannot overwrite what it compares to.

import { realpathSync } from "node:fs";
import { resolve } from "node:path";

/** The directory itself, even through a symlink; a missing one is its own path. */
function directoryIdentity(dir: string): string {
	try {
		return realpathSync(dir);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return resolve(dir);
		throw error;
	}
}

/**
 * The directory to compare against, or undefined when recording a baseline.
 * Throws for an empty path, which would silently skip the comparison, and for
 * the output directory or a link to it: the new screenshots would replace the
 * baseline on disk.
 */
export function baselineDirectory(
	out: string,
	compare: string | undefined,
): string | undefined {
	if (compare === undefined) return undefined;
	if (compare === "") throw new Error("--compare needs a baseline directory.");
	const outDir = directoryIdentity(out);
	if (directoryIdentity(compare) === outDir) {
		throw new Error(
			`--compare and --out are both ${outDir}: a comparison run would overwrite its baseline. Pass a different --out.`,
		);
	}
	return compare;
}
