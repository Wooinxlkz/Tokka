<div align="center">
  <img src="icons/icon128.png" width="72" height="72" alt="Tokka logo" />
  <h1>Tokka</h1>
  <p>A minimal browser extension that shows token count, cost, and usage bars on claude.ai — plus a lightweight widget for ChatGPT, Gemini, DeepSeek, and Kimi.</p>
  <p><sub>Developed and maintained by <strong>NullTrace</strong></sub></p>
</div>

![Tokka preview](./preview.png)

*(Illustrative preview of the claude.ai HUD — actual numbers depend on your conversation and plan.)*

## Supported sites

| Site | Support level | What you get |
|---|---|---|
| **claude.ai** | Full | Token count, message count, cost estimate, cache timer, native session/weekly usage bars |
| **ChatGPT** (chatgpt.com) | Documented selectors | Floating widget: approx. token count, message count, mini context bar |
| **Gemini** (gemini.google.com) | Documented selectors | Floating widget: approx. token count, message count, mini context bar |
| **DeepSeek** (chat.deepseek.com) | Experimental | Floating widget, best-effort DOM detection — may break if DeepSeek changes their page layout |
| **Kimi** (kimi.com) | Experimental | Floating widget, best-effort DOM detection — may break if Kimi changes their page layout |

Only claude.ai gets the full feature set (cache timer, cost estimate, native usage-limit API). The other four don't expose an equivalent usage API to the page, so Tokka falls back to reading the visible conversation text and running it through a local tokenizer — that's inherently an approximation, not an exact count.

**Each site has its own accent color** for its mini bar (ChatGPT teal, Gemini blue, DeepSeek blue, Kimi indigo, Claude terracotta), but the **warning color is always the same red** across every site — once a bar goes red, that means the same thing everywhere, regardless of which AI you're on.

## Browser support

Tokka is a standard Manifest V3 extension and the same package works, unmodified, across:

- **Chrome**, **Edge**, **Brave**, **Arc** — all Chromium-based, install the same way
- **Firefox** (142+) — via `about:debugging` (temporary) or a signed `.xpi`

There's only one build — no separate downloads per browser.

## Installation

### Chrome / Edge / Brave / Arc

