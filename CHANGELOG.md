# Changelog

## v1.4.1

- Popup back to the original cream and terracotta palette
- Motion throughout the popup: sliding tab indicator, staggered card entrances, count-up spend numbers, growing chart bars, drawn sparkline, animated meters, smooth Library expand, springy switches (all respect reduced-motion)
- Thin scrollbars themed to the UI on every scrollable area
- Heavy-chat prompt restyled to match

## v1.4.0

- **Fix:** `Uncaught (in promise) Error: No tab with id` in the service worker. Badge calls now swallow the rejection when a tab closes mid-update
- Library tab with install commands for Tauri Audit and Arabic Formal Writer, driven by `library/library.json`
- Per-model pricing (auto-detected from the model picker), plus a context window setting (200k or 1M)
- Burn-rate prediction on the session bar and badge tooltip
- Usage history: 24h sparkline and 7-day spend chart in the popup
- Heavy-chat prompt with a copyable handoff prompt
- Calibration multiplier for token counts
- Popup redesigned: cold dark theme, three tabs

## v1.3.0

**Claude only.**

- Removed the ChatGPT, Gemini, DeepSeek and Kimi widget entirely: scripts, styles, manifest block, the "Other AI sites" setting, and all docs
- Extension now runs on claude.ai only
- Refreshed the cost table to current list pricing (Opus $4/$20, Sonnet $2/$10, Haiku $1/$5 per million tokens). Estimates only, check the Console for real billing
- README no longer claims the vendored tokenizer is Claude's own. It's OpenAI's `o200k_base`, used as an approximation

## v1.2.1

**Bug fix: claude.ai bar sometimes not appearing.**

Found and fixed a real bug in `attachUsageLine()`: it located the toolbar to attach the usage bar next to by requiring `display:flex; flex-direction:row` with multiple buttons. On a narrower window or with the sidebar open, Claude's toolbar can reflow to a column layout, which this check would never match - it fell through to a much less reliable fallback (three parents up from the model selector), which could land on the wrong, sometimes hidden, node.

- Loosened the toolbar-detection heuristic to accept `flex`, `inline-flex`, or `grid` regardless of direction
- Added a real visibility check (computed style + bounding box, not just `offsetParent`, since `offsetParent` alone gives false positives on `position: fixed` elements) before accepting an anchor to insert next to
- Fixed the reattach-observer's "is it still there" check, which previously only asked `document.contains()` - true even for a bar sitting inside a hidden subtree. It now also catches that case, without misfiring on the two legitimate hidden states (no usage data yet, no tokens yet)

**What we investigated and did NOT change, on purpose:**

- **Claude Code tracking** — not possible. Claude Code is a CLI/desktop tool, not a web page; a browser extension has no DOM to attach to and no path to this data at all.
- **Cowork tracking** — not implemented. Cowork is a separate desktop app per Anthropic's own docs; we have no confirmation it ever runs inside a claude.ai browser tab, so there's nothing to build against without that being verified first.
- **Free/paid tier detection (claude.ai)** — not implemented. We looked for a plan/tier field in the usage data we already read and couldn't confirm one exists without live testing against a real account. We're not going to guess and label it as real.
- **Free/paid tier detection (ChatGPT/Gemini/DeepSeek/Kimi)** — not implemented. None of these expose a usage/quota API to the page. The only way to guess tier would be fragile DOM heuristics (e.g. "an Upgrade button is present"), and even a correct guess wouldn't map cleanly onto our token-based bar, since some of these platforms rate-limit by message count, not tokens. We're not shipping a guess dressed up as a real number.
- **Reverse-engineering the other providers' private APIs** to get real usage/tier parity with Claude - deliberately not attempted. That would mean scraping undocumented internal endpoints, which is a real Terms-of-Service risk on each platform and isn't something to do without an explicit decision to accept that risk.

Nothing above is silently degraded or faked - the widgets on ChatGPT/Gemini/DeepSeek/Kimi behave exactly as documented in v1.1.0/v1.2.0: an approximate DOM-based token count, nothing more.

## v1.2.0

**Alerts, badge, and spend tracking.**

- **Toolbar badge** — the extension icon now shows a live usage % (session % on claude.ai, approximate context % on other sites), colored per-site, red once past your warning threshold. Handled by a new background service worker since content scripts can't touch the badge API directly.
- **Near-limit pulse** — bars now flash briefly the instant they cross your warning threshold, on every site. Fires once per crossing, not a repeated/annoying pulse.
- **Spend tracker (claude.ai only)** — a running "Today / This week" estimated-cost summary at the top of the popup, tracked locally per conversation per day. Toggle it off, or reset the history, right from Settings.
- New settings: toolbar badge, near-limit pulse, and spend tracking (all on by default), each independently toggleable
- Popup UI overhaul: sectioned into Display / Cost / Alerts / Sites for scannability, and restructured so the footer (version + NullTrace credit) is always pinned and visible regardless of how many settings are open — no more clipped footer on smaller screens

## v1.1.0

**New: multi-site support.** Tokka now runs on ChatGPT, Gemini, DeepSeek, and Kimi, in addition to claude.ai.

- Floating token-count widget on `chatgpt.com`, `chat.openai.com`, `gemini.google.com`, `chat.deepseek.com`, and `kimi.com`
- Each site gets its own accent color for its mini progress bar — ChatGPT teal, Gemini blue, DeepSeek blue, Kimi indigo — while the **warning color (red) stays the same everywhere**, so "you're close to the limit" always reads the same regardless of site
- New "Other AI sites" toggle in Settings (on by default) to turn the widget off entirely
- ChatGPT and Gemini detection is based on documented DOM patterns (`data-message-author-role`, `<user-query>`/`<model-response>`); DeepSeek and Kimi use best-effort heuristics and are marked **experimental** — see README for details and caveats
- Approximate context-window sizes are used per site for the mini bar (DeepSeek and Kimi both ~1M tokens, Gemini ~1M, ChatGPT ~128k) — actual limits vary by model/plan, so these are ballparks, not exact
- No network interception on non-Claude sites — everything is read from the visible page DOM, locally, with no external requests

**Other changes**

- Version bump, manifest metadata refresh
- Confirmed working across Chrome, Edge, Brave, Arc (all Chromium-based) and Firefox 142+ — see README's Browser support section
- Project now developed and maintained by **NullTrace**

## v1.0.0

- Rebrand from Claude Counter to **Tokka**: new name, new icon, Claude-matched terracotta color palette
- New settings popup: toggle message count, cost estimate, compact mode, and a configurable warning threshold
- Message count now shown next to the token count
- Rough cost estimate (`~$`) using selectable Opus / Sonnet / Haiku pricing, split by input/output tokens
- New README, MIT LICENSE, and third-party notices

