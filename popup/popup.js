(() => {
	'use strict';

	const DEFAULTS = {
		showMessageCount: true,
		showCostEstimate: false,
		costModel: 'sonnet',
		compactMode: false,
		warnThreshold: 90,
		enableOtherSites: true,
		badgeEnabled: true,
		nearLimitAlert: true,
		spendTrackingEnabled: true
	};

	const SPEND_KEY = 'tokkaSpend';

	const els = {
		showMessageCount: document.getElementById('showMessageCount'),
		showCostEstimate: document.getElementById('showCostEstimate'),
		costModel: document.getElementById('costModel'),
		costModelRow: document.getElementById('costModelRow'),
		compactMode: document.getElementById('compactMode'),
		warnThreshold: document.getElementById('warnThreshold'),
		warnThresholdValue: document.getElementById('warnThresholdValue'),
		enableOtherSites: document.getElementById('enableOtherSites'),
		badgeEnabled: document.getElementById('badgeEnabled'),
		nearLimitAlert: document.getElementById('nearLimitAlert'),
		spendTrackingEnabled: document.getElementById('spendTrackingEnabled'),
		spendToday: document.getElementById('spendToday'),
		spendWeek: document.getElementById('spendWeek'),
		spendReset: document.getElementById('spendReset'),
		spendCard: document.getElementById('spendCard'),
		version: document.getElementById('tp-version')
	};

	function applyToForm(settings) {
		els.showMessageCount.checked = settings.showMessageCount;
		els.showCostEstimate.checked = settings.showCostEstimate;
		els.costModel.value = settings.costModel;
		els.compactMode.checked = settings.compactMode;
		els.warnThreshold.value = String(settings.warnThreshold);
		els.warnThresholdValue.textContent = `${settings.warnThreshold}%`;
		els.costModelRow.style.opacity = settings.showCostEstimate ? '1' : '0.45';
		els.costModelRow.style.pointerEvents = settings.showCostEstimate ? 'auto' : 'none';
		els.enableOtherSites.checked = settings.enableOtherSites;
		els.badgeEnabled.checked = settings.badgeEnabled;
		els.nearLimitAlert.checked = settings.nearLimitAlert;
		els.spendTrackingEnabled.checked = settings.spendTrackingEnabled;
		els.spendCard.style.opacity = settings.spendTrackingEnabled ? '1' : '0.5';
	}

	async function save(partial) {
		const stored = await chrome.storage.local.get('tokkaSettings');
		const merged = { ...DEFAULTS, ...(stored.tokkaSettings || {}), ...partial };
		await chrome.storage.local.set({ tokkaSettings: merged });
		return merged;
	}

	function formatUSD(n) {
		if (!n || n <= 0) return '$0.00';
		if (n < 0.01) return '<$0.01';
		return `$${n.toFixed(2)}`;
	}

	function dayKey(date = new Date()) {
		return date.toISOString().slice(0, 10);
	}

	async function refreshSpend() {
		try {
			const stored = await chrome.storage.local.get(SPEND_KEY);
			const spend = stored?.[SPEND_KEY] || {};
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
			els.spendToday.textContent = formatUSD(todayTotal);
			els.spendWeek.textContent = formatUSD(weekTotal);
		} catch {
			els.spendToday.textContent = '$0.00';
			els.spendWeek.textContent = '$0.00';
		}
	}

	async function init() {
		const stored = await chrome.storage.local.get('tokkaSettings');
		const settings = { ...DEFAULTS, ...(stored.tokkaSettings || {}) };
		applyToForm(settings);
		refreshSpend();

		const manifest = chrome.runtime.getManifest();
		els.version.textContent = `v${manifest.version}`;

		els.showMessageCount.addEventListener('change', async () => {
			applyToForm(await save({ showMessageCount: els.showMessageCount.checked }));
		});

		els.showCostEstimate.addEventListener('change', async () => {
			applyToForm(await save({ showCostEstimate: els.showCostEstimate.checked }));
		});

		els.costModel.addEventListener('change', async () => {
			applyToForm(await save({ costModel: els.costModel.value }));
		});

		els.compactMode.addEventListener('change', async () => {
			applyToForm(await save({ compactMode: els.compactMode.checked }));
		});

		els.warnThreshold.addEventListener('input', () => {
			els.warnThresholdValue.textContent = `${els.warnThreshold.value}%`;
		});

		els.warnThreshold.addEventListener('change', async () => {
			applyToForm(await save({ warnThreshold: Number(els.warnThreshold.value) }));
		});

		els.enableOtherSites.addEventListener('change', async () => {
			applyToForm(await save({ enableOtherSites: els.enableOtherSites.checked }));
		});

		els.badgeEnabled.addEventListener('change', async () => {
			applyToForm(await save({ badgeEnabled: els.badgeEnabled.checked }));
		});

		els.nearLimitAlert.addEventListener('change', async () => {
			applyToForm(await save({ nearLimitAlert: els.nearLimitAlert.checked }));
		});

		els.spendTrackingEnabled.addEventListener('change', async () => {
			applyToForm(await save({ spendTrackingEnabled: els.spendTrackingEnabled.checked }));
		});

		els.spendReset.addEventListener('click', async () => {
			await chrome.storage.local.remove(SPEND_KEY);
			refreshSpend();
		});
	}

	init();
})();
