import { MOCKFORGE_SOURCE, MockForgeMessage } from '../types/messages';

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

// Listen for messages emitted from the page's MAIN world
window.addEventListener('message', (event) => {
  // Only accept events from the current window and matching our source identifier
  if (event.source !== window) return;
  if (!event.data || event.data.source !== MOCKFORGE_SOURCE) return;

  const message = event.data as MockForgeMessage;

  // Forward message to the extension's Background Service Worker
  chrome.runtime.sendMessage(message).catch((err) => {
    // Service worker may be asleep, safe to ignore transient errors
  });
});
