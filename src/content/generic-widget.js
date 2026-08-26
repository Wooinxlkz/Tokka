(() => {
	'use strict';

	const TK = (globalThis.Tokka = globalThis.Tokka || {});

	class GenericWidget {
		constructor(site) {
			this.site = site;
			this.root = null;
			this.dot = null;
			this.tokenText = null;
			this.msgText = null;
			this.bar = null;
			this.barFill = null;
			this.settings = TK.SETTINGS_DEFAULTS ? { ...TK.SETTINGS_DEFAULTS } : {};
		}

		updateSettings(settings) {
			if (!settings) return;
			this.settings = settings;
			this.root?.classList.toggle('tk-compact', !!settings.compactMode);
		}

		mount() {
			if (this.root) return;
			this.tooltip?.remove();

			const root = document.createElement('div');
			root.className = 'tk-genericWidget';
			root.setAttribute('data-tk-site', this.site.id);

			const dot = document.createElement('span');
			dot.className = 'tk-genericDot';
			dot.style.background = this.site.accent;

			const label = document.createElement('span');
			label.className = 'tk-genericLabel';
			label.textContent = 'Tokka';

			const tokenText = document.createElement('span');
			tokenText.className = 'tk-genericToken';

			const msgText = document.createElement('span');
			msgText.className = 'tk-genericMsg';

			const bar = document.createElement('div');
			bar.className = 'tk-bar tk-bar--mini tk-genericBar';
			bar.style.setProperty('--tk-fill', this.site.accent);
			bar.style.setProperty('--tk-fill-warn', TK.COLORS.RED_WARNING);
			bar.style.setProperty('--tk-stroke', 'rgba(127,127,127,0.35)');
			const barFill = document.createElement('div');
			barFill.className = 'tk-bar__fill';
			bar.appendChild(barFill);

			root.appendChild(dot);
			root.appendChild(label);
			root.appendChild(tokenText);
			root.appendChild(bar);
			root.appendChild(msgText);

			const tooltip = document.createElement('div');
			tooltip.className = 'tk-tooltip';
			tooltip.style.background = '#141413';
			tooltip.style.color = '#faf9f5';
			tooltip.textContent =
				`Approximate token count for ${this.site.label} (generic DOM scan, not ${this.site.label}'s own tokenizer).\n` +
				`Bar scale: ~${this.site.contextLimitTokens.toLocaleString()} tokens (${this.site.contextLimitNote}).\n` +
				(this.site.selectorConfidence === 'experimental'
					? 'Experimental support for this site - may stop working if the page layout changes.'
					: '');
			document.body.appendChild(tooltip);

			let hideTimer;
			const show = () => {
				const r = root.getBoundingClientRect();
				tooltip.style.opacity = '1';
				tooltip.style.left = `${r.left + r.width / 2}px`;
				tooltip.style.top = `${r.top - tooltip.getBoundingClientRect().height - 10}px`;
				tooltip.style.transform = 'translateX(-50%)';
			};
			const hide = () => {
				tooltip.style.opacity = '0';
				clearTimeout(hideTimer);
			};
			root.addEventListener('pointerenter', (e) => {
				if (e.pointerType === 'mouse') show();
			});
			root.addEventListener('pointerleave', (e) => {
				if (e.pointerType === 'mouse') hide();
			});
			root.addEventListener('pointerdown', (e) => {
				if (e.pointerType === 'touch' || e.pointerType === 'pen') {
					hideTimer = setTimeout(() => {
						show();
						setTimeout(hide, 3000);
					}, 400);
				}
			});

			this.root = root;
			this.dot = dot;
			this.tokenText = tokenText;
			this.msgText = msgText;
			this.bar = bar;
			this.barFill = barFill;
			this.tooltip = tooltip;

			document.body.appendChild(root);
			this.updateSettings(this.settings);
		}

		ensureMounted() {
			if (!this.root || !document.body.contains(this.root)) {
				this.root = null;
				this.mount();
			}
		}

		render({ totalTokens, messageCount }) {
			this.ensureMounted();
			const compact = !!this.settings?.compactMode;
			const warnAt = typeof this.settings?.warnThreshold === 'number' ? this.settings.warnThreshold : 90;
			const alertsOn = !!this.settings?.nearLimitAlert;
			this._pulseState = this._pulseState || {};

			this.tokenText.textContent = compact
				? `~${totalTokens.toLocaleString()}`
				: `~${totalTokens.toLocaleString()} tok`;

			if (this.settings?.showMessageCount) {
				this.msgText.textContent = compact ? `${messageCount}msg` : `${messageCount} msg`;
				this.msgText.classList.remove('tk-hidden');
			} else {
				this.msgText.classList.add('tk-hidden');
			}

			const pct = Math.max(0, Math.min(100, (totalTokens / this.site.contextLimitTokens) * 100));
			const isWarn = pct >= warnAt;
			this.barFill.style.width = `${pct}%`;
			this.barFill.classList.toggle('tk-warn', isWarn);
			this.barFill.classList.toggle('tk-full', pct >= 99.5);
			TK.pulseOnWarnCross?.(this.barFill, isWarn, this._pulseState, alertsOn);

			TK.updateBadge?.({
				enabled: this.settings?.badgeEnabled,
				pct,
				warnAt,
				accent: this.site.accent,
				title: `Tokka — ~${Math.round(pct)}% of ${this.site.label}'s guessed context (approx)`
			});
		}
	}

	TK.GenericWidget = GenericWidget;
})();
