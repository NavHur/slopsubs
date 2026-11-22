# Data refresh runbook

You run the scheduled data refresh. The README's "Benchmark Data" section owns
the run itself: the seven steps, the failure issue, the PR. This file covers
what that section leaves to you: what each source feeds, how to read a source
in the T3 browser when its script breaks, and how to **hand-patch** the data so
the PR still ships.

You change only `src/data/*.json`, and only through the scripts or the patches
below. When a script cannot produce a file, the PR still ships with that file's
last good rows kept and marked **stale**. A value you did not read off a live
page is never written: keep the old one.

## Sources

A **covered family** is one some plan charts: `PLAN_FAMILIES` in
`scripts/plan-families.ts`. Only covered families reach the site, so they are
the only rows worth patching by hand.

| Source | URL | Script | Writes | Schema (`src/domain/model.ts`) |
| --- | --- | --- | --- | --- |
| AA model pages | `https://artificialanalysis.ai/models/<slug>`, one per covered family | `import-benchmarks` | `benchmarks.json` | `BenchmarkDataset` |
| slopalytics bundle | `https://slopalytics.com`, its `/assets/index-*.js` | `import-benchmarks` | `benchmarks.json` | `BenchmarkDataset` |
| AA model pages (same pages) | as above | `import-aa-evals` | `aa-evals.json` | `AaEvalsDataset` |
| AA eval pages | `https://artificialanalysis.ai/evaluations/<eval>`, one per eval | `import-aa-evals` | `aa-evals.json` | `AaEvalsDataset` |
| Cognition FrontierCode | `https://cognition.com/data/frontier-code-2.0/data.json` | `import-frontiercode` | `frontiercode.json` | `FrontierCodeDataset` |
| the three files above | | `build-plans` | `plans.json`, `chart-benchmarks.json` | `Plans`, `ChartData` |

Field by field:

- **`benchmarks.json`** (one row per model at one effort): AA's record gives
  `score` (`intelligenceIndex`, 2 decimals), `inputPricePerMTokUsd` /
  `outputPricePerMTokUsd` (`price1mInputTokens` / `price1mOutputTokens`, 6
  decimals), `released` (`releaseDate`), `costPerTaskUsd`
  (`intelligenceIndexCostPerTask.cost.total`, 5 decimals), `tokensPerTask`
  (`intelligenceIndexOutputTokensPerTask.output`, whole) and `secondsPerTask`
  (`intelligenceIndexTimePerTask`, 1 decimal). slopalytics gives the rest: `id`,
  `family`, `name`, `variant`, `lab`, `labName`, `open`, `deprecated`, `effort`,
  `effortLabel`, `effortOrder`, plus tokens and time where AA has none. The
  `frontier` block comes from the slopalytics bundle as is.
