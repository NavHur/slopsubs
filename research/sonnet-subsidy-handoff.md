# Hand-off: measure Sonnet 5.5's subsidy on Claude Ultra

Written 2026-11-10 on a fleet host that has only its own Claude Code logs.
Continue on a machine that can read every host's logs and the homebox gateway.

## The question

On Claude Ultra ($200/month, plan id `claude-max-20x`), how many API-priced
dollars of Sonnet 5.5 fill the weekly gauge, compared with Opus 5.5? Call the
answer **k**: the Sonnet API dollars that use as much of the "all models" gauge
as one Opus API dollar. Two decisions depend on it:

- Our model choice. The live case is Sonnet 5.5 High against Opus 5.5 Low or
  Medium.
- The slopsubs value chart, which currently assumes k = 1 for every family.

## What is already known

### Theo's chart (screenshot Pedro shared; no URL recorded)

One Ultra account, API list prices, 1.1M proxied requests from Aug 11 to
Nov 9, 2026. One month is 30 days, or 4.29 weekly limits.

| Use | Month at API prices |
|---|---|
| Opus 5.5 only | $14,662 (73x the $200); one week is $3,421 |
| Fable 5.2 first, then Opus 5.5 | $3,021 + $7,331 = $10,353 |
| Fable 5.1 first, then Opus 5.5 | $2,197 + $7,331 = $9,528 |
| Fable 5.2 only | $3,021 |
| Fable 5.1 only | $2,197 |

What follows from it:

- Fable counts against the all-models gauge. After the Fable cap, Opus gets
  exactly half the month ($7,331 = $14,662 / 2).
- Fable 5.2 fills its 50% cap with $705 a week, so a full gauge would take
  about $1,410. Each Fable 5.2 API dollar costs **2.43x** the gauge of an Opus
  dollar. Fable 5.1: **3.34x**.
- The chart says nothing about Sonnet.

### Sonnet has its own weekly bar

From the Claude Code 2.1.322 binary (`strings`, not documented):

- On Max and Ultra, `/usage` shows "Current week (all models)" (`seven_day`),
  "Current week (Sonnet only)" (`seven_day_sonnet`), and one model-scoped bar
  per capped model ("Fable", from `model_scoped[]`).
- The rate-limit messages name a "Sonnet limit" and an "Opus limit" as
  separate from the "weekly limit".
- The statusline command receives a `rate_limits` object:
  `five_hour`, `seven_day`, `seven_day_oauth_apps`, `seven_day_opus`,
  `seven_day_sonnet` (each `{utilization: 0-100 | null, resets_at: ISO | null}`)
  and `model_scoped: [{display_name, utilization, resets_at}]`. The schema says
  `model_scoped` is absent when the answer came from cached data.
- Responses carry `anthropic-ratelimit-unified-<window>-utilization`,
  `-reset`, `-status` and `-surpassed-threshold` headers, where `<window>` is
  templated (`5h` and `7d` appear literally), plus
  `anthropic-ratelimit-unified-representative-claim`, which can be
  `seven_day_sonnet`. The exact window names for Sonnet and Fable are not
  confirmed; dump real response headers to find them.

Still unknown: whether Sonnet usage also moves the all-models gauge, how big
the Sonnet bucket is, and k.

### Our own usage

On the host that wrote this, over the 30 days to 2026-11-10
(`transcripts usage --since 30d --agent claude --by model`):

| Model | Sessions | API cost |
|---|---|---|
| claude-opus-5-5 | 708 | $1,094 |
| claude-sonnet-5-5 | 363 | $403 |
| claude-haiku-5-5 | 27 | $3 |

That is one host. Sonnet is about 27% of its spend, so mixed windows will
carry enough Sonnet to fit.

## Why it matters: the k thresholds

Per-task cost and score from `src/data/benchmarks.json` (Artificial Analysis,
list prices of $2/$10 per million tokens for Sonnet and $4/$20 for Opus):

| Variant | Score | API $/task |
|---|---|---|
| Opus 5.5 Low | 34.75 | $0.976 |
| Sonnet 5.5 High | 41.52 | $1.636 |
| Opus 5.5 Medium | 48.21 | $2.451 |

On the subscription, a task's cost is its API dollars divided by its family's
rate, so:

- **k ≥ 1.68**: Sonnet High uses less gauge per task than Opus Low and scores
  7 points higher. Sonnet High wins.
- **0.67 ≤ k < 1.68**: a trade. Sonnet High costs more gauge than Opus Low,
  for +7 points.
