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

	// Rough $/million-token pricing for the cost estimate feature.
	// Approximate on purpose — always shown with a "~" and meant as a ballpark, not a bill.
	TK.PRICING = Object.freeze({
		opus: { label: 'Opus', input: 15, output: 75 },
		sonnet: { label: 'Sonnet', input: 3, output: 15 },
		haiku: { label: 'Haiku', input: 0.8, output: 4 }
	});
})();
