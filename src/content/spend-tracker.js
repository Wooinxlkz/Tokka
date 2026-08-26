(() => {
	'use strict';

	const TK = (globalThis.Tokka = globalThis.Tokka || {});

	const STORAGE_KEY = 'tokkaSpend';
	const RETAIN_DAYS = 30;

	function dayKey(date = new Date()) {
		return date.toISOString().slice(0, 10); // YYYY-MM-DD, UTC
	}

	function pruneOldDays(spend) {
		const cutoff = Date.now() - RETAIN_DAYS * 24 * 60 * 60 * 1000;
		for (const key of Object.keys(spend)) {
			const t = Date.parse(`${key}T00:00:00Z`);
			if (!Number.isNaN(t) && t < cutoff) delete spend[key];
		}
		return spend;
	}

	/**
	 * Record the current best-known cost for one conversation, for today.
	 * Overwrites (not adds) the per-conversation entry each call, since `userTokens`/
	 * `assistantTokens` are running totals for that conversation, not a delta - so
	 * re-visiting the same chat repeatedly the same day updates its entry rather than
	 * multiplying it.
	 */
	async function record({ conversationId, userTokens, assistantTokens, costModel }) {
		if (!conversationId || typeof userTokens !== 'number' || typeof assistantTokens !== 'number') return;
		const table = TK.PRICING?.[costModel] || TK.PRICING?.sonnet;
		if (!table) return;

		const cost = (userTokens / 1e6) * table.input + (assistantTokens / 1e6) * table.output;
		const today = dayKey();

		try {
			const stored = await chrome.storage.local.get(STORAGE_KEY);
			const spend = pruneOldDays(stored?.[STORAGE_KEY] || {});
			spend[today] = spend[today] || {};
			spend[today][conversationId] = cost;
			await chrome.storage.local.set({ [STORAGE_KEY]: spend });
		} catch {
			// storage unavailable - spend tracking just skips this update
		}
	}

	/** Returns { today, week } totals in USD, summed across all recorded conversations. */
	async function getSummary() {
		try {
			const stored = await chrome.storage.local.get(STORAGE_KEY);
			const spend = stored?.[STORAGE_KEY] || {};
			const today = dayKey();
			const weekCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

			let todayTotal = 0;
			let weekTotal = 0;
			for (const [day, convs] of Object.entries(spend)) {
				const dayTotal = Object.values(convs).reduce((sum, c) => sum + c, 0);
				const t = Date.parse(`${day}T00:00:00Z`);
				if (day === today) todayTotal += dayTotal;
				if (!Number.isNaN(t) && t >= weekCutoff) weekTotal += dayTotal;
			}
			return { today: todayTotal, week: weekTotal };
		} catch {
			return { today: 0, week: 0 };
		}
	}

	async function reset() {
		try {
			await chrome.storage.local.remove(STORAGE_KEY);
		} catch {
			// ignore
		}
	}

	TK.spendTracker = { record, getSummary, reset };
})();
