(() => {
	'use strict';

	const TK = (globalThis.Tokka = globalThis.Tokka || {});

	const KEY = 'tokkaUsage';
	const KEEP_MS = 72 * 60 * 60 * 1000;
	const FIT_MS = 45 * 60 * 1000;

	// ---- in-memory samples for the current 5h window (content script) ----
	let samples = [];

	function push(pct, resetsAt, t = Date.now()) {
		if (typeof pct !== 'number') return;
		const reset = resetsAt ? Date.parse(resetsAt) : null;
		const last = samples[samples.length - 1];
		if (last && last.reset !== reset) samples = []; // new window started
		if (last && t - last.t < 5000 && last.pct === pct) return;
		samples.push({ t, pct, reset });
		if (samples.length > 400) samples.shift();
	}

	// Least-squares slope (pct per ms) over a list of {t, pct}.
	function slope(list) {
		const n = list.length;
		const t0 = list[0].t;
		let sx = 0, sy = 0, sxx = 0, sxy = 0;
		for (const s of list) {
			const x = s.t - t0;
			sx += x; sy += s.pct; sxx += x * x; sxy += x * s.pct;
		}
		const d = n * sxx - sx * sx;
		return d === 0 ? 0 : (n * sxy - sx * sy) / d;
	}

	function predict(now = Date.now(), list = samples) {
		if (!list || list.length < 2) return null;
		let use = list.filter((s) => now - s.t <= FIT_MS);
		if (use.length < 2) use = list.slice(-2);
		const first = use[0];
		const last = use[use.length - 1];
		if (last.t - first.t < 2 * 60 * 1000) return null;
		const m = slope(use);
		if (!(m > 0)) return { perHour: 0, etaMs: null, safe: true, pctNow: last.pct };
		const etaMs = (100 - last.pct) / m;
		const safe = !!last.reset && now + etaMs > last.reset;
		return { perHour: m * 3600e3, etaMs, safe, pctNow: last.pct };
	}

	function fmt(ms) {
		const m = Math.max(1, Math.round(ms / 60000));
		if (m < 60) return `${m}m`;
		return `${Math.floor(m / 60)}h ${m % 60}m`;
	}

	// " · limit in ~40m" only when the current pace would hit 100% before the window resets.
	function etaText() {
		const p = predict();
		if (!p || p.etaMs == null || p.safe) return '';
		return ` · limit in ~${fmt(p.etaMs)}`;
	}

	// ---- persisted log (feeds the popup chart + prediction) ----
	async function record(usage) {
		try {
			const f = usage?.five_hour;
			const w = usage?.seven_day;
			if (!f && !w) return;
			const now = Date.now();
			const stored = await chrome.storage.local.get(KEY);
			let log = Array.isArray(stored?.[KEY]) ? stored[KEY] : [];
			log = log.filter((e) => now - e.t <= KEEP_MS);
			const entry = {
				t: now,
				f: typeof f?.utilization === 'number' ? Math.round(f.utilization * 10) / 10 : null,
				r: f?.resets_at ? Date.parse(f.resets_at) : null,
				w: typeof w?.utilization === 'number' ? Math.round(w.utilization * 10) / 10 : null
			};
			const last = log[log.length - 1];
			if (last && last.f === entry.f && last.w === entry.w && now - last.t < 10 * 60 * 1000) return;
			log.push(entry);
			await chrome.storage.local.set({ [KEY]: log });
		} catch {
			// storage unavailable - skip
		}
	}

	// Converts the stored log into samples for the latest 5h window (used by the popup).
	function samplesFromLog(log) {
		if (!Array.isArray(log) || !log.length) return [];
		const lastReset = [...log].reverse().find((e) => e.r)?.r || null;
		return log
			.filter((e) => typeof e.f === 'number' && e.r === lastReset)
			.map((e) => ({ t: e.t, pct: e.f, reset: e.r }));
	}

	TK.burn = { push, predict, etaText, fmt, record, samplesFromLog, KEY };
})();
