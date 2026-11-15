// Prints what the working tree's generated data changed since a git ref, and
// sets the `changed` step output in GitHub Actions. The refresh workflow uses
// it to skip pushing numbers the standing PR already has.
//
//   bun scripts/data-changes.ts <ref> [--summary <file.md>]

import { writeFile } from "node:fs/promises";
import { hasDataChanges } from "../src/domain/data-changes.ts";
import { renderDataChanges } from "./data-changes-markdown.ts";
import { changesSince, setOutput } from "./data-snapshot.ts";

const [ref, flag, path] = process.argv.slice(2);
if (!ref || (flag && (flag !== "--summary" || !path)))
	throw new Error("Usage: data-changes.ts <ref> [--summary <file.md>]");

const { changes } = await changesSince(ref);
const summary = renderDataChanges(changes);
if (path) await writeFile(path, `${summary}\n`);
await setOutput("changed", String(hasDataChanges(changes)));
console.log(summary);
