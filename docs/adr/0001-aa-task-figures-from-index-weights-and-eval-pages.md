# Read AA task figures from index weights and eval pages, carrying forward the gaps

In November 2026 Artificial Analysis (AA) removed per-eval cost, tokens and time from its model pages, so `import-aa-evals` failed on every run (#83). AA's eval pages chart those figures, but they embed records only for the roughly 28 models each chart selects by default (24 of our 142 variants), and the rendered labels are rounded.

We decided:

- Cost per task comes from the model page. Its `intelligenceIndexCostPerTask.evaluations[].weightedCostPerTask`, divided by the eval's Intelligence Index weight, gives the exact cost for every variant. This reproduced every committed cost that was not hand-patched, to 5 decimals.
- Tokens per task come from the eval pages' exact token totals, divided by each eval's task count.
- Time per task is those tokens divided by the model's output speed, with no tool time. That matches all earlier data.
- Wherever AA publishes no figure, the importer carries forward the last value in `aa-evals.json`. The run still counts as a success.

AA publishes neither the eval weights nor the task counts as data, so both are hard-coded. Each run checks them against figures AA does publish:

- The weighted costs must sum to `cost.total`.
- The weighted per-eval output tokens must sum to the index output tokens per task.

The step fails loudly if a check fails, if an eval page doesn't load, or if a run reads no fresh cost or no fresh tokens at all.

## Considered options

- **Scrape rounded chart labels.** Rejected: the values are inexact, and the charts cover only the default models.
- **Use AA's API.** Rejected: it needs a key, and its free tier's fields are unverified.
- **Write null for missing figures.** Rejected: most variants would drop out of the trade-off chart.
- **Keep failing on any gap.** Rejected: given eval-page coverage, every run would fail.
- **Derive cost from token counts and prices.** Rejected: cached evals depend on a per-eval cache-hit rate that AA doesn't expose, which put the result 2–5% off.

## Consequences

Tokens and time for variants outside AA's chart defaults keep the value from the last run that saw them, while their cost and score stay fresh. The cost sum check confirms the set of evals; it cannot catch a reweight, because AA computes the weighted costs itself. The token check catches one, because it uses our hard-coded weights. It can only run on variants that appear on the eval pages, so it needs at least one such variant per run. When it fails, re-derive the weights and task counts from AA's methodology page.
