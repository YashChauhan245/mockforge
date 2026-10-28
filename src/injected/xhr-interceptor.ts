import { InterceptedRequest } from '../types/rule';
import { MOCKFORGE_SOURCE } from '../types/messages';
import { getMatchingRule } from './rule-store';

interface MockForgeXHR extends XMLHttpRequest {
  _mockforgeId?: string;
  _mockforgeUrl?: string;
  _mockforgeMethod?: string;
  _mockforgeHeaders?: Record<string, string>;
  _mockforgeBody?: string;
  _mockforgeStartTime?: number;
  _mockforgeTimestamp?: number;
}

/**
 * Standard HTTP status text mapping.
 */
function getStatusText(statusCode: number): string {
  const map: Record<number, string> = {
    200: 'OK',
    201: 'Created',
    202: 'Accepted',
    204: 'No Content',
    301: 'Moved Permanently',
    302: 'Found',
    400: 'Bad Request',
    401: 'Unauthorized',
    403: 'Forbidden',
    404: 'Not Found',
    500: 'Internal Server Error',
    502: 'Bad Gateway',
    503: 'Service Unavailable',
  };
  return map[statusCode] || 'Mocked Response';
}

/**
 * Resolves relative URLs to absolute URLs using window.location.
 */
function resolveUrl(url: string | URL): string {
  try {
    return new URL(url.toString(), window.location.href).href;
  } catch {
    return url.toString();
  }
}

/**
 * Parses raw XHR response headers string into a key-value map.
 */
function parseResponseHeaders(rawHeaders: string | null): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!rawHeaders) return headers;

  const lines = rawHeaders.trim().split(/[\r\n]+/);
  for (const line of lines) {
    const parts = line.split(': ');
    const key = parts.shift();
    const value = parts.join(': ');
    if (key) {
      headers[key.toLowerCase()] = value;
    }
  }
  return headers;
}

/**
 * Safely extracts XHR response payload without triggering InvalidStateError.
 */
function extractXhrResponseBody(xhr: XMLHttpRequest): string | undefined {
  try {
    const responseType = xhr.responseType;
    if (responseType === '' || responseType === 'text') {
      return xhr.responseText;
    }
    if (responseType === 'json') {
      return typeof xhr.response === 'object'
        ? JSON.stringify(xhr.response)
        : String(xhr.response);
    }
    if (responseType === 'blob' && xhr.response instanceof Blob) {
      return `[Blob: ${xhr.response.type || 'unknown'}, size: ${xhr.response.size} bytes]`;
    }
    if (responseType === 'arraybuffer' && xhr.response instanceof ArrayBuffer) {
      return `[ArrayBuffer: ${xhr.response.byteLength} bytes]`;
    }
    if (xhr.response) {
      return String(xhr.response);
    }
  } catch {
    // Non-critical
  }
  return undefined;
}

/**
 * Safely serializes arbitrary request body payloads.
 */
