import { MockForgeMessage, MOCKFORGE_SOURCE } from '../types/messages';

console.log('[MockForge Service Worker] Initialized.');

// Configure Chrome Side Panel to open when clicking the extension icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[MockForge] Failed to configure side panel behavior:', error));

// Listen for incoming messages from content scripts or side panel
chrome.runtime.onMessage.addListener((message: MockForgeMessage, sender, sendResponse) => {
  if (!message || message.source !== MOCKFORGE_SOURCE) return;

  if (message.type === 'PING') {
    console.log('[MockForge Service Worker] Received PING from tab:', sender.tab?.url);
    sendResponse({ status: 'PONG', receivedAt: Date.now() });
  }

  return true; // Keep message channel open for async response
});
