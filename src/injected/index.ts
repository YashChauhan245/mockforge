import { MOCKFORGE_SOURCE } from '../types/messages';
import { setupFetchInterceptor } from './fetch-interceptor';

console.log('%c[MockForge ⚒️]%c Main world interceptor engine initialized.', 'color: #6366f1; font-weight: bold;', 'color: #94a3b8;');

// Initialize fetch interceptor
setupFetchInterceptor();

// Dispatch initial ping across the event bus
window.postMessage(
  {
    source: MOCKFORGE_SOURCE,
    type: 'PING',
    timestamp: Date.now(),
  },
  '*'
);

