# DeepSeek V4.1 Flash 1017: published benchmark scores (accessed 2026-10-31)

DeepSeek released V4.1 Flash 1017 on 2026-10-17. It replaced V4.1 Flash behind the `deepseek-flash` API name at the same price, and its weights are MIT-licensed on Hugging Face ([DeepSeek change log](https://api-docs.deepseek.com/updates/), [release note](https://api-docs.deepseek.com/news/news261017), [HF card](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017)). "Self-reported" below means DeepSeek's own numbers; "independent" means the benchmark owner or a third-party evaluator ran the model.

## Summary table

| Benchmark | Variant | Score | Source | Kind |
|---|---|---|---|---|
| AA Intelligence Index v5.0 | max | 32 (#1 open weights, tied with GLM-5.3), $0.60/task | [AA model page](https://artificialanalysis.ai/models/deepseek-v4-1-flash-1017), [AA v5 article](https://artificialanalysis.ai/articles/artificial-analysis-intelligence-index-v5) | independent |
| AA Intelligence Index v5.0 | non-reasoning (`none`) | 19 | [AA release group](https://artificialanalysis.ai/models/releases/deepseek-v4-1-flash-1017), [AA changelog](https://artificialanalysis.ai/changelog) | independent |
| AA Intelligence Index v4.3.2 (superseded) | max | 45, $0.26/task | [AA tweet, 2026-10-19](https://x.com/ArtificialAnlys/status/2112218661432000694) | independent |
| AA FrontierCode 2.0 (v5) | max | 28% | [AA v5 article](https://artificialanalysis.ai/articles/artificial-analysis-intelligence-index-v5) | independent |
| AA Terminal-Bench-Science 0.1 (v5) | max | 13% (AA article); 12.9 (HF eval sidebar, attributed to AA) | [AA v5 article](https://artificialanalysis.ai/articles/artificial-analysis-intelligence-index-v5), [HF card](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017) | independent |
| GDPval-AA v2.1 (v4.3.2) | max | Elo 1746 (V4.1 Flash: 1600); chart 62% = (Elo-500)/2000 | [AA tweet](https://x.com/ArtificialAnlys/status/2112218661432000694), [full-results chart](https://x.com/ArtificialAnlys/status/2112218671901004164) | independent |
| AA-Briefcase v1.1 (v4.3.2) | max | Elo 1570 (from 1420); chart 54% | same | independent |
| CritPt (v4.3.2) | max | 24% (from 14%) | same | independent |
| AA-Omniscience (v4.3.2) | max | index +5 (from -5); non-hallucination 33% (from 4%); accuracy: tweet says 46% (from 43%), chart shows 43% (predecessor 46%) | same | independent |
| Humanity's Last Exam (AA, v4.3.2) | max | 43% (V4.1 Flash 39%) | [full-results chart](https://x.com/ArtificialAnlys/status/2112218671901004164) | independent |
| Terminal-Bench 4.0 (AA, v4.3.2) | max | 34% (V4.1 Flash 27%) | same | independent |
| AutomationBench-AA (v4.3.2) | max | 67% (V4.1 Flash 69%) | same | independent |
| GDP.pdf (v4.3.2) | max | 17% (V4.1 Flash 13%) | same | independent |
| SciCode (v4.3.2) | max | 56% (V4.1 Flash 52%) | same | independent |
| AA-LCR v1.1 (v4.3.2) | max | 83% (V4.1 Flash 84%) | same | independent |
| AA Cyber Index | max | 57% (#1 publicly available), $0.42/task; CWE-Bench-AA 69%, DeepsecBench-AA 25%, CyberGym-E2E-AA 76% | [AA tweet, 2026-10-23](https://x.com/ArtificialAnlys/status/2113682654709313811) | independent |
| ARC-AGI-2 (ARC Prize Verified) | max / high / low / none | 78.1% / 68.6% / 73.6% / 2.1% | [ARC Prize](https://arcprize.org/results/deepseek-v4-1-flash-1017) | independent |
| ARC-AGI-1 (ARC Prize Verified) | max / high / low / none | 93.5% / 94.5% / 91.5% / 5.7% | same | independent |
| Code Arena: WebDev | max | 1670, #12 overall, #1 open (+52 vs 20260910) | [Arena tweet, 2026-10-18](https://x.com/arena/status/2111894091168682086), [Arena changelog](https://arena.ai/company/leaderboard-changelog) | independent |
| Agent Arena | max | #11 overall, #1 open, +5.1% net over 7.5K sessions, $0.20 median/task | [Arena tweet, 2026-10-19](https://x.com/arena/status/2112247114944360666) | independent |
| Vals Index | max | 61.26% ±1.05 (10/32), $0.657/test | [Vals model page](https://www.vals.ai/models/deepseek_deepseek-v4.1-flash-1017) | independent |
| Terminal-Bench 4.0 (Vals) | max | 31.82% ±2.62 (21/59) | same | independent |
| Other Vals evals | max | Finance Index 60.89%, Legal Index 71.86%, Code Migration v1.1 67.52%, EMB v1.1 69.17%, Finance Agent v2.1 62.93%, Legal Research Bench 45.19%, Tax Agent Bench 44.35%, Vibe Code Bench v1.1 87.73%, HLAB-Vals-1.1 14.17% | same | independent |
| HLE, no tools | not stated | 42.6 (text-only 44.0) | [DeepSeek table image](https://api-docs.deepseek.com/img/v4.1_261017_benchmark_table_en.png), [HF card](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017) | self-reported |
| Terminal-Bench 4.0 (Claude Code harness) | not stated | 42.3 | same | self-reported |
| DeepSWE v1.1 (mini-swe-v2 harness) | max / high / low | 77.0% at about $0.20/task; about 73% at about $0.15; about 72.5% at about $0.11 (low and high read off the chart) | [DeepSeek perf/cost chart](https://api-docs.deepseek.com/img/v4.1_261017_perf_cost_en.png) | self-reported |
| ProgramBench | not stated | 29.1 | [DeepSeek table image](https://api-docs.deepseek.com/img/v4.1_261017_benchmark_table_en.png) | self-reported |
| NL2Repo-Bench | not stated | 68.2 | same | self-reported |
| Automation-Bench v1.0.6 | not stated | 60.5 | same | self-reported |
| Agents' Last Exam | not stated | 35.4 | same | self-reported |
| Apex Bench v1.1 | not stated | 72.1 | same | self-reported |
| Chartography (with tools) | not stated | 83.0 | same | self-reported |
| BabyVision (with tools) | not stated | 92.5 | same | self-reported |
| ZeroBench-main (with tools, pass@5) | not stated | 51.0 | same | self-reported |

## Notes on the sources

- **DeepSeek's own table** compares 1017 with V4.1 Flash, Kimi K3, GLM-5.3, GPT-5.6 Sol and Claude Opus 5, and doesn't say which effort level was used. Its notes say only that Terminal-Bench 4.0 ran in Claude Code, DeepSWE in Mini-SWE-V2, and ZeroBench-main as pass@5 ([table image](https://api-docs.deepseek.com/img/v4.1_261017_benchmark_table_en.png)). Earlier DeepSeek change log entries (2026-07-31, 2026-08-21) say their benchmarks were run "with the max effort level" ([change log](https://api-docs.deepseek.com/updates/)), so max is likely but not stated for 1017. The DeepSWE chart is the only place DeepSeek gives per-effort numbers.
- **Terminal-Bench 4.0 has three different numbers:** DeepSeek's 42.3 (Claude Code harness), AA's 34% at max (v4.3.2 chart), and Vals' 31.82% (avg@3). The harness and run averaging differ, so treat them as different measurements.
- **AA-Omniscience accuracy:** the tweet text says 43% → 46%, but in the full-results chart the highlighted 1017 bar reads 43% and the V4.1 Flash bar 46% ([chart](https://x.com/ArtificialAnlys/status/2112218671901004164)). The index (+5 from -5) and non-hallucination (33%) figures agree between tweet and chart. I couldn't tell which of the two accuracy figures is right.
- **Parameter count:** AA gives 552B total / 16B active ([AA tweet](https://x.com/ArtificialAnlys/status/2112218661432000694)), but the HF page shows 763B ([HF card](https://huggingface.co/deepseek-ai/DeepSeek-V4.1-Flash-1017)). The HF figure probably counts all stored tensors (for example MTP or vision weights), but this is unverified.
- The per-eval percentages labelled v4.3.2 in the table were read off AA's full-results image attached to the [2026-10-19 thread](https://x.com/ArtificialAnlys/status/2112218671901004164), which is headed "Artificial Analysis Intelligence Index v4.3.2 evaluations". The live AA model page names its v5.0 evaluations but shows no per-eval numbers in the fetched HTML ([AA model page](https://artificialanalysis.ai/models/deepseek-v4-1-flash-1017)). The GDPval 62% bar matches Elo 1746 under the chart's (Elo-500)/2000 scale.

## Why AA shows 45 in the tweets and 32 on the page

- **Different index versions.** The launch tweet on 2026-10-19 scored the max variant at 45 on Intelligence Index v4.3.2, with a cost of $0.26 per task ([tweet](https://x.com/ArtificialAnlys/status/2112218661432000694), [thread](https://x.com/ArtificialAnlys/status/2112218671901004164)). AA released Intelligence Index v5 on 2026-10-27 ([article](https://artificialanalysis.ai/articles/artificial-analysis-intelligence-index-v5), [changelog](https://artificialanalysis.ai/changelog)). The model page now reports v5.0 ([AA model page](https://artificialanalysis.ai/models/deepseek-v4-1-flash-1017)).
- **v5 changed the benchmark mix.** It added FrontierCode 2.0 and Terminal-Bench-Science, replaced HLE with HLE-Diamond, and replaced Omniscience v1 with v1.1 and CritPt with the CritPt v2 hard subset. It dropped GDPval-AA v2.1, SciCode and AA-LCR v1.1, and reweighted the index to four categories of 25% each ([article](https://artificialanalysis.ai/articles/artificial-analysis-intelligence-index-v5)). Several of the evals 1017 did well on under v4.3.2 (GDPval, SciCode, LCR) are no longer in the index.
- **The v5 article confirms 32 for the same model and variant:** "Among released weights, DeepSeek V4.1 Flash 1017 (max) and GLM-5.3 (max) lead at 32" ([article](https://artificialanalysis.ai/articles/artificial-analysis-intelligence-index-v5)). So the drop from 45 to 32 is a rescaling, not a regression. GLM-5.3 was tied with 1017 at 45 under v4.3.2 and is tied with it at 32 under v5.
- **Cost per task rose from $0.26 to $0.60 for the same reason.** AA says every model it measured produces more output tokens per task in v5, with the median going from 35k to 59k ([article](https://artificialanalysis.ai/articles/artificial-analysis-intelligence-index-v5)). 1017 (max) now produces about 139K output tokens per task, against roughly 89K under v4.3.2; the model page's figure matches slopalytics' 138,962. The page's 170M is the whole index run, not a per-task figure.
- **Open point:** AA doesn't state anywhere that v4.x and v5 scores are not comparable. It points to its new Progress Index for comparisons across time ([article](https://artificialanalysis.ai/articles/artificial-analysis-intelligence-index-v5)). The AA changelog entry dated 2026-10-18 currently displays "Intelligence Index: 32", even though v5 didn't exist yet ([changelog](https://artificialanalysis.ai/changelog)). That looks like the changelog showing the current index value rather than the value at posting time, but I couldn't confirm it.

## Effort levels the API accepts

- **Chat Completions `reasoning_effort`** accepts `none`, `low`, `high` and `max`, and defaults to `high`. `none` turns thinking off; the other three turn it on. `minimal` is mapped to `low`, and `medium` and `xhigh` are mapped to `high`. If you send a `thinking: {type: enabled|disabled}` object, it overrides `reasoning_effort` on whether thinking is on. Default `max_tokens` is 8K without thinking, 64K with thinking and 128K at `max`, up to a ceiling of 384K ([API reference](https://api-docs.deepseek.com/api/create-chat-completion/)).
- **The Responses API** uses `reasoning.effort` with the same values ([change log](https://api-docs.deepseek.com/updates/)). DeepSeek added the three thinking levels on 2026-08-13. It suggests `low` for simple tasks, `high` for everyday agent work and `max` for complex cases ([change log](https://api-docs.deepseek.com/updates/)).
- **So there are four real settings: none, low, high and max.** OpenCode's low/high/max variants correspond to the three thinking levels. A request for "medium" or "xhigh" silently runs at `high`.
- **Who has benchmarked which level:** AA covers max and none. ARC Prize covers all four. DeepSeek's own DeepSWE chart covers low, high and max. Vals and Arena ran max only.

## Not listed (checked 2026-10-31)

- **SWE-bench Verified, Bash Only and other tabs:** no 1017 entry. The newest DeepSeek entry in the page data is V3.2 ([swebench.com](https://www.swebench.com/)).
- **SWE-bench Pro (Scale):** no 1017 entry. The only DeepSeek entry is V3.2 ([Scale](https://scale.com/leaderboard/swe_bench_pro_public)).
- **Aider polyglot:** no 1017 entry. The newest is DeepSeek-V3.2-Exp ([Aider](https://aider.chat/docs/leaderboards/)).
- **SimpleBench:** no 1017 entry. Its data lists V4.1 Flash and older, and its latest `dateAdded` is 2026-10-01 ([SimpleBench](https://simple-bench.com/)).
- **LiveCodeBench:** no 1017 entry. The newest DeepSeek entry is R1-0528 ([LiveCodeBench](https://livecodebench.github.io/leaderboard.html)).
- **Terminal-Bench 4.0 official leaderboard:** no 1017 entry in the static page ([tbench.ai](https://www.tbench.ai/leaderboard/terminal-bench/4.0)). The table renders client-side, so this is not conclusive.
- **Arena Text and Vision:** the changelog adds 20261017 only to Code Arena: WebDev and Agent Arena. Text (2026-09-25) and Vision (2026-10-09) have only the older `deepseek-v4.1-flash-max` ([Arena changelog](https://arena.ai/company/leaderboard-changelog)).
- **ARC-AGI-3:** ARC Prize lists no 1017 score ([ARC Prize](https://arcprize.org/results/deepseek-v4-1-flash-1017)).
- **LiveBench:** I couldn't check it, because the page renders client-side ([livebench.ai](https://livebench.ai/)). A web search snippet claims 72.9 overall, but I couldn't confirm it from the primary source.
- **GPQA and IFBench:** not part of AA's v4.3.2 or v5 index, and AA shows no 1017 score for either.

## Unverified or excluded

- **Excluded, unconfirmed secondary claims:** LiveBench 72.9, BenchLM 65.22/100, an AI IQ "IQ 128", an older Vals Index 56.58%, and an ARC Prize CVE-rediscovery figure of 87.5%.
- **Excluded, individual X posts:** Paweł Huryn's private-repo bug-fix tests ([post](https://x.com/PawelHuryn/status/2111730046691836064)).
- **ARC Prize details:** the results page doesn't name the dataset for each row or give costs. The "Semi-Private" label applies to its stated best scores (94.5% v1 at high, 78.1% v2 at max).
