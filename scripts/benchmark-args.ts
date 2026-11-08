// Reads the command-line flags of scripts/import-benchmarks.ts.

type Args = {
	bundle?: string;
	html?: string;
	allowMissingCost: boolean;
	allowScoreDrift: boolean;
};

export function parseArgs(argv: string[]): Args {
	const args: Args = { allowMissingCost: false, allowScoreDrift: false };
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		switch (arg) {
			case "--bundle":
				args.bundle = argv[++i];
				break;
			case "--html":
				args.html = argv[++i];
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