- **`aa-evals.json`** (one row per family, effort and eval): `score` comes from
  the AA record's named field for each of the nine evals (table under
  [AA model page](#aa-model-page)). `costPerTaskUsd` is the record's
  `intelligenceIndexCostPerTask.evaluations[].weightedCostPerTask` over the
  eval's index weight (5 decimals). `tokensPerTask` is the eval page record's
  answer plus reasoning tokens over the eval's task count, and `secondsPerTask`
  is those tokens over the model's output speed. The weights and task counts
  live in `src/domain/aa-eval-index.ts`. AA's eval pages embed records for
  their chart's default models only, so most rows **carry forward** their
  tokens and time from the file on disk: expected, not stale. The import logs
  how many rows carried a figure.
- **`frontiercode.json`**: Cognition's `data[<model name>][<effort>].main`.
  `score` is `new_score × 100` (2 decimals), `costPerTaskUsd` is `cost`, and
  `tokensPerTask` is `tokens`. The family is the slugified model name, with the
  aliases in `scripts/import-frontiercode.ts`.

## When a script fails

1. Match the error against [Failure modes](#failure-modes). It tells you which
   file needs a hand-patch, or that you should stop.
2. Hand-patch that file as its section below says, starting from `main`'s copy
   (`git show origin/main:src/data/<file> > src/data/<file>`).
3. Run the remaining steps in `refresh-data`'s order, skipping any whose file
   you patched: `bun run import-aa-evals`, `bun run import-frontiercode`,
   `bun run build-plans`. Run `build-plans` after every patch: it alone writes
   `plans.json` and `chart-benchmarks.json`, and those two are never edited by
   hand.
4. Write the summary yourself with
   `bun scripts/data-changes.ts origin/main --summary <file.md>`.
5. Pass every [sanity check](#sanity-checks).
6. Add a **Stale data** section to the summary before it becomes the PR body.
   Name each file you patched, the step that failed and its error line, and
   each row you kept because the source no longer shows it. The failure issue
   stays open: a hand-patched run counts as a failed run (README, step 2).
   Comment the same list on it, then carry on with steps 4 to 6 of the README
   flow. Step 7 does not apply.

Done when the checks pass, the PR body names every stale row, and the
failure issue has the run's comment.

### Hand-patching `benchmarks.json`

For each covered family, open its AA page and run the
[model page snippet](#aa-model-page). Then, for each row of that family:

- Change a value only when the page shows it differently, using the rounding in
  [Sources](#sources).
- Add a row for a variant AA now lists in a covered family. Copy a sibling
  row's slopalytics fields, then set `id` to AA's `slug` and set `effort`,
  `effortLabel` and `effortOrder` from another family's row at the same effort.
- Keep a row AA no longer shows, unchanged, and list it as stale.

Leave uncovered families alone. The importer prunes them, and `main`'s copy
already has the right set.

### Hand-patching `frontiercode.json`

Open `data.json` in the browser (snippet below). Update `score`,
`costPerTaskUsd` and `tokensPerTask` for covered families' rows, add rows for
covered families it newly lists, and keep the rows it dropped as stale.

## Browser recipes

Open each page with `preview_open` (`open: false`) in a tab of your own, read
it with `preview_evaluate`, and close the tab with `t3_preview_close` before
you move on.

### AA model page

`https://artificialanalysis.ai/models/<slug>`, where the slug is the family's
shortest catalog `id` (`qwen3-8-max-0902` lives at `/models/qwen3-8-max`).
The page embeds full records only for its own release's variants, AA's nine
default chart models and about twenty related ones, which is why every covered
family needs its own page. Records sit in the Next.js flight payload
(`self.__next_f`), not in the DOM:

```js
(() => {
  const flight = self.__next_f.filter((c) => c[0] === 1).map((c) => c[1]).join("");
  const out = [];
  for (const m of flight.matchAll(/\{"id":"[0-9a-f-]{36}","slug":"/g)) {
    let depth = 0, i = m.index, inStr = false;
    for (; i < flight.length; i++) {
      const ch = flight[i];
      if (inStr) { if (ch === "\\") i++; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true; else if (ch === "{") depth++; else if (ch === "}" && --depth === 0) break;
    }
    const r = JSON.parse(flight.slice(m.index, i + 1));
    if (!("intelligenceIndex" in r)) continue;
    out.push({
      slug: r.slug, name: r.name, release: r.release?.slug,
      effort: r.effort?.slug ?? (r.isReasoning ? null : "none"),
      releaseDate: r.releaseDate, index: r.intelligenceIndex,
      priceIn: r.price1mInputTokens, priceOut: r.price1mOutputTokens,
      costPerTask: r.intelligenceIndexCostPerTask?.cost?.total ?? null,
      tokensPerTask: r.intelligenceIndexOutputTokensPerTask?.output ?? null,
      secondsPerTask: r.intelligenceIndexTimePerTask ?? null,
      evals: {
        "aa-briefcase": r.briefcaseBreakdown?.overall?.elo,
        "automationbench-aa": r.automationBenchPartialScore,
        "terminalbench-4-0": r.terminalBench40,
        "frontiercode-2-0": r.frontierCode20,
        omniscience: r.omniscience,
        "gdp-pdf": r.gdpPdfAllPass,
        "hle-diamond": r.hleDiamond,
        "critpt-v2-hard": r.critptAgenticHard,
        "terminal-bench-science": r.terminalBenchScience,
      },
    });
  }
  return out.filter((r) => r.release === "FAMILY_ID");
})()
```

Match a record to our rows:

- `slug` is our `benchmarks.json` `id`, and `release` is our `family`.
  `qwen3-8-max-0902` is the exception: AA's release slug, which
  `aa-evals.json` files under `qwen3-8-max` (`FAMILY_ALIASES` in
  `src/domain/aa-evals.ts`).
- `effort` is `effort.slug` (`low` … `max`); `none` means the model does not
  reason. A null effort is a reasoning model with no named effort, which our
  rows file under `default` when that is the family's only reasoning row.
- AA's display name carries the effort: "GLM-5.3 (Max)",
  "Claude Opus 5.5 (Max, Default Fallback)". The slug ends in `-<effort>`,
  except at the family's default effort, where it is bare.

Likely to move: the field names (they replaced an `intelligenceIndexEvaluations`
array during the week of 2026-11-10), which models a page embeds, and the
`{"id":…,"slug":…` record opening. The flight payload itself has held through
several redesigns.

### slopalytics

The catalog is a literal in the site's JS bundle, not JSON. On
`https://slopalytics.com`:

```js
(async () => {
  const src = [...document.scripts].map((s) => s.src).find((s) => /\/assets\/index-[\w-]+\.js/.test(s));
  const js = await (await fetch(src)).text();
  const at = js.search(/=\{fetchedAt:/);
  const i = js.indexOf("id:`FAMILY_ID`", at);
  return { fetchedAt: js.slice(at, at + 60), row: js.slice(i, i + 600) };
})()
```

Fields are JS object syntax with template-string values (`` id:`glm-5-3` ``,
`open:!0` for true). `intelligence`, `cost`, `tokens` and `time` are the
names `benchmarks.json` calls `score`, `costPerTaskUsd`, `tokensPerTask` and
`secondsPerTask`. The frontier block starts at `{"gpt-6-astra":{tier:`.
slopalytics refreshes from AA itself and lags it (its `fetchedAt` read
2026-11-10 on 2026-11-17), so where the two disagree, AA wins.

### FrontierCode

Navigate straight to the JSON URL and run
`JSON.parse(document.body.innerText).data["<Cognition model name>"]`. It is
plain JSON and the most stable of the four sources.

## Sanity checks

Run these before committing, patched or not:

- `vp check`, `vp test run`, and `vp run doctor` (README, step 4). `src/data/data.test.ts` fails
  when `plans.json` or `chart-benchmarks.json` differs from what its schema
  outputs, which means someone edited it by hand: rerun `build-plans`.
- Parse each file you patched against its schema in one line, e.g.
  `bun -e 'import {Schema} from "effect"; import {AaEvalsDataset} from "./src/domain/model.ts"; Schema.decodeUnknownSync(AaEvalsDataset)(await Bun.file("src/data/aa-evals.json").json())'`.
- **Score moves.** The summary lists Intelligence Index and eval scores that
  moved by 0.1 points or more. An Intelligence Index move over 1.5 points, or
  any eval moving over 3 points, needs an AA regrade note: a changelog entry
  or a methodology page change you can link in the PR body. Without one, keep
  the old score and list it as stale. AA Briefcase is an Elo rating, and it
  drifts by 1 to 3 every run as models join, which is normal. FrontierCode 2.0
  scores are Cognition's to move.
- **Price swings.** AA's list price wins. A change that matches the lab's own
  pricing page is fine; link the page in the PR body when a price rises or falls
  by more than half. `import-benchmarks` warns about every price where
  slopalytics and AA disagree; that is routine while slopalytics lags.
- **Point counts.** `build-plans` prints its chart point counts. Compare them
  with `main`'s (`git show origin/main:src/data/chart-benchmarks.json`); a
  covered leaderboard losing points means a patch dropped rows.

## Failure modes

| Error | Meaning | Do |
| --- | --- | --- |
| `import-aa-evals`: `weighted tokens per task for <slug>` | The hard-coded eval weights or task counts no longer match AA's index. | Re-derive them from AA's Intelligence Index methodology page, update `src/domain/aa-eval-index.ts`, and open an issue. |
| `import-aa-evals`: `weighted costs for <slug>`, `unknown eval` | The set of evals in AA's index changed. | Add or remove the eval in `aa-eval-index.ts`, `AA_EVAL_IDS` and the schema; that is a code change, so open an issue. |
| `import-aa-evals`: `output speed for <slug> is not usable` | AA's index output tokens or time for that model are out of range. | Keep `aa-evals.json` as `main` has it and open an issue with the model's `intelligenceIndexOutputTokensPerTask` and `intelligenceIndexTimePerTask`. |
| `import-aa-evals`: `no fresh cost`, `no fresh tokens` | AA moved the cost or token counts off its pages again (the #83 failure). | Open an issue with the page URL; keep `aa-evals.json` as `main` has it and list it as stale. |
| `AA has no model for <id>` | A covered point is on no fetched AA page: AA renamed the slug, retired the model, or stopped embedding it. Until 2026-11-17 uncovered models raised this too (`a-x-k2`, #83); those are now skipped and logged. | Look for it on its family page; hand-patch `benchmarks.json` and list it as stale. |
| `AA's pages disagree on <slug>` | Two pages, model or eval, carry different records for one model, usually mid-deploy. | Rerun once; if it repeats, hand-patch from the family's own page (for `import-aa-evals`, keep `aa-evals.json` as `main` has it). |
| `AA index X, slopalytics Y` | The two sources score a point differently. | With an AA regrade note, rerun with `--allow-score-drift`; otherwise hand-patch, keep the old score, list it as stale. |
| `lists … with no cost data` | A newly covered AA model has no cost on either source. | Rerun with `--allow-missing-cost`; the cost chart leaves it out until a source costs it. |
| `No model records in the page`, `No flight chunks found in page`, `not valid JSON`, zod errors | AA changed its page layout, on a model page or an eval page. | From `import-benchmarks`: hand-patch `benchmarks.json` from the browser. From `import-aa-evals`: keep `aa-evals.json` as `main` has it (the run writes nothing). Either way, open an issue (`docs/agents/issue-tracker.md`) with the error and the command you ran. |
| `HTTP 404` from `/models/<slug>`, or a 404 or redirect (3xx) from `/evaluations/<page>` | A family's or eval's page slug changed. | Find the page from AA's search; for an eval page, fix the eval page slug in `AA_EVAL_INDEX` (`page` in `aa-eval-index.ts`). Otherwise hand-patch, and open an issue naming the old and new slug. |
| `HTTP 403`/`429`/5xx, any other non-200 from `/evaluations/<page>` but a 404 or 3xx, timeouts | AA or Cognition is blocking or down. | Rerun once; if it repeats, hand-patch from the browser (for `import-aa-evals`, keep `aa-evals.json` as `main` has it) and open an issue. |
| `build-plans`: `No catalog model for <family>@<effort>` | An `aa-evals.json` row names a point `benchmarks.json` lacks, e.g. `import-benchmarks` dropped a variant after `import-aa-evals` failed and left `main`'s file. | Rerun `import-aa-evals` if it can now run. If it still fails, delete that point's rows (`family`, `effort`) from `aa-evals.json` and name them in the PR's **Stale data** section, then rerun `build-plans`. |
| `build-plans`: promotion ended | A plan's promotion is past its end date. | Code change: open an issue, and stop before pushing. |

Anything else that only a code change can fix: hand-patch what you can, open
an issue with the error, and still ship the PR with the stale rows listed.
