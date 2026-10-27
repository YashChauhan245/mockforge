import { MockForgeMessage, MOCKFORGE_SOURCE } from '../types/messages';
import { InterceptedRequest } from '../types/rule';

console.log('[MockForge Service Worker] Initialized.');

const MAX_LOGS = 100;
const STORAGE_KEY_LOGS = 'mockforge_request_logs';

let inMemoryLogs: InterceptedRequest[] = [];

// Initialize memory buffer from session storage if service worker wakes up
async function loadLogsFromSessionStorage(): Promise<void> {
  try {
    if (chrome.storage?.session) {
      const data = await chrome.storage.session.get(STORAGE_KEY_LOGS);
      if (Array.isArray(data[STORAGE_KEY_LOGS])) {
        inMemoryLogs = data[STORAGE_KEY_LOGS];
        updateBadge(inMemoryLogs.length);
      }
    }
  } catch (err) {
    console.warn('[MockForge] Failed to load session logs:', err);
  }
}

// Persist logs in session storage (cleared when browser session ends)
async function persistLogs(): Promise<void> {
  try {
    if (chrome.storage?.session) {
      await chrome.storage.session.set({ [STORAGE_KEY_LOGS]: inMemoryLogs });
    }
  } catch (err) {
    console.warn('[MockForge] Failed to persist session logs:', err);
  }
}

function updateBadge(count: number): void {
  try {
    const text = count > 0 ? (count > 99 ? '99+' : String(count)) : '';
    chrome.action.setBadgeText({ text });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' }); // Indigo accent
  } catch {
    // Non-critical
  }
}

// Load existing logs on startup
loadLogsFromSessionStorage();

// Configure Chrome Side Panel to open when clicking the extension icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[MockForge] Failed to configure side panel behavior:', error));

// Central Event Bus routing
chrome.runtime.onMessage.addListener((message: MockForgeMessage, sender, sendResponse) => {
  if (!message || message.source !== MOCKFORGE_SOURCE) return;

  if (message.type === 'PING') {
    console.log('[MockForge Service Worker] Received PING from tab:', sender.tab?.url);
    sendResponse({ status: 'PONG', receivedAt: Date.now() });
    return true;
  }

  if (message.type === 'REQUEST_INTERCEPTED') {
    // Prepend to beginning of list (newest first)
    inMemoryLogs.unshift(message.payload);
    if (inMemoryLogs.length > MAX_LOGS) {
      inMemoryLogs = inMemoryLogs.slice(0, MAX_LOGS);
    }

    updateBadge(inMemoryLogs.length);
    persistLogs();

    sendResponse({ status: 'RECORDED', id: message.payload.id });
    return true;
  }

  if (message.type === 'GET_REQUEST_LOGS') {
    sendResponse({ logs: inMemoryLogs });
    return true;
  }

  if (message.type === 'CLEAR_REQUEST_LOGS') {
    inMemoryLogs = [];
    updateBadge(0);
    persistLogs();
    sendResponse({ success: true });
    return true;
  }

  return true;
});
