# Coding subscription plans: caveats (accessed 2026-11-06)

The data is in `plans/`, one JSON file per vendor. Each row has a source URL, an access date and a confidence level (`primary`, `secondary` or `unverified`). It also records how the allowance works (`allowanceKind`: `credit` or `rate-window`) and whether the plan is still sold (`availability`: `on-sale`, `closed` to new customers, or `discontinued`). Only plans on sale ship. Prices are in USD and exclude tax.

## Market changes in the last month

- **Cursor and xAI merged their plans.** Since 2026-10-12, cursor.com/pricing sells "The X Subscription": Plus $8, Premium $30, Super $100 and Ultra $200. All four share one weekly AI usage pool across Cursor and Grok. That pool covers Grok models only, and third-party models (Claude, GPT, Gemini) are billed at API list price. New customers can no longer buy Cursor Pro, Pro+ or Ultra, or standalone SuperGrok. The legacy rows are kept and labelled as closed.
- **OpenAI Pro changed on 2026-09-29, then partly reverted.** Pro is now $100, $200 or $500, and Pro 500 adds Ultrafast. The $200 tier reopened with a smaller allowance, but on 2026-10-29 OpenAI cancelled the cut: every Pro 200 subscription now has the old allowance, and Pro 100 and Pro 500 doubled their Work and Codex allowance. Plus is unchanged. OpenAI publishes no multiplier; the "5x Plus" figure for Pro 100 comes from the April launch, before the doubling.
- **Google retired Gemini CLI for consumer plans on 2026-06-18.** AI Pro and Ultra now cover Antigravity and Antigravity CLI. The Gemini CLI quota page still lists the old per-day numbers, which are stale.
- **GitHub Copilot became credit-based on 2026-06-01.** 1 credit is $0.01. Plans include base plus "flex" credits worth 1.5x to 2x the price. New signups for Pro, Pro+ and Max were paused in April and reopened gradually from 2026-06-17.
- **Z.ai GLM Coding Plan moved from prompt counts to credits on 2026-07-30.** Pro and Max prices are secondary only, because the subscribe page renders prices client-side.
- **MiniMax replaced Token Plan with M Plan (Go, Explore, Build).**
- **Anthropic renamed Max 5x to Max and Max 20x to Ultra on 2026-10-30.** Ultra drops the 5-hour limit for verified accounts. The pricing page now states weekly multiples (Max 5x Pro, Ultra 10x Pro); reports say weekly limits did not change.
- **Chutes stopped selling monthly plans.** Existing Plus and Pro subscriptions run to the end of their billing period, then fall back to pay-as-you-go. The rows are kept and labelled as discontinued.

## Limits are not comparable across vendors

- **Rate-window plans** have a 5-hour window plus a weekly cap: Claude (Ultra weekly only, once verified), ChatGPT Plus, Google, Z.ai, MiniMax, Alibaba, Volcengine, Kimi (5-hour only) and OpenCode Go. Vendors publish multipliers or message estimates, not tokens. The exceptions are Z.ai credits, Alibaba request counts and OpenCode per-model numbers.
- **Credit plans** pay a fixed dollar amount of usage at list rates. Copilot gives about 1.5x to 2x its price, Ollama 3x, JetBrains and Warp about 1x, and MiMo has a monthly credit quota. Their "subscription value" over the API is roughly the credit ratio, so the site should model them separately from rate-window plans.
- **Claude's cap differs by model.** Theo measured one Ultra account from 1.1M proxied requests, Aug 11 to Nov 9, 2026 ([post](https://x.com/theo/status/2119960608816988596), [chart copy](theo-claude-ultra-2026-11.png)). A week of only Opus 5.5 is worth $3,421 at API prices. Fable is held to half of each week, and a 30-day month of only Fable 5.2 is worth $3,021 (Fable 5.1: $2,197). So a full gauge holds about $1,410 of Fable 5.2, and Fable fills it 2.4x faster per API dollar than Opus. He didn't measure Sonnet or Haiku, so the site gives them Opus's rate. Max and Pro are scaled from Ultra by the pricing page's multiples: Max is 5x Pro and Ultra is 10x Pro.
- **Muse Code's cap, from our gauge readings.** Meta publishes only Everyday's "10-50 prompts every 5 hours" and the multiples above it (High 5x, Power 20x, Maximum 80x), so the site reads Everyday's gauge itself. On 2026-11-16 we ran one prompt (about 39K input tokens, a few hundred output) at `high` effort with contributor mode on, and read `muse usage` after each run. Wonder: 2 runs used 6% of the 5-hour window. Spark 1.3: 5 runs used 1%. Ember: 10 runs used 3%. At list price ($0.16, $0.05 and $0.004 a run), a full window holds about $5 of Wonder, $25 of Spark and $1.30 of Ember. The weekly gauge rose a third as fast as the window, both in these runs and in two Wonder review sessions (30% of the window, 10% of the week each), so a week is three windows: $16, $75 and $4 on Everyday. The gauge tracks the price each model is billed at, so the contributor toggle stretches Spark about 10x and Wonder 3x; Ember has no contributor variant. The gauge shows whole percents, so read these within about ±30%. Wonder Full (Power and Maximum) isn't sold on the API and has no list price, so the site leaves it off.
- **Bundled API credits:** Claude Max includes $100 and Ultra $200 a month of Claude Platform API credits. Google Ultra includes Google Cloud credits. Count these in value calculations.

