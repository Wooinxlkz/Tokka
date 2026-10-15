(() => {
	'use strict';

	const TK = (globalThis.Tokka = globalThis.Tokka || {});

	TK.DOM = Object.freeze({
		CHAT_MENU_TRIGGER: '[data-testid="chat-menu-trigger"]',
		MODEL_SELECTOR_DROPDOWN: '[data-testid="model-selector-dropdown"]',
		CHAT_PROJECT_WRAPPER: '.chat-project-wrapper',
		BRIDGE_SCRIPT_ID: 'tk-bridge-script'
	});

	TK.CONST = Object.freeze({
		CACHE_WINDOW_MS: 5 * 60 * 1000,
		CONTEXT_LIMIT_TOKENS: 200000
	});

	// Claude's own brand palette (terracotta accent + warm neutrals),
	// so the bars read as "part of claude.ai" instead of a generic blue widget.
	TK.COLORS = Object.freeze({
		PROGRESS_FILL_DARK: '#E0876A', // lighter terracotta, pops on dark bg
		PROGRESS_FILL_LIGHT: '#D97757', // Claude terracotta
		PROGRESS_OUTLINE_DARK: '#787877',
		PROGRESS_OUTLINE_LIGHT: '#bfbfbf',
		PROGRESS_MARKER_DARK: '#ffffff',
		PROGRESS_MARKER_LIGHT: '#111111',
		RED_WARNING: '#ce2029',
		BOLD_LIGHT: '#141413',
		BOLD_DARK: '#faf9f5'
	});

	// Maps a model id ("claude-sonnet-5-5") or a UI label ("Sonnet 5.5") to a pricing family.
	// Returns null when it can't tell, so callers can fall back instead of guessing.
	TK.resolveModel = function resolveModel(text) {
		if (typeof text !== 'string') return null;
		const t = text.toLowerCase();
		if (t.includes('opus')) return 'opus';
		if (t.includes('sonnet')) return 'sonnet';
		if (t.includes('haiku')) return 'haiku';
		return null;
	};

	// Rough $/million-token pricing for the cost estimate feature.
	// Approximate on purpose — always shown with a "~" and meant as a ballpark, not a bill.
	TK.PRICING = Object.freeze({
		opus: { label: 'Opus', input: 4, output: 20 },
		sonnet: { label: 'Sonnet', input: 2, output: 10 },
		haiku: { label: 'Haiku', input: 1, output: 5 }
	});
})();
