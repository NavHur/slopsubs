# Coding subscription plans: caveats (accessed 2026-10-17)

The data is in `plans/`, one JSON file per vendor. Each row has a source URL, an access date and a confidence level (`primary`, `secondary` or `unverified`). Prices are in USD and exclude tax.

## Market changes in the last month

- **Cursor and xAI merged their plans.** Since 2026-10-12, cursor.com/pricing sells "The X Subscription": Plus $8, Premium $30, Super $100 and Ultra $200. All four share one weekly AI usage pool across Cursor and Grok. That pool covers Grok models only, and third-party models (Claude, GPT, Gemini) are billed at API list price. New customers can no longer buy Cursor Pro, Pro+ or Ultra, or standalone SuperGrok. The legacy rows are kept and labelled as closed.
- **OpenAI Pro changed on 2026-09-29.** Pro is now $100, $200 or $500. The $200 tier reopened with a smaller allowance than before; grandfathered subscribers keep the old one until 2026-10-29. Pro 500 adds Ultrafast. OpenAI publishes no multiplier for the current Pro 200 or Pro 500. The "5x Plus" figure for Pro 100 comes from the April launch.
- **Google retired Gemini CLI for consumer plans on 2026-06-18.** AI Pro and Ultra now cover Antigravity and Antigravity CLI. The Gemini CLI quota page still lists the old per-day numbers, which are stale.
- **GitHub Copilot became credit-based on 2026-06-01.** 1 credit is $0.01. Plans include base plus "flex" credits worth 1.5x to 2x the price. New signups for Pro, Pro+ and Max were paused in April. I couldn't confirm whether they have reopened.
- **Z.ai GLM Coding Plan moved from prompt counts to credits on 2026-07-30.** Pro and Max prices are secondary only, because the subscribe page renders prices client-side.
- **MiniMax replaced Token Plan with M Plan (Go, Explore, Build).**

## Limits are not comparable across vendors

- **Rate-window plans** have a 5-hour window plus a weekly cap: Claude, ChatGPT Plus, Google, Z.ai, MiniMax, Alibaba, Volcengine, Kimi (5-hour only) and OpenCode Go. Vendors publish multipliers or message estimates, not tokens. The exceptions are Z.ai credits, Alibaba request counts and OpenCode per-model numbers.
- **Credit plans** pay a fixed dollar amount of usage at list rates. Copilot gives about 1.5x to 2x its price, Ollama 3x, JetBrains and Warp about 1x, and MiMo has a monthly credit quota. Their "subscription value" over the API is roughly the credit ratio, so the site should model them separately from rate-window plans.
- **Bundled API credits:** Claude Max includes $100 (5x) or $200 (20x) a month of Claude Platform API credits. Google Ultra includes Google Cloud credits. Count these in value calculations.

## Third-party harness use (`thirdPartyHarnessAllowed`)

- **Allowed:**
  - **OpenAI:** "Sign in with ChatGPT" officially lets Plus and Pro power OpenCode, Pi, OpenClaw, T3, Amp, Kilo, Warp and others, with per-app weekly caps.
  - **Copilot:** OpenCode is officially supported.
  - **Kimi** (but don't spoof the User-Agent).
  - **MiniMax and MiMo.**
  - **Alibaba**, for interactive use only.
  - **OpenCode Go, Ollama, Synthetic and Chutes.**
- **Forbidden:**
  - **Anthropic:** subscription OAuth is only for Claude Code and native apps, and third parties may not route requests through Free, Pro or Max credentials.
  - **Google:** marked false on the basis of reported Feb 2026 account suspensions for routing Antigravity OAuth through OpenCode or OpenClaw. I didn't find an explicit ToS clause.
  - **Cursor (legacy), Devin, Factory, JetBrains and Warp:** quotas only work inside the vendor's own product.
- **Unclear:**
  - **Z.ai and Volcengine:** use is limited to a vendor-listed set of tools. Claude Code, Codex and OpenCode are on the list; anything else is forbidden.
  - **X Subscription:** its Grok API access is billed separately from the pool.

## Unverified or open items

- No annual price could be verified for ChatGPT, Google or Copilot. chatgpt.com/pricing and help.openai.com return 403 to scripted fetches; the help center was read through the r.jina.ai reader.
- **xAI:** standalone SuperGrok prices are secondary only, since x.ai and grok.com were not fetchable.
- **Volcengine and Tencent:** China-only, CNY prices converted at about 7.1 CNY/USD. Promo pricing dominates. Tencent is unverified.
- **OpenCode Go (2026-10-26):** Hy4 preview, Qwen3.8 Flash and Beam Free have no Artificial Analysis benchmark yet, so the site leaves them off. AA's "Qwen3.8-Flash-Next" has the same price as Go's Qwen3.8 Flash but isn't confirmed to be the same model. The site counts Go's Gemini 4 Argon promo (50% off through 2026-11-30) in that model's value. After it ends, build-plans fails until its GO_PROMOS entry is removed.
- **DeepSeek:** no official subscription. "DeepSeek coding plan" sites appear to be resellers, so DeepSeek is excluded.
- **Excluded:**
  - **Amp:** brings your own subscription or key.
  - **Kilo Pass:** prepaid credit.
  - **Google AI Plus:** no coding tier.
  - **Free tiers.**
- Model names (GPT-6.x, Claude Fable/Opus 5.5, Gemini 4 Argon, Grok 4.7, GLM-5.3, Kimi K3 and others) are as shown on vendor pages on the access date. Lineups change monthly.
