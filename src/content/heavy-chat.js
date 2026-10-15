(() => {
	'use strict';

	const TK = (globalThis.Tokka = globalThis.Tokka || {});

	const PROMPT =
		'Summarize this conversation so I can continue in a fresh chat. Include: the goal, decisions made, ' +
		'current state, open questions, and any code, file names or numbers I will need, exactly as written. ' +
		'Keep it under 500 words and format it so I can paste it as my first message.';

	const shown = new Set(); // conversation ids already warned this page session
	let el = null;

	function remove() {
		el?.remove();
		el = null;
	}

	function show(pct) {
		remove();
		el = document.createElement('div');
		el.className = 'tk-heavy';
		el.innerHTML =
			'<span class="tk-heavyText"></span>' +
			'<button type="button" class="tk-heavyBtn" data-a="copy">Copy handoff prompt</button>' +
			'<button type="button" class="tk-heavyBtn tk-heavyBtn--ghost" data-a="x" aria-label="Dismiss">&times;</button>';
		el.querySelector('.tk-heavyText').textContent = `This chat is at ~${Math.round(pct)}% of context.`;
		el.addEventListener('click', async (e) => {
			const a = e.target?.dataset?.a;
			if (a === 'x') remove();
			if (a === 'copy') {
				try {
					await navigator.clipboard.writeText(PROMPT);
					e.target.textContent = 'Copied. Paste it here, then start a new chat';
				} catch {
					e.target.textContent = 'Copy failed';
				}
			}
		});
		document.body.appendChild(el);
	}

	// Called after every conversation refresh. Warns once per conversation when it crosses the threshold.
	TK.heavy = {
		check({ conversationId, pct }) {
			const s = TK.settings?.get?.() || {};
			if (!s.heavyChatWarn || !conversationId) return;
			const warnAt = typeof s.warnThreshold === 'number' ? s.warnThreshold : 90;
			if (pct < warnAt) {
				if (shown.has(conversationId) === false) remove();
				return;
			}
			if (shown.has(conversationId)) return;
			shown.add(conversationId);
			show(pct);
		},
		hide: remove
	};
})();
