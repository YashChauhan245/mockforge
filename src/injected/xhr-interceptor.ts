import { InterceptedRequest } from '../types/rule';
import { MOCKFORGE_SOURCE } from '../types/messages';

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
 * Parses raw XHR response headers string (separated by CRLF) into a key-value map.
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
 * Safely extracts XHR response payload without triggering InvalidStateError
 * when responseType is 'json', 'blob', or 'arraybuffer'.
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
    // Non-critical; some browsers restrict response access on abort or early states
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
    if (typeof Document !== 'undefined' && body instanceof Document) {
      return '[XML Document]';
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
 * to intercept and inspect legacy AJAX, Axios, and jQuery requests.
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

  // 3. Monkey-patch send() to capture request payload and listen for completion
  XMLHttpRequest.prototype.send = function (
    this: XMLHttpRequest,
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    const xhr = this as MockForgeXHR;
    xhr._mockforgeBody = extractRequestBody(body);
    xhr._mockforgeStartTime = performance.now();
    xhr._mockforgeTimestamp = Date.now();

    // Attach loadend event listener to capture finished or failed request
    const handleLoadEnd = () => {
      const durationMs = Math.round(
        performance.now() - (xhr._mockforgeStartTime || performance.now())
      );
      const responseHeaders = parseResponseHeaders(xhr.getAllResponseHeaders());
      const responseBody = extractXhrResponseBody(xhr);

      emitInterceptedRequest({
        id: xhr._mockforgeId || generateId(),
        url: xhr._mockforgeUrl || window.location.href,
        method: xhr._mockforgeMethod || 'GET',
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

    // loadend is guaranteed to fire when request finishes (load, error, timeout, abort)
    this.addEventListener('loadend', handleLoadEnd, { once: true });

    try {
      return originalSend.apply(this, [body]);
    } catch (error) {
      const durationMs = Math.round(
        performance.now() - (xhr._mockforgeStartTime || performance.now())
      );

      emitInterceptedRequest({
        id: xhr._mockforgeId || generateId(),
        url: xhr._mockforgeUrl || window.location.href,
        method: xhr._mockforgeMethod || 'GET',
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

  console.log('%c[MockForge ⚒️]%c XMLHttpRequest prototype monkey-patch installed successfully.', 'color: #6366f1; font-weight: bold;', 'color: #94a3b8;');
}
