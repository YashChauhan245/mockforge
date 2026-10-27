import { InterceptedRequest } from '../types/rule';
import { MOCKFORGE_SOURCE } from '../types/messages';

/**
 * Extracts a normalized string URL from various fetch input types (string, URL, Request).
 */
function extractUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  if (typeof Request !== 'undefined' && input instanceof Request) return input.url;
  return String(input);
}

/**
 * Extracts HTTP method, defaulting to 'GET'.
 */
function extractMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof Request !== 'undefined' && input instanceof Request && input.method) {
    return input.method.toUpperCase();
  }
  return 'GET';
}

/**
 * Extracts request headers into a plain key-value dictionary.
 */
function extractHeaders(input: RequestInfo | URL, init?: RequestInit): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    const rawHeaders =
      init?.headers ||
      (typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined);

    if (rawHeaders) {
      const h = new Headers(rawHeaders);
      h.forEach((value, key) => {
        headers[key] = value;
      });
    }
  } catch {
    // Non-critical; fallback to empty headers if Headers parsing fails
  }
  return headers;
}

/**
 * Safely extracts request body if available and serializable.
 */
function extractRequestBody(input: RequestInfo | URL, init?: RequestInit): string | undefined {
  try {
    const body = init?.body;
    if (!body) return undefined;
    if (typeof body === 'string') return body;
    if (body instanceof URLSearchParams) return body.toString();
    if (typeof FormData !== 'undefined' && body instanceof FormData) return '[FormData]';
    if (typeof Blob !== 'undefined' && body instanceof Blob) {
      return `[Blob: ${body.type || 'unknown'}, size: ${body.size} bytes]`;
    }
    if (typeof ArrayBuffer !== 'undefined' && (body instanceof ArrayBuffer || ArrayBuffer.isView(body))) {
      return '[Binary Data]';
    }
    return String(body);
  } catch {
    return undefined;
  }
}

/**
 * Extracts response headers into a plain key-value dictionary.
 */
function extractResponseHeaders(response: Response): Record<string, string> {
  const headers: Record<string, string> = {};
  try {
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
  } catch {
    // Non-critical
  }
  return headers;
}

/**
 * Generates a unique request identifier using crypto.randomUUID or fallback.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'req_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

/**
 * Dispatches an intercepted request event through the window message bus to Content Script.
 */
function emitInterceptedRequest(requestData: InterceptedRequest): void {
  window.postMessage(
    {
      source: MOCKFORGE_SOURCE,
      type: 'REQUEST_INTERCEPTED',
      payload: requestData,
    },
    '*'
  );
}

/**
 * Monkey-patches window.fetch to inspect and stream request/response traffic.
 * Uses response.clone() to prevent consuming the webpage's readable body stream.
 */
export function setupFetchInterceptor(): void {
  if (typeof window === 'undefined' || !window.fetch) return;
  if ((window as any).__MOCKFORGE_FETCH_PATCHED__) return;

  const originalFetch = window.fetch;
  (window as any).__MOCKFORGE_FETCH_PATCHED__ = true;
  (window as any).__MOCKFORGE_ORIGINAL_FETCH__ = originalFetch;

  window.fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    const requestId = generateId();
    const url = extractUrl(input);
    const method = extractMethod(input, init);
    const requestHeaders = extractHeaders(input, init);
    const requestBody = extractRequestBody(input, init);
    const timestamp = Date.now();
    const startTime = performance.now();

    try {
      const response = await originalFetch.apply(this, [input, init]);
      const durationMs = Math.round(performance.now() - startTime);
      const responseHeaders = extractResponseHeaders(response);

      // Clone the response stream to safely read the payload without draining the application's stream
      const clonedResponse = response.clone();

      clonedResponse
        .text()
        .then((bodyText) => {
          emitInterceptedRequest({
            id: requestId,
            url,
            method,
            statusCode: response.status,
            statusText: response.statusText,
            durationMs,
            isMocked: false,
            requestHeaders,
            requestBody,
            responseHeaders,
            responseBody: bodyText,
            timestamp,
          });
        })
        .catch(() => {
          // If reading cloned stream fails, still emit basic request metrics
          emitInterceptedRequest({
            id: requestId,
            url,
            method,
            statusCode: response.status,
            statusText: response.statusText,
            durationMs,
            isMocked: false,
            requestHeaders,
            requestBody,
            responseHeaders,
            responseBody: undefined,
            timestamp,
          });
        });

      return response;
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);

      // Emit failed network request
      emitInterceptedRequest({
        id: requestId,
        url,
        method,
        statusCode: 0,
        statusText: error instanceof Error ? error.message : 'Network Error',
        durationMs,
        isMocked: false,
        requestHeaders,
        requestBody,
        responseHeaders: {},
        responseBody: undefined,
        timestamp,
      });

      // Always rethrow error to preserve native application promise rejection semantics
      throw error;
    }
  };

  console.log('%c[MockForge ⚒️]%c window.fetch monkey-patch installed successfully.', 'color: #6366f1; font-weight: bold;', 'color: #94a3b8;');
}
