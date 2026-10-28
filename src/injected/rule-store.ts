import { MockRule } from '../types/rule';
import { MOCKFORGE_SOURCE, MockForgeMessage } from '../types/messages';
import { findMatchingRule } from './matcher';

let cachedRules: MockRule[] = [];
let isGlobalEnabled: boolean = true;

/**
 * Initializes the rule store in the webpage's MAIN execution context.
 * Subscribes to window.postMessage events to keep rules updated in real-time.
 */
export function initRuleStore(): void {
  // Listen for rule updates forwarded from Content Script
  window.addEventListener('message', (event) => {
    if (event.source !== window || !event.data || event.data.source !== MOCKFORGE_SOURCE) {
      return;
    }

    const message = event.data as MockForgeMessage;

    if (message.type === 'RULES_UPDATED') {
      cachedRules = message.rules || [];
      isGlobalEnabled = message.globalEnabled !== false;
      console.log(
        `%c[MockForge ⚒️]%c Rules synced: ${cachedRules.length} rules (Global: ${isGlobalEnabled ? 'ON' : 'OFF'})`,
        'color: #6366f1; font-weight: bold;',
        'color: #94a3b8;'
      );
    }
  });

  // Request latest saved rules from Content Script / Storage on initialization
  window.postMessage(
    {
      source: MOCKFORGE_SOURCE,
      type: 'GET_RULES',
    },
    '*'
  );
}

/**
 * Updates the in-memory rule cache directly.
 */
export function setCachedRules(rules: MockRule[], enabled: boolean = true): void {
  cachedRules = rules;
  isGlobalEnabled = enabled;
}

/**
 * Finds a matching mock rule for a given URL and method from the current cache.
 */
export function getMatchingRule(url: string, method: string): MockRule | null {
  return findMatchingRule(url, method, cachedRules, isGlobalEnabled);
}

/**
 * Returns current rule store status.
 */
export function getRuleStoreState(): { rules: MockRule[]; globalEnabled: boolean } {
  return {
    rules: cachedRules,
    globalEnabled: isGlobalEnabled,
  };
}
