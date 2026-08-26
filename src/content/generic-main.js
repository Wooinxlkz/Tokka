(() => {
	'use strict';

	const TK = (globalThis.Tokka = globalThis.Tokka || {});
	if (TK.__genericStarted) return;
	TK.__genericStarted = true;

	const site = TK.getCurrentSite ? TK.getCurrentSite() : null;
	if (!site) return;

	function getTokenizer() {
		return globalThis.GPTTokenizer_o200k_base || null;
	}

	function countTokens(text) {
		if (!text) return 0;
		const tokenizer = getTokenizer();
		if (!tokenizer?.countTokens) return 0;
		try {
			return tokenizer.countTokens(text);
		} catch {
			return 0;
		}
	}

	function collectMessageNodes() {
		// Union every selector that matches (e.g. Gemini needs both <user-query> AND
		// <model-response> - these are complementary, not alternatives). Then drop any
		// node that's a descendant of another matched node so nested/overlapping
		// selector guesses (DeepSeek/Kimi) don't double-count the same text.
		const matched = new Set();
		for (const selector of site.messageSelectors) {
			try {
				document.querySelectorAll(selector).forEach((el) => matched.add(el));
			} catch {
				// invalid/unsupported selector on this page - ignore and continue
			}
		}
		if (matched.size === 0) return [];

		const nodes = Array.from(matched);
		return nodes.filter((node) => !nodes.some((other) => other !== node && other.contains(node)));
	}

	let widget = null;
	let settings = TK.SETTINGS_DEFAULTS ? { ...TK.SETTINGS_DEFAULTS } : {};
	let lastScanMs = 0;
	let scanTimer = null;

	function scan() {
		if (!settings.enableOtherSites) return;

		const nodes = collectMessageNodes();
		if (nodes.length === 0) {
			// Nothing recognizable on the page yet (e.g. landing page, no conversation open).
			return;
		}

		let totalTokens = 0;
		for (const node of nodes) {
			const text = site.textFrom(node);
			totalTokens += countTokens(text);
		}

		if (!widget) {
			widget = new TK.GenericWidget(site);
			widget.updateSettings(settings);
			widget.mount();
		}
		widget.render({ totalTokens, messageCount: nodes.length });
	}

	function scheduleScan() {
		const now = Date.now();
		// Debounce: at most once every 600ms, but always fire the trailing edge.
		if (scanTimer) return;
		const elapsed = now - lastScanMs;
		const delay = elapsed > 600 ? 0 : 600 - elapsed;
		scanTimer = setTimeout(() => {
			scanTimer = null;
			lastScanMs = Date.now();
			scan();
		}, delay);
	}

	function init() {
		const observer = new MutationObserver(scheduleScan);
		observer.observe(document.body, { childList: true, subtree: true, characterData: true });
		scheduleScan();

		// Re-scan on SPA navigation (most of these sites use pushState routing).
		let lastPath = location.pathname;
		setInterval(() => {
			if (location.pathname !== lastPath) {
				lastPath = location.pathname;
				scheduleScan();
			}
		}, 1000);
	}

	if (TK.settings) {
		TK.settings.load().then((s) => {
			settings = s;
			widget?.updateSettings(settings);
			if (settings.enableOtherSites) init();
		});
		TK.settings.onChange((s) => {
			const wasEnabled = settings.enableOtherSites;
			settings = s;
			widget?.updateSettings(settings);
			if (!wasEnabled && settings.enableOtherSites) init();
			if (wasEnabled && !settings.enableOtherSites) {
				widget?.root?.remove();
				widget?.tooltip?.remove();
				widget = null;
			}
		});
	} else {
		init();
	}
})();