## Third-party harness use (`thirdPartyHarnessAllowed`)

- **Allowed:**
  - **OpenAI:** "Sign in with ChatGPT" officially lets Plus and Pro power OpenCode, Pi, OpenClaw, T3, Amp, Kilo, Warp and others, with per-app weekly caps.
  - **Copilot:** OpenCode is officially supported.
  - **Kimi** (but don't spoof the User-Agent).
  - **MiniMax and MiMo.**
  - **Alibaba**, for interactive use only.
  - **OpenCode Go, Ollama, Synthetic and Chutes (discontinued).**
- **Forbidden:**
  - **Anthropic:** subscription OAuth is only for Claude Code and native apps, and third parties may not route requests through Free, Pro, Max or Ultra credentials.
  - **Google:** marked false on the basis of reported Feb 2026 account suspensions for routing Antigravity OAuth through OpenCode or OpenClaw. I didn't find an explicit ToS clause.
  - **Cursor (legacy), Devin, Factory, JetBrains and Warp:** quotas only work inside the vendor's own product.
- **Unclear:**
  - **Z.ai and Volcengine:** use is limited to a vendor-listed set of tools. Claude Code, Codex and OpenCode are on the list; anything else is forbidden.
  - **X Subscription:** its Grok API access is billed separately from the pool.

## Unverified or open items

- No annual price could be verified for ChatGPT or Copilot, and Google's $99 a year is user-reported and unverified (secondary). chatgpt.com/pricing and help.openai.com return 403 to scripted fetches; the help center was read through the r.jina.ai reader.
- **Google AI Pro deals (user-reported, 2026-11-25):** Pro at $4.99 and $9.99 a month, and $99 a year ($8.25 a month). gemini.google/subscriptions shows none of them, only a Black Friday "save up to 50%" banner. As reported: $4.99 is a student discount and a 3-month Black Friday offer, $9.99 a one-month trial for existing users, and $99 a year a Black Friday-only offer; none of these terms is verified on Google's site. They carry Pro's usage, not a multiple of their own price: `listPriceUsd` in `REPORTED_MULTIPLES` holds the cap at 23x $19.99. Confirm the offers and delete the plans if they end.
- **xAI:** standalone SuperGrok prices are secondary only, since x.ai and grok.com were not fetchable.
- **Volcengine and Tencent:** China-only, CNY prices converted at about 7.1 CNY/USD. Promo pricing dominates. Tencent is unverified.
- **OpenCode Go (2026-11-06):** Hy4 now has an Artificial Analysis score but no catalog family yet, so the site leaves it off. Hy4 preview, Qwen3.8 Flash, Beam Free, Iceman Contributor Free and Crouton Alpha Free still have no matching Artificial Analysis benchmark. AA's "Qwen3.8-Flash-Next" has the same price as Go's Qwen3.8 Flash but isn't confirmed to be the same model. The site counts Go's GLM-5.3 promo ($500 / $1,000 through 2026-11-22) and Gemini 4 Argon promo (50% off through 2026-11-30) in those models' values. After each ends, build-plans fails until its entry in `GO_PRICING.promos` (scripts/go-pricing.ts) is removed.
- **DeepSeek:** no official subscription. "DeepSeek coding plan" sites appear to be resellers, so DeepSeek is excluded.
- **Excluded:**
  - **Amp:** brings your own subscription or key.
  - **Kilo Pass:** prepaid credit.
  - **Google AI Plus:** no coding tier.
  - **Free tiers.**
- Model names (GPT-6.x, Claude Fable/Opus 5.5, Gemini 4 Argon, Grok 4.7, GLM-5.3, Kimi K3 and others) are as shown on vendor pages on the access date. Lineups change monthly.
