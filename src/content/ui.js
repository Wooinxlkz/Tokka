(() => {
	'use strict';

	const TK = (globalThis.Tokka = globalThis.Tokka || {});

	function formatSeconds(totalSeconds) {
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${String(seconds).padStart(2, '0')}`;
	}

	// `offsetParent === null` alone is NOT a reliable "is this hidden" check - position:fixed
	// elements legitimately report null offsetParent even while fully visible. Combine it with
	// computed style + bounding box so a fixed ancestor can't cause a false "hidden" verdict
	// (which would ironically recreate the same "bar never appears" bug via a different path).
	function isVisible(el) {
		if (!el || el === document.body) return true;
		const style = window.getComputedStyle(el);
		if (style.display === 'none' || style.visibility === 'hidden') return false;
		const rect = el.getBoundingClientRect();
		if (rect.width > 0 || rect.height > 0) return true;
		// Zero-size and no positioned/fixed escape hatch - genuinely not rendered.
		return style.position === 'fixed' && el.offsetParent !== null;
	}

	function formatResetCountdown(timestampMs) {
		// <= 0: reset time reached
		const diffMs = timestampMs - Date.now();
		if (diffMs <= 0) return '0s';

		// < 1 min: show seconds
		const totalSeconds = Math.floor(diffMs / 1000);
		if (totalSeconds < 60) return `${totalSeconds}s`;

		// < 1 hour: show minutes
		const totalMinutes = Math.round(totalSeconds / 60);
		if (totalMinutes < 60) return `${totalMinutes}m`;

		// < 1 day: show hours
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		if (hours < 24) return `${hours}h ${minutes}m`;

		// >= 1 day: show days
		const days = Math.floor(hours / 24);
		const remHours = hours % 24;
		return `${days}d ${remHours}h`;
	}

	function setupTooltip(element, tooltip, { topOffset = 10 } = {}) {
		if (!element || !tooltip) return;
		if (element.hasAttribute('data-tooltip-setup')) return;
		element.setAttribute('data-tooltip-setup', 'true');
		element.classList.add('tk-tooltipTrigger');

		let pressTimer;
		let hideTimer;

		const show = () => {
			const rect = element.getBoundingClientRect();
			tooltip.style.opacity = '1';
			const tipRect = tooltip.getBoundingClientRect();

			let left = rect.left + rect.width / 2;
			if (left + tipRect.width / 2 > window.innerWidth) left = window.innerWidth - tipRect.width / 2 - 10;
			if (left - tipRect.width / 2 < 0) left = tipRect.width / 2 + 10;

			let top = rect.top - tipRect.height - topOffset;
			if (top < 10) top = rect.bottom + 10;

			tooltip.style.left = `${left}px`;
			tooltip.style.top = `${top}px`;
			tooltip.style.transform = 'translateX(-50%)';
		};

		const hide = () => {
			tooltip.style.opacity = '0';
			clearTimeout(hideTimer);
		};

		element.addEventListener('pointerdown', (e) => {
			if (e.pointerType === 'touch' || e.pointerType === 'pen') {
				pressTimer = setTimeout(() => {
					show();
					hideTimer = setTimeout(hide, 3000);
				}, 500);
			}
		});

		element.addEventListener('pointerup', () => clearTimeout(pressTimer));
		element.addEventListener('pointercancel', () => {
			clearTimeout(pressTimer);
			hide();
		});

		element.addEventListener('pointerenter', (e) => {
			if (e.pointerType === 'mouse') show();
		});

		element.addEventListener('pointerleave', (e) => {
			if (e.pointerType === 'mouse') hide();
		});
	}

	function makeTooltip(text) {
		const tip = document.createElement('div');
		tip.className = 'bg-bg-500 text-text-000 tk-tooltip';
		tip.textContent = text;
		document.body.appendChild(tip);
		return tip;
	}

	class CounterUI {
		constructor({ onUsageRefresh } = {}) {
			this.onUsageRefresh = onUsageRefresh || null;

			this.headerContainer = null;
			this.headerDisplay = null;
			this.lengthGroup = null;
			this.lengthDisplay = null;
			this.cachedDisplay = null;
			this.lengthBar = null;
			this.lengthTooltip = null;
			this.lastCachedUntilMs = null;
			this.pendingCache = false;

			this.messageCountDisplay = null;
			this.costEstimateDisplay = null;
			this.costTooltip = null;

			this.usageLine = null;
			this.sessionUsageSpan = null;
			this.weeklyUsageSpan = null;
			this.sessionBar = null;
			this.sessionBarFill = null;
			this.weeklyBar = null;
			this.weeklyBarFill = null;
			this.sessionResetMs = null;
			this.weeklyResetMs = null;
			this.sessionMarker = null;
			this.weeklyMarker = null;
			this.sessionWindowStartMs = null;
			this.weeklyWindowStartMs = null;
			this.refreshingUsage = false;

			this.domObserver = null;

			this.settings = TK.SETTINGS_DEFAULTS ? { ...TK.SETTINGS_DEFAULTS } : {};
			this.lastMetrics = null; // cache so we can re-render on settings change without new data
		}

		updateSettings(settings) {
			if (!settings) return;
			this.settings = settings;
			this.headerContainer?.classList.toggle('tk-compact', !!settings.compactMode);
			this.usageLine?.classList.toggle('tk-compact', !!settings.compactMode);

			// Re-render whatever we already know, using the new settings.
			if (this.lastMetrics) this.setConversationMetrics(this.lastMetrics);
			this.refreshProgressChrome();
			if (this.lastUsage) this.setUsage(this.lastUsage);
		}

		getProgressChrome() {
			const root = document.documentElement;
			const modeDark = root.dataset?.mode === 'dark';
			const modeLight = root.dataset?.mode === 'light';
			const isDark = modeDark && !modeLight;

			return {
				strokeColor: isDark ? TK.COLORS.PROGRESS_OUTLINE_DARK : TK.COLORS.PROGRESS_OUTLINE_LIGHT,
				fillColor: isDark ? TK.COLORS.PROGRESS_FILL_DARK : TK.COLORS.PROGRESS_FILL_LIGHT,
				markerColor: isDark ? TK.COLORS.PROGRESS_MARKER_DARK : TK.COLORS.PROGRESS_MARKER_LIGHT,
				boldColor: isDark ? TK.COLORS.BOLD_DARK : TK.COLORS.BOLD_LIGHT
			};
		}

		refreshProgressChrome() {
			const { strokeColor, fillColor, markerColor } = this.getProgressChrome();

			const applyBarChrome = (bar, { fillWarn } = {}) => {
				if (!bar) return;
				bar.style.setProperty('--tk-stroke', strokeColor);
				bar.style.setProperty('--tk-fill', fillColor);
				bar.style.setProperty('--tk-fill-warn', fillWarn ?? fillColor);
				bar.style.setProperty('--tk-marker', markerColor);
			};

			applyBarChrome(this.lengthBar, { fillWarn: fillColor });
			applyBarChrome(this.sessionBar, { fillWarn: TK.COLORS.RED_WARNING });
			applyBarChrome(this.weeklyBar, { fillWarn: TK.COLORS.RED_WARNING });
		}

		initialize() {
			// Header container (tokens + cache timer)
			this.headerContainer = document.createElement('div');
			this.headerContainer.className = 'text-text-500 text-xs !px-1 tk-header';

			this.headerDisplay = document.createElement('span');
			this.headerDisplay.className = 'tk-headerItem';

			this.lengthGroup = document.createElement('span');
			this.lengthDisplay = document.createElement('span');
			this.cachedDisplay = document.createElement('span');
			this.cacheTimeSpan = null; // reference to inner time span

			this.messageCountDisplay = document.createElement('span');
			this.messageCountDisplay.className = 'tk-headerItem tk-msgCount';

			this.costEstimateDisplay = document.createElement('span');
			this.costEstimateDisplay.className = 'tk-headerItem tk-costEstimate';

			this.lengthGroup.appendChild(this.lengthDisplay);
			this.headerDisplay.appendChild(this.lengthGroup);

			// Usage line (session + weekly)
			this._initUsageLine();

			this._setupTooltips();
			this._observeDom();
			this._observeTheme();
		}

		_observeTheme() {
			// Watch for theme changes (data-mode attribute on <html>)
			const observer = new MutationObserver(() => this.refreshProgressChrome());
			observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-mode'] });
		}

		_observeDom() {
			// Track pending reattach attempts independently
			let usageReattachPending = false;
			let headerReattachPending = false;

			// A node can be present in the DOM but invisible in a way that's NOT one of the
			// normal, intentional states (no usage data yet -> tk-hidden; no tokens yet ->
			// empty). Only flag it as "gone" when it has real content rendered into it, isn't
			// deliberately tk-hidden, and still isn't visible - that combination means it got
			// orphaned inside a hidden subtree (e.g. toolbar moved under a closed panel), which
			// `document.contains()` alone can't detect since the node is still technically there.
			const isGone = (el) => {
				if (!el || !document.contains(el)) return true;
				if (el.classList?.contains('tk-hidden')) return false;
				if (el.children.length === 0) return false;
				return !isVisible(el);
			};

			this.domObserver = new MutationObserver(() => {
				const usageMissing = !!this.usageLine && isGone(this.usageLine);
				const headerMissing = isGone(this.headerContainer);

				if (usageMissing && !usageReattachPending) {
					usageReattachPending = true;
					TK.waitForElement(TK.DOM.MODEL_SELECTOR_DROPDOWN, 60000).then((el) => {
						usageReattachPending = false;
						if (el) this.attachUsageLine();
					});
				}

				if (headerMissing && !headerReattachPending) {
					headerReattachPending = true;
					TK.waitForElement(TK.DOM.CHAT_MENU_TRIGGER, 60000).then((el) => {
						headerReattachPending = false;
						if (el) this.attachHeader();
					});
				}
			});
			this.domObserver.observe(document.body, { childList: true, subtree: true });
		}

		_initUsageLine() {
			this.usageLine = document.createElement('div');
			this.usageLine.className =
				'text-text-400 text-[11px] tk-usageRow tk-hidden flex flex-row items-center gap-3 w-full';

			this.sessionUsageSpan = document.createElement('span');
			this.sessionUsageSpan.className = 'tk-usageText';

			this.sessionBar = document.createElement('div');
			this.sessionBar.className = 'tk-bar tk-bar--usage';
			this.sessionBarFill = document.createElement('div');
			this.sessionBarFill.className = 'tk-bar__fill';
			this.sessionMarker = document.createElement('div');
			this.sessionMarker.className = 'tk-bar__marker tk-hidden';
			this.sessionMarker.style.left = '0%';
			this.sessionBar.appendChild(this.sessionBarFill);
			this.sessionBar.appendChild(this.sessionMarker);

			this.weeklyUsageSpan = document.createElement('span');
			this.weeklyUsageSpan.className = 'tk-usageText';

			this.weeklyBar = document.createElement('div');
			this.weeklyBar.className = 'tk-bar tk-bar--usage';
			this.weeklyBarFill = document.createElement('div');
			this.weeklyBarFill.className = 'tk-bar__fill';
			this.weeklyMarker = document.createElement('div');
			this.weeklyMarker.className = 'tk-bar__marker tk-hidden';
			this.weeklyMarker.style.left = '0%';
			this.weeklyBar.appendChild(this.weeklyBarFill);
			this.weeklyBar.appendChild(this.weeklyMarker);

			this.sessionGroup = document.createElement('div');
			this.sessionGroup.className = 'tk-usageGroup';
			this.sessionGroup.appendChild(this.sessionUsageSpan);
			this.sessionGroup.appendChild(this.sessionBar);

			this.weeklyGroup = document.createElement('div');
			this.weeklyGroup.className = 'tk-usageGroup tk-usageGroup--weekly';
			this.weeklyGroup.appendChild(this.weeklyBar);
			this.weeklyGroup.appendChild(this.weeklyUsageSpan);

			this.usageLine.appendChild(this.sessionGroup);
			this.usageLine.appendChild(this.weeklyGroup);

			this.refreshProgressChrome();

			this.usageLine.addEventListener('click', async () => {
				if (!this.onUsageRefresh || this.refreshingUsage) return;
				this.refreshingUsage = true;
				this.usageLine.classList.add('tk-usageRow--dim');
				try {
					await this.onUsageRefresh();
				} finally {
					this.usageLine.classList.remove('tk-usageRow--dim');
					this.refreshingUsage = false;
				}
			});
		}

		_setupTooltips() {
			this.lengthTooltip = makeTooltip(
				"Approximate tokens (excludes system prompt).\nEstimated with a stand-in tokenizer, so it may differ from Claude's count (you can calibrate it in settings).\nBecomes invalid after context compaction.\nBar scale: the context window set in Tokka settings."
			);
			setupTooltip(
				this.lengthGroup,
				this.lengthTooltip,
				{ topOffset: 8 }
			);

			setupTooltip(
				this.cachedDisplay,
				makeTooltip("Messages sent while cached are significantly cheaper."),
				{ topOffset: 8 }
			);

			setupTooltip(
				this.sessionGroup,
				makeTooltip("5-hour session window.\nThe bar shows your usage.\nThe line marks where you are in the window."),
				{ topOffset: 8 }
			);

			setupTooltip(
				this.weeklyGroup,
				makeTooltip("7-day usage window.\nThe bar shows your usage.\nThe line marks where you are in the window."),
				{ topOffset: 8 }
			);

			setupTooltip(
				this.messageCountDisplay,
				makeTooltip("Number of messages in the current conversation branch (trunk only)."),
				{ topOffset: 8 }
			);

			this.costTooltip = makeTooltip('Rough estimate only.');
			setupTooltip(this.costEstimateDisplay, this.costTooltip, { topOffset: 8 });
		}

		attach() {
			this.attachHeader();
			this.attachUsageLine();
			this.refreshProgressChrome();
		}

		attachHeader() {
			const chatMenu = document.querySelector(TK.DOM.CHAT_MENU_TRIGGER);
			if (!chatMenu) return;
			const anchor = chatMenu.closest(TK.DOM.CHAT_PROJECT_WRAPPER) || chatMenu.parentElement;
			if (!anchor) return;
			if (anchor.nextElementSibling !== this.headerContainer) {
				anchor.after(this.headerContainer);
			}
			this._renderHeader();
			this.refreshProgressChrome();
		}

		attachUsageLine() {
			if (!this.usageLine) return;
			const modelSelector = document.querySelector(TK.DOM.MODEL_SELECTOR_DROPDOWN);
			if (!modelSelector) return;
			const gridContainer = modelSelector.closest('[data-testid="chat-input-grid-container"]');
			const gridArea = modelSelector.closest('[data-testid="chat-input-grid-area"]');
			// Was previously restricted to `flex-direction: row` only, so a toolbar that
			// reflows to a column (narrow window, sidebar open, etc.) would never match here -
			// it would still fall through to the parentElement-chain fallback below, but that
			// fallback can land on the wrong node. Accepting any flex/inline-flex/grid container
			// with multiple buttons is a much more reliable "this looks like the toolbar" signal,
			// since direction doesn't affect where `.after()` inserts in the DOM.
			const findToolbarRow = (el, stopAt) => {
				let cur = el;
				while (cur && cur !== document.body) {
					if (stopAt && cur === stopAt) break;
					if (cur !== el && cur.nodeType === 1) {
						const style = window.getComputedStyle(cur);
						if (style.display === 'flex' || style.display === 'inline-flex' || style.display === 'grid') {
							const buttons = cur.querySelectorAll('button').length;
							if (buttons > 1) return cur;
						}
					}
					cur = cur.parentElement;
				}
				return null;
			};

			const toolbarRow =
				(gridContainer ? findToolbarRow(modelSelector, gridArea || gridContainer) : null) ||
				findToolbarRow(modelSelector) ||
				modelSelector.parentElement?.parentElement?.parentElement;
			if (!toolbarRow) return;

			// A node can be "in the DOM" but hidden (display:none ancestor, an unrendered
			// portal, etc.) - inserting next to it would make the bar exist without ever
			// being seen, and worse, `document.contains()` would then think it's already
			// attached and stop retrying. Bail out here instead and let the observer in
			// _observeDom() try again on the next DOM mutation.
			if (!isVisible(toolbarRow)) return;

			if (toolbarRow.nextElementSibling !== this.usageLine) {
				toolbarRow.after(this.usageLine);
			}
			this.refreshProgressChrome();
		}

		setPendingCache(pending) {
			this.pendingCache = pending;
			if (this.cacheTimeSpan) {
				if (pending) {
					this.cacheTimeSpan.style.color = '';
				} else {
					const { boldColor } = this.getProgressChrome();
					this.cacheTimeSpan.style.color = boldColor;
				}
			}
		}

		setConversationMetrics(metrics = {}) {
			const { totalTokens, userTokens, assistantTokens, messageCount, cachedUntil, modelFamily } = metrics;
			this.pendingCache = false;
			this.lastMetrics = metrics;

			if (typeof totalTokens !== 'number') {
				this.lengthDisplay.textContent = '';
				this.cachedDisplay.textContent = '';
				this.messageCountDisplay.textContent = '';
				this.costEstimateDisplay.textContent = '';
				this.lastCachedUntilMs = null;
				this._renderHeader();
				return;
			}

			const compact = !!this.settings?.compactMode;
			const pct = Math.max(0, Math.min(100, (totalTokens / (this.settings?.contextLimit || TK.CONST.CONTEXT_LIMIT_TOKENS)) * 100));
			this.lengthDisplay.textContent = compact
				? `~${totalTokens.toLocaleString()}`
				: `~${totalTokens.toLocaleString()} tokens`;

			// Message count (opt-in via settings)
			if (this.settings?.showMessageCount && typeof messageCount === 'number' && messageCount > 0) {
				this.messageCountDisplay.textContent = compact ? `${messageCount}msg` : `${messageCount} msg`;
			} else {
				this.messageCountDisplay.textContent = '';
			}

			// Cost estimate (opt-in via settings) - blends input/output pricing per selected model
			if (
				this.settings?.showCostEstimate &&
				typeof userTokens === 'number' &&
				typeof assistantTokens === 'number'
			) {
				const auto = this.settings.costModel === 'auto';
				const key = auto ? modelFamily || 'sonnet' : this.settings.costModel;
				const table = TK.PRICING?.[key] || TK.PRICING?.sonnet;
				if (table) {
					const cost = (userTokens / 1e6) * table.input + (assistantTokens / 1e6) * table.output;
					const costText = cost < 0.01 && cost > 0 ? '<$0.01' : `$${cost.toFixed(2)}`;
					this.costEstimateDisplay.textContent = `~${costText}`;
					if (this.costTooltip) {
						this.costTooltip.textContent =
							`Rough estimate using ${table.label} list pricing${auto ? (modelFamily ? ' (detected from your chat)' : ' (model not recognised, using Sonnet)') : ''} ` +
							`($${table.input}/M in, $${table.output}/M out).\n` +
							`Ignores prompt caching, tool tokens beyond this trunk, and any discounts.\n` +
							`Verify against the Claude Console for real usage.`;
					}
				} else {
					this.costEstimateDisplay.textContent = '';
				}
			} else {
				this.costEstimateDisplay.textContent = '';
			}

			// Mini bar (hide when full - context is definitely compacted by then)
			const isFull = pct >= 99.5;
			if (isFull) {
				this.lengthDisplay.style.opacity = '0.5';
				this.lengthBar = null;
				this.lengthGroup.replaceChildren(this.lengthDisplay);
				if (this.lengthTooltip) {
					this.lengthTooltip.textContent =
						"Approximate tokens (excludes system prompt).\nEstimated with a stand-in tokenizer, so it may differ from Claude's count (you can calibrate it in settings).\nThis count is invalid after compaction.";
				}
			} else {
				this.lengthDisplay.style.opacity = '';
				const bar = document.createElement('div');
				bar.className = 'tk-bar tk-bar--mini';
				this.lengthBar = bar;
				const fill = document.createElement('div');
				fill.className = 'tk-bar__fill';
				fill.style.width = `${pct}%`;
				bar.appendChild(fill);
				this.refreshProgressChrome();

				const barContainer = document.createElement('span');
				barContainer.className = 'inline-flex items-center';
				barContainer.appendChild(bar);

				this.lengthGroup.replaceChildren(this.lengthDisplay, document.createTextNode('\u00A0\u00A0'), barContainer);
			}

			// Cache timer
			const now = Date.now();
			if (typeof cachedUntil === 'number' && cachedUntil > now) {
				this.lastCachedUntilMs = cachedUntil;
				const secondsLeft = Math.max(0, Math.ceil((cachedUntil - now) / 1000));
				const { boldColor } = this.getProgressChrome();
				this.cacheTimeSpan = Object.assign(document.createElement('span'), {
					className: 'tk-cacheTime',
					textContent: formatSeconds(secondsLeft)
				});
				this.cacheTimeSpan.style.color = boldColor;
				const prefix = compact ? '\u00A0' : 'cached for\u00A0';
				this.cachedDisplay.replaceChildren(document.createTextNode(prefix), this.cacheTimeSpan);
			} else {
				this.lastCachedUntilMs = null;
				this.cacheTimeSpan = null;
				this.cachedDisplay.textContent = '';
			}

			this._renderHeader();
		}

		_renderHeader() {
			this.headerContainer.replaceChildren();

			const hasTokens = !!this.lengthDisplay.textContent;
			const hasCache = !!this.cachedDisplay.textContent;
			const hasMsgCount = !!this.messageCountDisplay.textContent;
			const hasCost = !!this.costEstimateDisplay.textContent;

			if (!hasTokens) return;

			const extras = [];
			if (hasMsgCount) extras.push(this.messageCountDisplay);
			if (hasCost) extras.push(this.costEstimateDisplay);

			if (hasCache) {
				const gap = this.lengthBar ? '\u00A0\u00A0' : '\u00A0';
				this.headerDisplay.replaceChildren(
					this.lengthGroup,
					document.createTextNode(gap),
					this.cachedDisplay
				);
			} else {
				this.headerDisplay.replaceChildren(this.lengthGroup);
			}

			for (const el of extras) {
				this.headerDisplay.appendChild(document.createTextNode('\u00A0\u00A0\u00B7\u00A0\u00A0'));
				this.headerDisplay.appendChild(el);
			}

			this.headerContainer.appendChild(this.headerDisplay);
		}

		setUsage(usage) {
			this.lastUsage = usage;
			this.refreshProgressChrome();
			const compact = !!this.settings?.compactMode;
			const warnAt = typeof this.settings?.warnThreshold === 'number' ? this.settings.warnThreshold : 90;
			const alertsOn = !!this.settings?.nearLimitAlert;
			this._pulseState = this._pulseState || {};
			this._pulseState.session = this._pulseState.session || {};
			this._pulseState.weekly = this._pulseState.weekly || {};

			const session = usage?.five_hour || null;
			const weekly = usage?.seven_day || null;
			const hasAnyUsage =
				!!(session && typeof session.utilization === 'number') || !!(weekly && typeof weekly.utilization === 'number');
			this.usageLine?.classList.toggle('tk-hidden', !hasAnyUsage);

			if (session && typeof session.utilization === 'number') {
				const rawPct = session.utilization;
				const pct = Math.round(rawPct * 10) / 10;
				this.sessionResetMs = session.resets_at ? Date.parse(session.resets_at) : null;
				this.sessionWindowStartMs = this.sessionResetMs ? this.sessionResetMs - 5 * 60 * 60 * 1000 : null;
				const resetText = this.sessionResetMs ? ` · resets in ${formatResetCountdown(this.sessionResetMs)}` : '';
				const etaText = TK.burn?.etaText?.() || '';
				this.sessionUsageSpan.textContent = compact ? `${pct}%` : `Session: ${pct}%${resetText}${etaText}`;

				const width = Math.max(0, Math.min(100, rawPct));
				const isWarn = width >= warnAt;
				this.sessionBarFill.style.width = `${width}%`;
				this.sessionBarFill.classList.toggle('tk-warn', isWarn);
				this.sessionBarFill.classList.toggle('tk-full', width >= 99.5);
				TK.pulseOnWarnCross?.(this.sessionBarFill, isWarn, this._pulseState.session, alertsOn);

				TK.updateBadge?.({
					enabled: this.settings?.badgeEnabled,
					pct: width,
					warnAt,
					accent: TK.COLORS.PROGRESS_FILL_LIGHT,
					title: `Tokka — Session ${pct}% used${resetText}${etaText}`
				});
			} else {
				this.sessionUsageSpan.textContent = '';
				this.sessionBarFill.style.width = '0%';
				this.sessionBarFill.classList.remove('tk-warn', 'tk-full');
				this.sessionResetMs = null;
				this.sessionWindowStartMs = null;
				TK.updateBadge?.({ enabled: false });
			}

			const hasWeekly = weekly && typeof weekly.utilization === 'number';
			this.weeklyGroup?.classList.toggle('tk-hidden', !hasWeekly);
			this.sessionGroup?.classList.toggle('tk-usageGroup--single', !hasWeekly);

			if (hasWeekly) {
				this.weeklyUsageSpan.classList.remove('tk-hidden');
				this.weeklyBar.classList.remove('tk-hidden');

				const rawPct = weekly.utilization;
				const pct = Math.round(rawPct * 10) / 10;
				this.weeklyResetMs = weekly.resets_at ? Date.parse(weekly.resets_at) : null;
				this.weeklyWindowStartMs = this.weeklyResetMs ? this.weeklyResetMs - 7 * 24 * 60 * 60 * 1000 : null;
				const resetText = this.weeklyResetMs ? ` · resets in ${formatResetCountdown(this.weeklyResetMs)}` : '';
				this.weeklyUsageSpan.textContent = compact ? `${pct}%` : `Weekly: ${pct}%${resetText}`;

				const width = Math.max(0, Math.min(100, rawPct));
				const isWarn = width >= warnAt;
				this.weeklyBarFill.style.width = `${width}%`;
				this.weeklyBarFill.classList.toggle('tk-warn', isWarn);
				this.weeklyBarFill.classList.toggle('tk-full', width >= 99.5);
				TK.pulseOnWarnCross?.(this.weeklyBarFill, isWarn, this._pulseState.weekly, alertsOn);
			} else {
				this.weeklyUsageSpan.classList.add('tk-hidden');
				this.weeklyBar.classList.add('tk-hidden');
				this.weeklyResetMs = null;
				this.weeklyWindowStartMs = null;
				this.weeklyBarFill.classList.remove('tk-warn', 'tk-full');
			}

			this._updateMarkers();
		}

		_updateMarkers() {
			const now = Date.now();

			if (this.sessionMarker && this.sessionWindowStartMs && this.sessionResetMs) {
				const total = this.sessionResetMs - this.sessionWindowStartMs;
				const elapsed = Math.max(0, Math.min(total, now - this.sessionWindowStartMs));
				const ratio = total > 0 ? elapsed / total : 0;
				const pct = Math.max(0, Math.min(100, ratio * 100));
				this.sessionMarker.classList.remove('tk-hidden');
				this.sessionMarker.style.left = `${pct}%`;
			} else if (this.sessionMarker) {
				this.sessionMarker.classList.add('tk-hidden');
			}

			if (this.weeklyMarker && this.weeklyWindowStartMs && this.weeklyResetMs) {
				const total = this.weeklyResetMs - this.weeklyWindowStartMs;
				const elapsed = Math.max(0, Math.min(total, now - this.weeklyWindowStartMs));
				const ratio = total > 0 ? elapsed / total : 0;
				const pct = Math.max(0, Math.min(100, ratio * 100));
				this.weeklyMarker.classList.remove('tk-hidden');
				this.weeklyMarker.style.left = `${pct}%`;
			} else if (this.weeklyMarker) {
				this.weeklyMarker.classList.add('tk-hidden');
			}
		}

		tick() {
			// Cache countdown
			const now = Date.now();
			if (this.lastCachedUntilMs && this.lastCachedUntilMs > now) {
				const secondsLeft = Math.max(0, Math.ceil((this.lastCachedUntilMs - now) / 1000));
				if (this.cacheTimeSpan) {
					this.cacheTimeSpan.textContent = formatSeconds(secondsLeft);
				}
			} else if (this.lastCachedUntilMs && this.lastCachedUntilMs <= now) {
				this.lastCachedUntilMs = null;
				this.cacheTimeSpan = null;
				this.pendingCache = false;
				this.cachedDisplay.textContent = '';
				this._renderHeader();
			}

			// Reset countdown text + time markers
			if (this.sessionResetMs && this.sessionUsageSpan?.textContent) {
				const idx = this.sessionUsageSpan.textContent.indexOf('· resets in');
				if (idx !== -1) {
					const prefix = this.sessionUsageSpan.textContent.slice(0, idx + '· resets in '.length);
					this.sessionUsageSpan.textContent = `${prefix}${formatResetCountdown(this.sessionResetMs)}`;
				}
			}

			if (this.weeklyResetMs && this.weeklyUsageSpan?.textContent) {
				const idx = this.weeklyUsageSpan.textContent.indexOf('· resets in');
				if (idx !== -1) {
					const prefix = this.weeklyUsageSpan.textContent.slice(0, idx + '· resets in '.length);
					this.weeklyUsageSpan.textContent = `${prefix}${formatResetCountdown(this.weeklyResetMs)}`;
				}
			}

			this._updateMarkers();
		}
	}

	TK.ui = {
		CounterUI
	};
})();
