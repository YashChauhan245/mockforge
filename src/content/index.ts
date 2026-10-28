import { MOCKFORGE_SOURCE, MockForgeMessage, RulesUpdatedMessage } from '../types/messages';

console.log('%c[MockForge ⚒️]%c Content script bridge active in Isolated World.', 'color: #10b981; font-weight: bold;', 'color: #94a3b8;');

// Inject the main-world interceptor script into the host webpage
function injectScript() {
  try {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('src/injected/index.ts');
    script.type = 'module';
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => script.remove();
  } catch (error) {
    console.error('[MockForge] Failed to inject interceptor script:', error);
  }
}

injectScript();

// ─────────────────────────────────────────────────────────────
// 1. Listen for messages emitted from the page's MAIN world
// ─────────────────────────────────────────────────────────────
window.addEventListener('message', (event) => {
  // Only accept events from current window with MockForge source
  if (event.source !== window) return;
  if (!event.data || event.data.source !== MOCKFORGE_SOURCE) return;

  const message = event.data as MockForgeMessage;

  // If Main World is requesting rules on startup, query background worker
  if (message.type === 'GET_RULES') {
    chrome.runtime.sendMessage(message, (response) => {
      if (response && response.type === 'RULES_UPDATED') {
        window.postMessage(response, '*');
      }
    });
    return;
  }

  // Forward request logs and metrics to Background Service Worker
  chrome.runtime.sendMessage(message).catch(() => {
    // Background worker may be asleep, safe to ignore transient errors
  });
});

// ─────────────────────────────────────────────────────────────
// 2. Listen for messages from Background Worker / Side Panel
// ─────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message: MockForgeMessage) => {
  if (!message || message.source !== MOCKFORGE_SOURCE) return;

  // Forward rule updates down into the MAIN execution context
  if (message.type === 'RULES_UPDATED' || message.type === 'SET_GLOBAL_ENABLED') {
    window.postMessage(message, '*');
  }
});
