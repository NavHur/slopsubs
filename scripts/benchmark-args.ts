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
		if (arg === "--bundle") args.bundle = argv[++i];
		else if (arg === "--html") args.html = argv[++i];
		else if (arg === "--allow-missing-cost") args.allowMissingCost = true;
		else if (arg === "--allow-score-drift") args.allowScoreDrift = true;
		else throw new Error(`Unknown argument ${arg}`);
	}
	return args;
}
