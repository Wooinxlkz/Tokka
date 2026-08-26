'use strict';

// Content scripts can't touch chrome.action directly (MV3), so they message this
// worker, which sets the badge scoped to the sending tab. Keeps every tab's badge
// independent (e.g. one claude.ai tab at 40%, another at 90%).
chrome.runtime.onMessage.addListener((message, sender) => {
	if (!message || message.type !== 'tk:badge') return;
	const tabId = sender?.tab?.id;
	if (typeof tabId !== 'number') return;

	try {
		chrome.action.setBadgeText({ tabId, text: message.text || '' });
		if (message.color) {
			chrome.action.setBadgeBackgroundColor({ tabId, color: message.color });
		}
		if (message.title) {
			chrome.action.setTitle({ tabId, title: message.title });
		}
	} catch {
		// tab may have closed between message send and handling - ignore
	}
});

// Clear the badge when a tab navigates away, so a stale % doesn't linger on a new page.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
	if (changeInfo.status !== 'loading') return;
	try {
		chrome.action.setBadgeText({ tabId, text: '' });
		chrome.action.setTitle({ tabId, title: 'Tokka' });
	} catch {
		// ignore
	}
});
