import { MOCKFORGE_SOURCE } from '../types/messages';

console.log('%c[MockForge ⚒️]%c Main world interceptor engine initialized.', 'color: #6366f1; font-weight: bold;', 'color: #94a3b8;');

// Dispatch initial ping across the event bus
window.postMessage(
  {
    source: MOCKFORGE_SOURCE,
    type: 'PING',
    timestamp: Date.now(),
  },
  '*'
);
