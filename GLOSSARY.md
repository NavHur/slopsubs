# Glossary

**Model family**: A model as people name it (for example Claude Opus 5.5), covering all of its reasoning efforts. Plans list the families they serve.

**Plan**: A paid subscription tier, such as Claude Max 20x, that serves a set of model families up to a usage cap.

**Checked plan**: A plan the visitor has ticked in the plan list. There can be none, one, or many.

**Plan line**: The cost-against-score line a checked plan draws for one model family, at that plan's effective cost per task. A plan draws no line for a family it lists if its cap for that family is unmeasured, or if none of the efforts it serves are shown.

**API line**: The cost-against-score line a model family draws at pay-per-token list prices. It is the baseline every value multiple is measured against.

**Pay per token**: Buying model use at API list prices instead of through a plan. In the UI, the toggle that shows API lines.

**Plan-covered family**: A model family that at least one checked plan draws a plan line for. API lines appear only for plan-covered families, so every API line has a plan line to compare against.

**Promotion**: A limited-time offer on one model family in a plan, with a known end date. It either discounts the family's token prices or raises its monthly usage outright. A plan's value counts a promotion while it runs, and a caveat tells the visitor it is temporary. A promotion never ends on its own: once its end date passes, someone confirms the family's new allowance and removes it by hand.

**Eval**: One of the Artificial Analysis benchmarks that make up its Intelligence Index, such as AA-Briefcase or Terminal-Bench 4.1. Each model at one effort gets a score per eval.
_Avoid_: Benchmark (that word also covers the Intelligence Index itself and FrontierCode)

**Task figures**: The cost, output tokens and time a model at one effort spends on one task of an eval. Cost is in US dollars, and time excludes tool execution.
_Avoid_: Per-eval stats, chart values

**Carried-forward figure**: A task figure that Artificial Analysis did not publish on this refresh, so the last value read is kept. It is normal, not stale: stale data comes only from a refresh step that failed.
_Avoid_: Stale figure
