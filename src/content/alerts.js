(() => {
	'use strict';

	const TK = (globalThis.Tokka = globalThis.Tokka || {});

	/**
	 * Flashes a brief pulse on `el` the moment `isWarn` transitions from false -> true.
	 * Re-crossing while already in warn state does nothing (no repeated flashing every scan tick).
	 * `state` is a plain object the caller keeps around (e.g. `this._pulseState.session = {}`)
	 * so each bar tracks its own previous state independently.
	 */
	TK.pulseOnWarnCross = function pulseOnWarnCross(el, isWarn, state, enabled) {
		if (!el || !state) return;
		const was = !!state.wasWarn;
		state.wasWarn = isWarn;
		if (!enabled) return;
		if (isWarn && !was) {
			el.classList.remove('tk-pulseOnce');
			// Force reflow so the animation restarts if it's still mid-flight from a rapid re-trigger.
			// eslint-disable-next-line no-unused-expressions
			el.offsetWidth;
			el.classList.add('tk-pulseOnce');
			clearTimeout(state.pulseTimer);
			state.pulseTimer = setTimeout(() => el.classList.remove('tk-pulseOnce'), 1000);
		}
	};

	/**
	 * Sends the current usage % to the background service worker so it can set the
	 * toolbar badge for this tab. No-op (and safe) if the extension context is mid-navigation
	 * or the background script hasn't registered its listener yet.
	 */
	TK.updateBadge = function updateBadge({ enabled, pct, warnAt, accent, title }) {
		try {
			if (!chrome?.runtime?.sendMessage) return;
			if (!enabled || typeof pct !== 'number') {
				chrome.runtime.sendMessage({ type: 'tk:badge', text: '', color: accent || '#D97757', title: 'Tokka' });
				return;
			}
			const rounded = Math.round(pct);
			const color = rounded >= warnAt ? TK.COLORS.RED_WARNING : accent || '#D97757';
			chrome.runtime.sendMessage({
				type: 'tk:badge',
				text: String(rounded),
				color,
				title: title || `Tokka — ${rounded}%`
			});
		} catch {
			// extension context invalidated (e.g. page navigating away) - ignore, next scan will retry
		}
	};
})();
