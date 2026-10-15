(() => {
	'use strict';

	const TK = (globalThis.Tokka = globalThis.Tokka || {});

	const DEFAULTS = Object.freeze({
		showMessageCount: true,
		showCostEstimate: false,
		costModel: 'auto', // 'auto' | 'opus' | 'sonnet' | 'haiku'
		compactMode: false,
		warnThreshold: 90, // % at which bars turn red
		badgeEnabled: true, // toolbar icon badge showing live %
		nearLimitAlert: true, // brief pulse on a bar the moment it crosses warnThreshold
		spendTrackingEnabled: true, // local daily/weekly $ tally across claude.ai conversations
		contextLimit: 200000, // context bar scale: 200000 | 1000000
		calibration: 1, // multiplier applied to every token count (0.5 - 2)
		heavyChatWarn: true // one-time "this chat is heavy" prompt
	});

	TK.SETTINGS_DEFAULTS = DEFAULTS;

	let current = { ...DEFAULTS };
	const listeners = new Set();

	function notify() {
		for (const fn of listeners) {
			try {
				fn(current);
			} catch {
				// ignore listener errors
			}
		}
	}

	function sanitize(raw) {
		const out = { ...DEFAULTS };
		if (!raw || typeof raw !== 'object') return out;
		if (typeof raw.showMessageCount === 'boolean') out.showMessageCount = raw.showMessageCount;
		if (typeof raw.showCostEstimate === 'boolean') out.showCostEstimate = raw.showCostEstimate;
		if (raw.costModel === 'auto' || raw.costModel === 'opus' || raw.costModel === 'sonnet' || raw.costModel === 'haiku') {
			out.costModel = raw.costModel;
		}
		if (typeof raw.compactMode === 'boolean') out.compactMode = raw.compactMode;
		if (typeof raw.warnThreshold === 'number' && raw.warnThreshold >= 50 && raw.warnThreshold <= 100) {
			out.warnThreshold = raw.warnThreshold;
		}
		if (typeof raw.badgeEnabled === 'boolean') out.badgeEnabled = raw.badgeEnabled;
		if (typeof raw.nearLimitAlert === 'boolean') out.nearLimitAlert = raw.nearLimitAlert;
		if (typeof raw.spendTrackingEnabled === 'boolean') out.spendTrackingEnabled = raw.spendTrackingEnabled;
		if (raw.contextLimit === 200000 || raw.contextLimit === 1000000) out.contextLimit = raw.contextLimit;
		if (typeof raw.calibration === 'number' && raw.calibration >= 0.5 && raw.calibration <= 2) out.calibration = raw.calibration;
		if (typeof raw.heavyChatWarn === 'boolean') out.heavyChatWarn = raw.heavyChatWarn;
		return out;
	}

	async function load() {
		try {
			const stored = await chrome.storage.local.get('tokkaSettings');
			current = sanitize(stored?.tokkaSettings);
		} catch {
			current = { ...DEFAULTS };
		}
		notify();
		return current;
	}

	function get() {
		return current;
	}

	function onChange(fn) {
		listeners.add(fn);
		return () => listeners.delete(fn);
	}

	// Live-update if the user tweaks settings in the popup while a claude.ai tab is open.
	try {
		chrome.storage.onChanged.addListener((changes, area) => {
			if (area !== 'local' || !changes.tokkaSettings) return;
			current = sanitize(changes.tokkaSettings.newValue);
			notify();
		});
	} catch {
		// storage API unavailable (e.g. userscript context) - settings stay at defaults
	}

	TK.settings = { load, get, onChange };
})();
