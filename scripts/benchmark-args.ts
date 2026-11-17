// Reads the command-line flags of scripts/import-benchmarks.ts.

type Args = {
	bundle?: string;
	/** Cached AA model pages, one per `--html`; none means fetch them. */
	html: string[];
	allowMissingCost: boolean;
	allowScoreDrift: boolean;
};

export function parseArgs(argv: string[]): Args {
	const args: Args = {
		html: [],
		allowMissingCost: false,
		allowScoreDrift: false,
	};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--bundle":
				args.bundle = argv[++i];
				break;
			case "--html":
				args.html.push(...argv.slice(++i, i + 1));
				break;
			case "--allow-missing-cost":
				args.allowMissingCost = true;
				break;
			case "--allow-score-drift":
				args.allowScoreDrift = true;
				break;
			default:
				throw new Error(`Unknown argument ${arg}`);
		}
	}
	return args;
}