1. Download the latest release zip (or clone this repo)
2. Go to `chrome://extensions` (Edge: `edge://extensions`, Brave: `brave://extensions`, Arc: `chrome://extensions` works there too)
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the `tokka` folder — or drag-and-drop the zip onto the page
5. Open [claude.ai](https://claude.ai), [chatgpt.com](https://chatgpt.com), [gemini.google.com](https://gemini.google.com), [chat.deepseek.com](https://chat.deepseek.com), or [kimi.com](https://kimi.com) — Tokka appears automatically

### Firefox

**Temporary install (for testing):**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** and select `manifest.json` inside the `tokka` folder
3. Note: temporary add-ons are removed when Firefox restarts

**Permanent install:**
1. Build a signed `.xpi` with [web-ext](https://github.com/mozilla/web-ext) (`web-ext build` then `web-ext sign`, or submit to [addons.mozilla.org](https://addons.mozilla.org))
2. Install the resulting `.xpi`

### Userscript (Tampermonkey / Violentmonkey)

1. Install a userscript manager if you don't have one
2. Open [`userscript/tokka.user.js`](./userscript/tokka.user.js) and install it
3. Visit claude.ai — the header and usage bars will appear

> The userscript build covers claude.ai only (core counter/timer/usage-bar functionality, no settings popup). The multi-site widget and settings popup are extension-only, since userscripts don't have a toolbar popup or manifest-based multi-host injection in the same way.

## Using it

### On claude.ai

Look right under the message box on any conversation:

- **Top line** — token count, mini progress bar, message count, cost estimate, and cache timer (whichever you've enabled)
- **Bottom line** — Session and Weekly usage bars. Click either one to force a refresh.

The popup also shows a running **Today / This week** estimated spend total across all your claude.ai conversations, tracked locally.

### On ChatGPT / Gemini / DeepSeek / Kimi

A small floating pill appears in the bottom-right corner of the page showing an approximate token count, a mini bar against that site's approximate context limit, and (optionally) the message count. Hover it for details on how the estimate is calculated.

### Alerts

- **Toolbar badge** shows a live % right on the extension icon — session % on claude.ai, approximate context % elsewhere — colored per-site and turning red past your warning threshold. This needs a small background service worker, since content scripts can't set the badge directly.
- **Near-limit pulse** briefly flashes a bar the instant it crosses your warning threshold, so you notice without staring at it. Fires once per crossing.

### Settings

Click the Tokka icon in your browser toolbar to open Settings:

| Section | Setting | What it does | Default |
|---|---|---|---|
| Display | Message count | Adds `· N msg` next to the token count | On |
| Display | Compact mode | Shorter labels, tighter spacing | Off |
| Cost | Cost estimate | Adds `· ~$X.XX` using the pricing table you pick (claude.ai only) | Off |
| Cost | Pricing table | Opus / Sonnet / Haiku list pricing used for the estimate | Sonnet |
| Cost | Spend tracking | Keeps the Today/Week totals shown at the top of the popup | On |
| Alerts | Warning threshold | % at which bars turn red, on every site | 90% |
| Alerts | Near-limit pulse | Brief flash when a bar crosses the threshold | On |
| Alerts | Toolbar badge | Live % on the extension icon | On |
| Sites | Other AI sites | Turns the ChatGPT/Gemini/DeepSeek/Kimi widget on or off | On |

The cost estimate and spend tracker are both **rough approximations** — they don't account for prompt caching discounts, system prompt tokens, or tool-call overhead beyond what's in the visible conversation. Always check the [Claude Console](https://console.anthropic.com) for real billing. Both are claude.ai-only, since Tokka doesn't have reliable pricing/token-split data for the other sites.

## How it works

**On claude.ai:**
- Intercepts Claude's own API responses to read conversation data and usage info
- Uses a vendored tokenizer (`o200k_base`) for approximate token counting
- Reads Claude's `/usage` endpoint plus live SSE `message_limit` data — the SSE gives exact, unrounded utilization fractions, so the bars are more accurate than the rounded percentages on Claude's native `/usage` page
- Watches for DOM changes to (re)inject UI elements as you navigate between chats

**On ChatGPT / Gemini / DeepSeek / Kimi:**
- No network interception — Tokka only reads text that's already rendered on the page
- ChatGPT: reads elements with `[data-message-author-role]`
- Gemini: reads `<user-query>` and `<model-response>` elements
- DeepSeek / Kimi: tries a short list of best-effort class-name patterns (these platforms don't have confirmed stable public selectors as of this release — if the widget stops appearing, the site's DOM structure likely changed; see [Contributing](#contributing))
- Runs the same `o200k_base` tokenizer against the collected text — this is Claude's tokenizer, not the target model's, so counts on non-Claude sites are a ballpark, not exact
- Re-scans on a debounced `MutationObserver` plus a poll for SPA route changes

Settings (toggles, thresholds, pricing model) are stored locally via `chrome.storage.local` — nothing leaves your browser, on any site.

## Privacy

- All data stays local — no external servers, no telemetry, no analytics
- On claude.ai: reads your `lastActiveOrg` cookie to query Claude's own `/usage` endpoint; requests only ever go to `claude.ai`
- On other sites: makes zero network requests — only reads the DOM that's already loaded in your tab
- Settings are stored locally in your browser via the standard extension storage API

## Limitations

Being upfront about what Tokka can't do, rather than faking it:

- **Claude Code is not trackable.** It's a CLI/desktop tool, not a web page - a browser extension has no way to see it at all.
- **Cowork is not currently tracked.** It's a separate desktop app; we don't have confirmation it ever runs inside a claude.ai browser tab.
- **No free/paid tier detection, anywhere.** On claude.ai, we couldn't confirm a plan/tier field exists in the data we read. On ChatGPT/Gemini/DeepSeek/Kimi, there's no usage API exposed to the page at all, so tier would have to be guessed from UI heuristics - we chose not to ship that as if it were a real number.
- **ChatGPT/Gemini/DeepSeek/Kimi numbers are approximate, full stop.** No official usage API, no verified tier data, static context-limit guesses that don't adjust per selected model. Treat the widget on those sites as "roughly how much you've said," not a quota meter.

See [CHANGELOG.md](./CHANGELOG.md) for the full reasoning behind each of these.

## Project structure

```
tokka/
├── manifest.json           Extension manifest (MV3)
├── popup/                  Toolbar settings popup
├── src/
│   ├── background/
│   │   └── service-worker.js Sets the toolbar badge per-tab (content scripts can't do this directly)
│   ├── content/
│   │   ├── constants.js      Shared colors, pricing table, config
│   │   ├── settings.js       Settings load/save/sync (chrome.storage.local)
│   │   ├── alerts.js         Shared near-limit pulse + badge-messaging helpers
│   │   ├── spend-tracker.js  Local daily/weekly $ tally (claude.ai only)
│   │   ├── tokens.js         claude.ai conversation → token/message metrics
│   │   ├── ui.js             claude.ai header + usage bar UI
│   │   ├── main.js           claude.ai entry point
│   │   ├── bridge-client.js  claude.ai page-bridge message relay
│   │   ├── site-registry.js  Per-site colors, context limits, selectors
│   │   ├── generic-widget.js Floating widget UI (ChatGPT/Gemini/DeepSeek/Kimi)
│   │   └── generic-main.js   Non-Claude entry point (DOM scan + widget)
│   ├── injected/            Page-context bridge (reads Claude's API responses)
│   ├── vendor/               Vendored o200k_base tokenizer
│   └── styles.css
├── userscript/              Standalone userscript build (claude.ai only)
└── icons/
```

## Contributing

DeepSeek and Kimi selectors in [`site-registry.js`](./src/content/site-registry.js) are best-effort guesses — if the widget isn't picking up messages on either site, open your browser DevTools, inspect a message bubble, and send a PR updating `messageSelectors` for that site. Selectors are combined (unioned), not first-match, so it's safe to add more candidates.

## Credits

- Forked and rebranded from [**Claude Counter**](https://github.com/she-llac/claude-counter) by she-llac (MIT) — all core token-counting, cache-timer, and usage-bar logic for claude.ai originates there
- Token counting via [gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) (MIT)
- Originally inspired by [Claude Usage Tracker](https://github.com/lugia19/Claude-Usage-Extension) by lugia19

Tokka is an independent project and is not affiliated with or endorsed by Anthropic, OpenAI, Google, DeepSeek, or Moonshot AI.

## License

MIT — see [LICENSE](./LICENSE).