- **k < 0.67**: Opus Medium costs less gauge than Sonnet High and scores more.
  Sonnet High is dominated.
- **Sonnet does not move the all-models gauge**: Sonnet is extra capacity on
  top of the Opus month. Use it first for anything it can do, whatever k is.

## The setup this machine could not see

- Every host's Claude Code reaches Anthropic through CLIProxyAPI on homebox
  (`ANTHROPIC_BASE_URL`, Tailscale tcp:8317). Fleet's
  `docs/cliproxyapi-gateway.md` describes it. The account's OAuth lives in the
  gateway's `~/.cli-proxy-api`. On this host,
  `https://api.anthropic.com/api/oauth/usage` with
  `~/.claude/.credentials.json` returned 401, so the local token is stale or
  unused. Do not refresh it; read the gauge where the gateway's token lives.
- Hosts that spend the account: devbox, homebox, mac, workbox (fleet
  `hosts/`). Claude Code logs are in `~/.claude/projects` on each, and fleet
  keeps them ten years (`cleanupPeriodDays`).
- claude.ai web, desktop and mobile chats draw the same pool and leave no
  Claude Code log. A window with chat use undercounts.
- Check whether the gateway pools more than one account. If it does, every
  window has to be split per account.

## slopsubs today

- `scripts/measure.ts` and `scripts/claude-usage.ts` price the Claude Code
  logs between two `/usage` readings ("marks") and split the cost by model
  family into `apiUsdByFamily`. `measurements/marks.jsonl` is empty and
  `src/data/samples.json` is `[]`, so no measured sample exists.
- A mark stores one `usedPercent`, the all-models gauge. It cannot see the
  Sonnet or Fable bars.
- `planCapacity` in `src/domain/value.ts` pools every family's dollars into one
  dollars-per-percent figure. A mixed window would yield a blend, not k.
- `valueMultiple`'s doc comment says a capped family "spends the gauge at the
  same rate per API dollar". Theo's Fable numbers contradict that.
- Ultra's cap comes from `reportedCap` in `scripts/build-plans.ts`: Theo's flat
  60x from 2026-11-02, $12,000 a month, $2,769 a week, for every Claude
  family. The newer chart puts Opus at 73x ($14,662 a month).

## Plan

1. **Find the source of truth for the gauge.** On homebox, read the gateway's
   upstream response headers (or call `api/oauth/usage` with the gateway's
   token) and record the exact names and values for the all-models, Sonnet and
   Fable windows. Note the granularity: if utilization is a whole percent,
   1% of the all-models gauge is about $34 of Opus, so each window needs to
   move the gauge 10 points or more to keep rounding under 10%.
2. **Run single-family windows first.** They are the cheapest clear answer.
   With other hosts and claude.ai idle, run Sonnet only until the all-models
   gauge moves about 10 points (or the Sonnet bar moves and all-models does
   not), then the same for Opus. Two or three of each give k and show whether
   Sonnet touches all-models.
3. **Record marks automatically.** Read the gauge on every response at the
   gateway, or from a statusline command on each host (fleet's
   `config/claude-settings.json` is synced to every host by `bin/sync`; no
   host sets `statusLine` today). Keep every bucket, not one percentage.
4. **Extend slopsubs.** `Mark` and `LimitSample` store per-bucket readings.
   `measure build` reads logs from every host (`--claude-dir` per host).
   Capacity becomes per family: fit, by non-negative least squares over the
   windows, `Δall = Σ_f usd_f × r_f` and `Δsonnet = usd_sonnet × r_s`, where
   each `r` is gauge percent per API dollar. Then k = r_opus / r_sonnet
   (all-models). Replace the pooled `planCapacity`, and correct
   `valueMultiple` and its comment.
5. **Update the chart.** Until enough samples exist, consider putting Theo's
   newer per-family figures (Opus 73x, Fable at 2.43x Opus's rate) in place of
   the flat 60x, labeled as reported.
6. **Answer the model choice.** Put k against the thresholds above, and
   record the result with its samples.

## Pitfalls

- A window counts only if every host's logs for it are present. A missing
  host makes the cap look larger.
- Haiku also drains the gauge. Keep it as its own family in the fit.
- Marks taken across a weekly reset are invalid. `windows()` in
  `measure.ts` already pairs only marks with the same `resetsAt`.
- Behind the gateway, the statusline's `rate_limits` may be empty if the
  gateway strips the headers. Check before building on it.
