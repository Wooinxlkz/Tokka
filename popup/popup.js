(() => {
	'use strict';

	const TK = globalThis.Tokka;
	const $ = (id) => document.getElementById(id);
	const SETTINGS_KEY = 'tokkaSettings';
	const DEFAULTS = {
		showMessageCount: false, compactMode: false, showCostEstimate: false, costModel: 'auto',
		contextLimit: 200000, spendTrackingEnabled: true, calibration: 1, warnThreshold: 90,
		heavyChatWarn: true, nearLimitAlert: true, badgeEnabled: true
	};
	let settings = { ...DEFAULTS };
	let last = null;

	$('ver').textContent = `v${chrome.runtime.getManifest().version}`;

	// ---- tabs ----
	const ind = document.querySelector('.ind');
	function moveInd() {
		const on = document.querySelector('.tab.on');
		if (!on || !ind) return;
		ind.style.width = `${on.offsetWidth}px`;
		ind.style.transform = `translateX(${on.offsetLeft}px)`;
	}
	moveInd();
	requestAnimationFrame(moveInd);

	document.querySelectorAll('.tab').forEach((t) =>
		t.addEventListener('click', () => {
			requestAnimationFrame(moveInd);
			document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('on', x === t));
			document.querySelectorAll('.pane').forEach((p) => p.classList.toggle('on', p.id === `pane-${t.dataset.tab}`));
		})
	);

	// Smooth count-up for money values.
	function countTo(el, to, fmt) {
		const from = Number(el.dataset.v || 0);
		el.dataset.v = to;
		if (from === to || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = fmt(to); return; }
		const t0 = performance.now();
		const dur = 800;
		const step = (now) => {
			const k = Math.min(1, (now - t0) / dur);
			const e = 1 - Math.pow(1 - k, 3);
			el.textContent = fmt(from + (to - from) * e);
			if (k < 1) requestAnimationFrame(step);
		};
		requestAnimationFrame(step);
	}

	const money = (n) => (n > 0 && n < 0.01 ? '<$0.01' : `$${n.toFixed(2)}`);
	const dayKey = (d) => d.toISOString().slice(0, 10);

	// ---- usage ----
	function renderUsage(spend, log, lastChat) {
		const today = dayKey(new Date());
		const days = [];
		for (let i = 6; i >= 0; i--) {
			const d = new Date(Date.now() - i * 864e5);
			const k = dayKey(d);
			const total = Object.values(spend[k] || {}).reduce((a, b) => a + b, 0);
			days.push({ k, total, label: d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2) });
		}
		countTo($('spendToday'), days[6].total, money);
		countTo($('spendWeek'), days.reduce((a, d) => a + d.total, 0), money);

		const max = Math.max(0.01, ...days.map((d) => d.total));
		$('bars').innerHTML = days
			.map((d) => `<div class="bar" title="${d.k}: ${money(d.total)}"><i style="--n:${days.indexOf(d)}" data-h="${Math.round((d.total / max) * 100)}"></i><span>${d.label}</span></div>`)
			.join('');

		requestAnimationFrame(() => requestAnimationFrame(() => document.querySelectorAll('.bar i').forEach((b) => (b.style.height = `${b.dataset.h}%`))));

		// session meter + burn
		const sess = TK.burn.samplesFromLog(log);
		const latest = [...(log || [])].reverse().find((e) => typeof e.f === 'number');
		const fresh = latest && (!latest.r || latest.r > Date.now());
		if (latest && fresh) {
			$('sessPct').textContent = `${latest.f}%`;
			$('sessFill').style.width = `${Math.min(100, latest.f)}%`;
			$('sessFill').classList.toggle('warn', latest.f >= settings.warnThreshold);
			const p = TK.burn.predict(Date.now(), sess);
			let note = latest.r ? `Resets in ${TK.burn.fmt(latest.r - Date.now())}.` : '';
			if (p && p.etaMs != null && !p.safe) note += ` At this pace you hit the limit in ~${TK.burn.fmt(p.etaMs)}.`;
			else if (p) note += p.perHour > 0 ? ` Pace is fine for this window (~${p.perHour.toFixed(1)}%/h).` : ' No recent burn.';
			$('sessNote').textContent = note.trim();
		} else {
			$('sessPct').textContent = '–';
			$('sessFill').style.width = '0%';
			$('sessNote').textContent = latest ? 'Last window has reset. Send a message to start a new one.' : 'Open a claude.ai chat and send a message to start tracking.';
		}

		// 24h sparkline
		const pts = (log || []).filter((e) => typeof e.f === 'number' && Date.now() - e.t <= 864e5);
		const svg = $('spark');
		if (pts.length > 1) {
			const t0 = Date.now() - 864e5;
			const poly = pts.map((e) => `${(((e.t - t0) / 864e5) * 300).toFixed(1)},${(38 - (Math.min(100, e.f) / 100) * 36).toFixed(1)}`).join(' ');
			svg.innerHTML = `<line x1="0" y1="2" x2="300" y2="2"/><line x1="0" y1="38" x2="300" y2="38"/><polyline pathLength="1" points="${poly}"/>`;
		} else svg.innerHTML = '';

		// last chat
		if (lastChat) {
			const pct = Math.min(100, (lastChat.tokens / (lastChat.limit || 200000)) * 100);
			$('lastPct').textContent = `${Math.round(pct)}%`;
			$('lastFill').style.width = `${pct}%`;
			$('lastFill').classList.toggle('warn', pct >= settings.warnThreshold);
			$('lastNote').textContent = `~${lastChat.tokens.toLocaleString()} tokens of ${(lastChat.limit / 1000).toLocaleString()}k${lastChat.model ? ` · ${lastChat.model}` : ''}`;
		}
	}

	$('spendReset').addEventListener('click', async () => {
		await chrome.storage.local.remove(['tokkaSpend', TK.burn.KEY]);
		load();
	});

	// ---- library ----
	let library = [];
	async function loadLibrary() {
		try {
			const res = await fetch(chrome.runtime.getURL('library/library.json'));
			library = (await res.json()).items || [];
		} catch {
			library = [];
		}
		renderLibrary('');
	}

	function esc(s) {
		return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
	}

	function renderLibrary(q) {
		const needle = q.trim().toLowerCase();
		const items = library.filter((i) => !needle || `${i.name} ${i.tagline} ${(i.tags || []).join(' ')}`.toLowerCase().includes(needle));
		$('libList').innerHTML = items.length
			? items.map((i) => `
			<div class="item" data-id="${esc(i.id)}">
				<div class="itemHd">
					<div class="itemTop"><b>${esc(i.name)}</b><span class="badge">${esc(i.kind)}</span></div>
					<p class="sub">${esc(i.tagline)}</p>
					<div class="tags">${(i.tags || []).map((t) => `<span>#${esc(t)}</span>`).join('')}</div>
				</div>
				<div class="steps"><div class="stepsIn">
					${(i.steps || []).map((s) => `<div class="step"><small>${esc(s.label)}</small>${
						s.cmd ? `<div class="cmd"><code>${esc(s.cmd)}</code><button type="button" data-copy="${esc(s.cmd)}">Copy</button></div>` : `<p>${esc(s.note || '')}</p>`}</div>`).join('')}
					<a class="repo" href="${esc(i.repo)}" target="_blank" rel="noopener">View on GitHub</a>
				</div></div>
			</div>`).join('')
			: '<p class="sub">No matches.</p>';
	}

	$('libSearch').addEventListener('input', (e) => renderLibrary(e.target.value));
	$('libList').addEventListener('click', async (e) => {
		const btn = e.target.closest('[data-copy]');
		if (btn) {
			try {
				await navigator.clipboard.writeText(btn.dataset.copy);
				btn.textContent = 'Copied';
				setTimeout(() => (btn.textContent = 'Copy'), 1200);
			} catch {
				btn.textContent = 'Failed';
			}
			return;
		}
		if (e.target.closest('a')) return;
		e.target.closest('.itemHd')?.parentElement.classList.toggle('open');
	});

	// ---- settings ----
	const boolIds = ['showMessageCount', 'compactMode', 'showCostEstimate', 'spendTrackingEnabled', 'heavyChatWarn', 'nearLimitAlert', 'badgeEnabled'];

	function renderSettings() {
		boolIds.forEach((id) => ($(id).checked = !!settings[id]));
		$('costModel').value = settings.costModel;
		$('contextLimit').value = String(settings.contextLimit);
		$('warnThreshold').value = settings.warnThreshold;
		$('warnVal').textContent = `${settings.warnThreshold}%`;
		$('calVal').textContent = `${settings.calibration.toFixed(2)}x`;
		$('calNote').textContent = last?.raw ? `Last chat: Tokka raw count ${last.raw.toLocaleString()}` : 'Open a chat first, then enter its real count';
	}

	async function save(part) {
		settings = { ...settings, ...part };
		await chrome.storage.local.set({ [SETTINGS_KEY]: settings });
		renderSettings();
	}

	boolIds.forEach((id) => $(id).addEventListener('change', (e) => save({ [id]: e.target.checked })));
	$('costModel').addEventListener('change', (e) => save({ costModel: e.target.value }));
	$('contextLimit').addEventListener('change', (e) => save({ contextLimit: Number(e.target.value) }));
	$('warnThreshold').addEventListener('input', (e) => save({ warnThreshold: Number(e.target.value) }));
	$('calApply').addEventListener('click', () => {
		const real = Number($('calReal').value);
		if (!last?.raw || !(real > 0)) return;
		save({ calibration: Math.min(2, Math.max(0.5, Math.round((real / last.raw) * 100) / 100)) });
		$('calReal').value = '';
	});
	$('calReset').addEventListener('click', () => save({ calibration: 1 }));

	// ---- boot ----
	async function load() {
		const stored = await chrome.storage.local.get(SETTINGS_KEY);
		settings = { ...DEFAULTS, ...(stored[SETTINGS_KEY] || {}) };
		const local = await chrome.storage.local.get(['tokkaSpend', TK.burn.KEY, 'tokkaLast']);
		last = local.tokkaLast || null;
		renderSettings();
		renderUsage(local.tokkaSpend || {}, local[TK.burn.KEY] || [], last);
	}

	load();
	loadLibrary();
})();
