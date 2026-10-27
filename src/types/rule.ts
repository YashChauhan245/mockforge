export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ALL';

export interface MockRule {
  id: string;
  name: string;
  enabled: boolean;
  urlPattern: string;
  method: HttpMethod;
  statusCode: number;
  delayMs: number;
  failureRate: number; // 0 to 100 percentage
  responseHeaders: Record<string, string>;
  responseBody: string; // JSON string
  createdAt: number;
}

export interface InterceptedRequest {
  id: string;
  url: string;
  method: string;
  statusCode: number;
  statusText?: string;
  durationMs: number;
  isMocked: boolean;
  matchedRuleId?: string;
  requestHeaders: Record<string, string>;
  requestBody?: string;
  responseHeaders: Record<string, string>;
  responseBody?: string;
  timestamp: number;
}
