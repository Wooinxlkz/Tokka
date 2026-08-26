# Changelog

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

