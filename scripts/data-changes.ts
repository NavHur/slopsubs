// Prints what the working tree's generated data changed since a git ref.
// Usage and the "No data changed." last line: README.md, "Benchmark Data".

import { writeFile } from "node:fs/promises";
import { renderDataChanges } from "./data-changes-markdown.ts";
import { changesSince } from "./data-snapshot.ts";

const [ref, flag, path] = process.argv.slice(2);
if (!ref || (flag && (flag !== "--summary" || !path)))
	throw new Error("Usage: data-changes.ts <ref> [--summary <file.md>]");

const { changes } = await changesSince(ref);
const summary = renderDataChanges(changes);
if (path) await writeFile(path, `${summary}\n`);
console.log(summary);
