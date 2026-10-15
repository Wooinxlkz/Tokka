'use strict';

// Content scripts can't touch chrome.action directly (MV3), so they message this
// worker, which sets the badge scoped to the sending tab. Keeps every tab's badge
// independent (e.g. one claude.ai tab at 40%, another at 90%).
// MV3 chrome.action.* return promises. When a tab closes between the message and the call,
// the promise rejects ("No tab with id") and a try/catch can't see it, so swallow it here.
const quiet = (p) => {
	if (p && typeof p.catch === 'function') p.catch(() => {});
};

chrome.runtime.onMessage.addListener((message, sender) => {
	if (!message || message.type !== 'tk:badge') return;
	const tabId = sender?.tab?.id;
	if (typeof tabId !== 'number') return;

	try {
		quiet(chrome.action.setBadgeText({ tabId, text: message.text || '' }));
		if (message.color) {
			quiet(chrome.action.setBadgeBackgroundColor({ tabId, color: message.color }));
		}
		if (message.title) {
			quiet(chrome.action.setTitle({ tabId, title: message.title }));
		}
	} catch {
		// tab may have closed between message send and handling - ignore
	}
});

// Clear the badge when a tab navigates away, so a stale % doesn't linger on a new page.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
	if (changeInfo.status !== 'loading') return;
	try {
		quiet(chrome.action.setBadgeText({ tabId, text: '' }));
		quiet(chrome.action.setTitle({ tabId, title: 'Tokka' }));
	} catch {
		// ignore
	}
});
