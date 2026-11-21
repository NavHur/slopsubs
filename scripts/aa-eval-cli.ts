// The command-line flags and first summary line of scripts/import-aa-evals.ts.

type Args = {
	/** Cached AA model pages, one per `--html`; none means fetch them. */
	html: string[];
	/** Cached AA eval pages, one per `--eval-html`; none means fetch them. */
	evalHtml: string[];
};

function flagValue(argv: string[], i: number): string {
	const value = argv[i + 1];
	if (value === undefined || value.startsWith("--"))
		throw new Error(`${argv[i]} needs a file path`);
	return value;
}

export function parseArgs(argv: string[]): Args {
	const args: Args = { html: [], evalHtml: [] };
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === "--html") args.html.push(flagValue(argv, i++));
		else if (argv[i] === "--eval-html")
			args.evalHtml.push(flagValue(argv, i++));
		else throw new Error(`Unknown argument ${argv[i]}`);
	}
	return args;
}

/** How many eval rows were read and for how many model variants. */
export function readLine(
	rows: readonly { family: string; effort: string }[],
): string {
	const variants = new Set(rows.map((r) => `${r.family}@${r.effort}`));
	return `Read ${rows.length} eval rows for ${variants.size} model variants`;
}