function extractRequestBody(body: Document | XMLHttpRequestBodyInit | null | undefined): string | undefined {
  try {
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
 * Generates unique request ID.
 */
function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'req_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

/**
 * Broadcasts intercepted XHR event across the window event bus.
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
 * Monkey-patches XMLHttpRequest prototype methods (open, setRequestHeader, send)
 * to support traffic inspection and mock short-circuiting.
 */
export function setupXhrInterceptor(): void {
  if (typeof window === 'undefined' || !window.XMLHttpRequest) return;
  if ((window as any).__MOCKFORGE_XHR_PATCHED__) return;

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
  const originalSend = XMLHttpRequest.prototype.send;

  (window as any).__MOCKFORGE_XHR_PATCHED__ = true;
  (window as any).__MOCKFORGE_ORIGINAL_XHR_OPEN__ = originalOpen;
  (window as any).__MOCKFORGE_ORIGINAL_XHR_SEND__ = originalSend;

  // 1. Monkey-patch open() to capture HTTP method and target URL
  XMLHttpRequest.prototype.open = function (
    this: XMLHttpRequest,
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ) {
    const xhr = this as MockForgeXHR;
    xhr._mockforgeId = generateId();
    xhr._mockforgeMethod = (method || 'GET').toUpperCase();
    xhr._mockforgeUrl = resolveUrl(url);
    xhr._mockforgeHeaders = {};

    return originalOpen.apply(this, [
      method,
      url,
      async !== false,
      username ?? null,
      password ?? null,
    ]);
  } as typeof XMLHttpRequest.prototype.open;

  // 2. Monkey-patch setRequestHeader() to record outgoing headers
  XMLHttpRequest.prototype.setRequestHeader = function (
    this: XMLHttpRequest,
    name: string,
    value: string
  ) {
    const xhr = this as MockForgeXHR;
    if (!xhr._mockforgeHeaders) {
      xhr._mockforgeHeaders = {};
    }
    xhr._mockforgeHeaders[name] = value;

    return originalSetRequestHeader.apply(this, [name, value]);
  };

  // 3. Monkey-patch send() to capture request payload and handle mock short-circuiting
  XMLHttpRequest.prototype.send = function (
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    const xhr = this as MockForgeXHR;
    xhr._mockforgeBody = extractRequestBody(body);
    xhr._mockforgeStartTime = performance.now();
    xhr._mockforgeTimestamp = Date.now();

    const url = xhr._mockforgeUrl || window.location.href;
    const method = xhr._mockforgeMethod || 'GET';

    // ─────────────────────────────────────────────────────────────
    // Check for Active Mock Rule Short-Circuiting
    // ─────────────────────────────────────────────────────────────
    const matchedRule = getMatchingRule(url, method);

    if (matchedRule) {
      console.log(
        `%c[MockForge ⚒️ XHR SHORT-CIRCUIT]%c Mocking ${method} ${url} -> Status ${matchedRule.statusCode}`,
        'color: #10b981; font-weight: bold;',
        'color: #38bdf8;'
      );

      const delayMs = matchedRule.delayMs || 0;
      const responseBody = matchedRule.responseBody || '{}';
      const statusCode = matchedRule.statusCode || 200;
      const statusText = getStatusText(statusCode);

      const responseHeaders: Record<string, string> = {
        'content-type': 'application/json',
        'x-mockforge-forged': 'true',
        ...(matchedRule.responseHeaders || {}),
      };

      const headerString = Object.entries(responseHeaders)
        .map(([k, v]) => `${k}: ${v}\r\n`)
        .join('');

      // Override properties on the XHR instance to return synthetic response
      Object.defineProperty(xhr, 'readyState', { value: 4, writable: false });
      Object.defineProperty(xhr, 'status', { value: statusCode, writable: false });
      Object.defineProperty(xhr, 'statusText', { value: statusText, writable: false });
      Object.defineProperty(xhr, 'responseText', { value: responseBody, writable: false });

      // Handle response property according to responseType
      Object.defineProperty(xhr, 'response', {
        get: () => {
          if (xhr.responseType === 'json') {
            try {
              return JSON.parse(responseBody);
            } catch {
              return null;
            }
          }
          return responseBody;
        },
      });

      // Override header retrieval methods
      xhr.getAllResponseHeaders = () => headerString;
      xhr.getResponseHeader = (name: string) => responseHeaders[name.toLowerCase()] || null;

      // Asynchronously trigger completion events to simulate network round-trip
      setTimeout(() => {
        const durationMs = Math.round(
          performance.now() - (xhr._mockforgeStartTime || performance.now())
        );

        // Emit log to Side Panel
        emitInterceptedRequest({
          id: xhr._mockforgeId || generateId(),
          url,
          method,
          statusCode,
          statusText,
          durationMs,
          isMocked: true,
          matchedRuleId: matchedRule.id,
          requestHeaders: xhr._mockforgeHeaders || {},
          requestBody: xhr._mockforgeBody,
          responseHeaders,
          responseBody,
          timestamp: xhr._mockforgeTimestamp || Date.now(),
        });

        // Dispatch standard XHR event lifecycle
        xhr.dispatchEvent(new Event('readystatechange'));
        xhr.onreadystatechange?.(new Event('readystatechange') as any);

        xhr.dispatchEvent(new ProgressEvent('load'));
        xhr.onload?.(new ProgressEvent('load') as any);

        xhr.dispatchEvent(new ProgressEvent('loadend'));
        xhr.onloadend?.(new ProgressEvent('loadend') as any);
      }, delayMs);

      // Return immediately without invoking native originalSend
      return;
    }

    // ─────────────────────────────────────────────────────────────
    // Pass-Through Request (No Rule Matched)
    // ─────────────────────────────────────────────────────────────
    const handleLoadEnd = () => {
      const durationMs = Math.round(
        performance.now() - (xhr._mockforgeStartTime || performance.now())
      );
      const responseHeaders = parseResponseHeaders(xhr.getAllResponseHeaders());
      const responseBody = extractXhrResponseBody(xhr);

      emitInterceptedRequest({
        id: xhr._mockforgeId || generateId(),
        url,
        method,
        statusCode: xhr.status,
        statusText: xhr.statusText || (xhr.status === 0 ? 'Network Error' : undefined),
        durationMs,
        isMocked: false,
        requestHeaders: xhr._mockforgeHeaders || {},
        requestBody: xhr._mockforgeBody,
        responseHeaders,
        responseBody,
        timestamp: xhr._mockforgeTimestamp || Date.now(),
      });
    };

    this.addEventListener('loadend', handleLoadEnd, { once: true });

    try {
      return originalSend.apply(this, [body]);
    } catch (error) {
      const durationMs = Math.round(
        performance.now() - (xhr._mockforgeStartTime || performance.now())
      );

      emitInterceptedRequest({
        id: xhr._mockforgeId || generateId(),
        url,
        method,
        statusCode: 0,
        statusText: error instanceof Error ? error.message : 'XHR Send Error',
        durationMs,
        isMocked: false,
        requestHeaders: xhr._mockforgeHeaders || {},
        requestBody: xhr._mockforgeBody,
        responseHeaders: {},
        responseBody: undefined,
        timestamp: xhr._mockforgeTimestamp || Date.now(),
      });

      throw error;
    }
  };

  console.log('%c[MockForge ⚒️]%c XMLHttpRequest interceptor and mocking engine installed.', 'color: #6366f1; font-weight: bold;', 'color: #94a3b8;');
}
