(() => {
	'use strict';

	const TK = (globalThis.Tokka = globalThis.Tokka || {});

	// Per-site accent colors + approximate context limits for the "other AI sites" mode.
	// Red warning color is intentionally NOT set here - it always comes from
	// TK.COLORS.RED_WARNING (shared with the Claude bars) so the warning state
	// reads the same everywhere, only the normal-state fill color changes per site.
	//
	// Selector confidence varies by site - see README. ChatGPT and Gemini selectors
	// are grounded in documented current DOM patterns; DeepSeek and Kimi fall back
	// to generic heuristics since no stable public selector could be confirmed.
	TK.SITES = Object.freeze([
		{
			id: 'chatgpt',
			label: 'ChatGPT',
			hostnames: ['chatgpt.com', 'chat.openai.com'],
			accent: '#10A37F',
			contextLimitTokens: 128000,
			contextLimitNote: 'varies by model/plan',
			selectorConfidence: 'documented',
			messageSelectors: ['[data-message-author-role]'],
			textFrom: (el) => el.innerText || el.textContent || ''
		},
		{
			id: 'gemini',
			label: 'Gemini',
			hostnames: ['gemini.google.com'],
			accent: '#4285F4',
			contextLimitTokens: 1000000,
			contextLimitNote: 'varies by model',
			selectorConfidence: 'documented',
			messageSelectors: ['user-query', 'model-response'],
			textFrom: (el) => el.innerText || el.textContent || ''
		},
		{
			id: 'deepseek',
			label: 'DeepSeek',
			hostnames: ['chat.deepseek.com'],
			accent: '#4D6BFE',
			contextLimitTokens: 1000000,
			contextLimitNote: 'V4, varies by model',
			selectorConfidence: 'experimental',
			// No confirmed public selector - try a few plausible patterns, most specific first.
			messageSelectors: [
				'[class*="message"][class*="content"]',
				'.ds-message',
				'[class*="_message_"]'
			],
			textFrom: (el) => el.innerText || el.textContent || ''
		},
		{
			id: 'kimi',
			label: 'Kimi',
			hostnames: ['kimi.com', 'www.kimi.com', 'kimi.moonshot.cn'],
			accent: '#6366F1',
			contextLimitTokens: 1000000,
			contextLimitNote: 'K2.5+, varies by model',
			selectorConfidence: 'experimental',
			messageSelectors: [
				'[class*="message-content"]',
				'[class*="chat-message"]',
				'[class*="segment-content"]'
			],
			textFrom: (el) => el.innerText || el.textContent || ''
		}
	]);

	TK.getCurrentSite = function getCurrentSite() {
		const host = location.hostname.replace(/^www\./, '');
		return TK.SITES.find((s) => s.hostnames.some((h) => host === h || host === `www.${h}`)) || null;
	};
})();
