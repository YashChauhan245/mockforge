import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity,
  Search,
  Trash2,
  Copy,
  Check,
  X,
  ExternalLink,
  Clock,
  ArrowRight,
  ShieldAlert,
  Code2,
  FileJson
} from 'lucide-react';
import { InterceptedRequest, HttpMethod } from '../../types/rule';
import { MOCKFORGE_SOURCE, MockForgeMessage } from '../../types/messages';

interface NetworkInspectorProps {
  globalEnabled: boolean;
  onRequestCountChange?: (count: number) => void;
}

export const NetworkInspector: React.FC<NetworkInspectorProps> = ({
  globalEnabled,
  onRequestCountChange,
}) => {
  const [requests, setRequests] = useState<InterceptedRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<HttpMethod>('ALL');
  const [selectedRequest, setSelectedRequest] = useState<InterceptedRequest | null>(null);
  const [detailTab, setDetailTab] = useState<'response' | 'request' | 'headers'>('response');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Load buffered logs on mount and listen for real-time messages
  useEffect(() => {
    // 1. Fetch buffered requests from Background Service Worker
    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage(
        {
          source: MOCKFORGE_SOURCE,
          type: 'GET_REQUEST_LOGS',
        },
        (response) => {
          if (chrome.runtime.lastError) return;
          if (response && Array.isArray(response.logs)) {
            setRequests(response.logs);
            onRequestCountChange?.(response.logs.length);
          }
        }
      );
    }

    // 2. Listen for real-time REQUEST_INTERCEPTED messages
    const handleRuntimeMessage = (message: MockForgeMessage) => {
      if (!message || message.source !== MOCKFORGE_SOURCE) return;

      if (message.type === 'REQUEST_INTERCEPTED') {
        setRequests((prev) => {
          // Avoid duplicates by id
          if (prev.some((r) => r.id === message.payload.id)) return prev;
          const updated = [message.payload, ...prev].slice(0, 100);
          onRequestCountChange?.(updated.length);
          return updated;
        });
      }
    };

    chrome.runtime?.onMessage?.addListener(handleRuntimeMessage);

    return () => {
      chrome.runtime?.onMessage?.removeListener(handleRuntimeMessage);
    };
  }, [onRequestCountChange]);

  const handleClearLogs = () => {
    setRequests([]);
    setSelectedRequest(null);
    onRequestCountChange?.(0);

    if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({
        source: MOCKFORGE_SOURCE,
        type: 'CLEAR_REQUEST_LOGS',
      });
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  // Filter requests by method and search term
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      const matchesMethod =
        selectedMethod === 'ALL' || req.method.toUpperCase() === selectedMethod;
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        req.url.toLowerCase().includes(query) ||
        String(req.statusCode).includes(query) ||
        req.method.toLowerCase().includes(query);
      return matchesMethod && matchesSearch;
    });
  }, [requests, selectedMethod, searchQuery]);

  // Method Badge color mapping
  const getMethodBadge = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'text-sky-400 bg-sky-500/10 border-sky-500/25';
      case 'POST':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25';
      case 'PUT':
        return 'text-amber-400 bg-amber-500/10 border-amber-500/25';
      case 'DELETE':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/25';
      case 'PATCH':
        return 'text-purple-400 bg-purple-500/10 border-purple-500/25';
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/25';
    }
  };

  // Status Code Badge color mapping
  const getStatusBadge = (code: number) => {
    if (code >= 200 && code < 300) {
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    }
    if (code >= 300 && code < 400) {
      return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
    }
    if (code >= 400 && code < 500) {
      return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
    }
    if (code >= 500) {
      return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
    }
    return 'text-rose-300 bg-rose-500/20 border-rose-500/30'; // Network error (0)
  };

  // Duration latency indicator
  const getDurationColor = (ms: number) => {
    if (ms < 150) return 'text-emerald-400';
    if (ms < 500) return 'text-amber-400';
    return 'text-rose-400';
  };

  const formatJson = (content?: string) => {
    if (!content) return null;
    try {
      const parsed = JSON.parse(content);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return content;
    }
  };

  return (
    <div className="flex flex-col h-full -m-4">
      {/* Control Bar: Search & Filters */}
      <div className="p-3 border-b border-[#232736] bg-[#10121a] flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by URL, method or status..."
              className="w-full pl-8 pr-3 py-1.5 bg-[#14161f] border border-[#232736] focus:border-indigo-500 rounded-md text-xs text-slate-200 placeholder-slate-500 outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Clear Logs Button */}
          <button
            onClick={handleClearLogs}
            disabled={requests.length === 0}
            title="Clear all request logs"
            className="p-1.5 rounded-md border border-[#232736] bg-[#14161f] hover:bg-rose-500/10 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Method Filter Pills & Stream Counter */}
        <div className="flex items-center justify-between text-[11px]">
          <div className="flex items-center gap-1 overflow-x-auto py-0.5">
            {(['ALL', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as HttpMethod[]).map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMethod(m)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                  selectedMethod === m
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-[#14161f] text-slate-400 hover:text-slate-200 border border-[#232736]'
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-slate-500 shrink-0">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                globalEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
              }`}
            />
            <span>
              {filteredRequests.length} / {requests.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main View Area: Request List + Slide-over Inspector */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Request Table / List */}
        <div className="flex-1 overflow-y-auto divide-y divide-[#1e2230]">
          {filteredRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-400">
              <div className="w-10 h-10 rounded-xl bg-[#14161f] border border-[#232736] flex items-center justify-center text-emerald-400 mb-2">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
              <p className="font-medium text-slate-300 text-xs">
                {requests.length === 0 ? 'Listening for API Traffic...' : 'No matching requests'}
              </p>
              <p className="text-[11px] text-slate-500 max-w-xs mt-1">
                {requests.length === 0
                  ? 'Trigger fetch or XMLHttpRequest calls in the host webpage to inspect traffic in real time.'
                  : 'Try clearing the search query or selecting a different HTTP method filter.'}
              </p>
            </div>
          ) : (
            filteredRequests.map((req) => {
              const isSelected = selectedRequest?.id === req.id;
              const formattedUrl = (() => {
                try {
                  const parsed = new URL(req.url);
                  return parsed.pathname + parsed.search;
                } catch {
                  return req.url;
                }
              })();

              return (
                <div
                  key={req.id}
                  onClick={() => setSelectedRequest(req)}
                  className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors text-xs ${
                    isSelected
                      ? 'bg-indigo-600/15 border-l-2 border-indigo-500'
                      : 'hover:bg-[#14161f]'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    {/* Method */}
                    <span
                      className={`font-mono font-bold text-[10px] px-1.5 py-0.5 rounded border uppercase shrink-0 ${getMethodBadge(
                        req.method
                      )}`}
                    >
                      {req.method}
                    </span>

                    {/* Status Code */}
                    <span
                      className={`font-mono text-[10px] px-1.5 py-0.5 rounded border font-semibold shrink-0 ${getStatusBadge(
                        req.statusCode
                      )}`}
                    >
                      {req.statusCode === 0 ? 'ERR' : req.statusCode}
                    </span>

                    {/* Path & Mock indicator */}
                    <div className="flex items-center gap-1.5 truncate">
                      <span className="text-slate-200 font-mono truncate" title={req.url}>
                        {formattedUrl}
                      </span>
                      {req.isMocked && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase font-semibold">
                          FORGED
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Latency & Timestamp */}
                  <div className="flex items-center gap-2 shrink-0 font-mono text-[10px]">
                    <span className={getDurationColor(req.durationMs)}>
                      {req.durationMs}ms
                    </span>
                    <span className="text-slate-500">
                      {new Date(req.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Slide-in Detail Drawer */}
        {selectedRequest && (
          <div className="absolute inset-0 bg-[#0c0d12] border-t border-[#232736] flex flex-col z-20 animate-in slide-in-from-bottom-2 duration-150">
            {/* Drawer Header */}
            <div className="px-3 py-2.5 border-b border-[#232736] bg-[#14161f] flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`font-mono font-bold text-[10px] px-1.5 py-0.5 rounded border uppercase ${getMethodBadge(
                    selectedRequest.method
                  )}`}
                >
                  {selectedRequest.method}
                </span>
                <span
                  className={`font-mono text-[10px] px-1.5 py-0.5 rounded border font-semibold ${getStatusBadge(
                    selectedRequest.statusCode
                  )}`}
                >
                  {selectedRequest.statusCode === 0 ? 'Network Error' : selectedRequest.statusCode}
                </span>
                <span
                  className="font-mono text-xs text-slate-200 truncate max-w-[200px]"
                  title={selectedRequest.url}
                >
                  {selectedRequest.url}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => copyToClipboard(selectedRequest.url, 'url')}
                  title="Copy full URL"
                  className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#232736]"
                >
                  {copiedKey === 'url' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#232736]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-[#10121a] border-b border-[#232736] text-[11px] font-mono text-slate-400">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-500" />
                  Latency:
                  <strong className={getDurationColor(selectedRequest.durationMs)}>
                    {selectedRequest.durationMs}ms
                  </strong>
                </span>
                {selectedRequest.isMocked && (
                  <span className="text-amber-400 font-semibold">• Mocked Response</span>
                )}
              </div>
              <span>
                {new Date(selectedRequest.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                })}
              </span>
            </div>

            {/* Sub-Tabs: Response / Request / Headers */}
            <div className="flex items-center gap-1 px-3 pt-1 border-b border-[#232736] bg-[#14161f] text-xs">
              <button
                onClick={() => setDetailTab('response')}
                className={`flex items-center gap-1 px-2.5 py-1.5 border-b-2 font-medium transition-colors ${
                  detailTab === 'response'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileJson className="w-3.5 h-3.5" />
                Response Body
              </button>

              <button
                onClick={() => setDetailTab('request')}
                className={`flex items-center gap-1 px-2.5 py-1.5 border-b-2 font-medium transition-colors ${
                  detailTab === 'request'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                Request Payload
              </button>

              <button
                onClick={() => setDetailTab('headers')}
                className={`flex items-center gap-1 px-2.5 py-1.5 border-b-2 font-medium transition-colors ${
                  detailTab === 'headers'
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                Headers
              </button>
            </div>

            {/* Sub-Tab Content */}
            <div className="flex-1 overflow-y-auto p-3 font-mono text-xs text-slate-300">
              {detailTab === 'response' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-sans font-medium text-slate-400">
                      Response Payload
                    </span>
                    {selectedRequest.responseBody && (
                      <button
                        onClick={() =>
                          copyToClipboard(
                            formatJson(selectedRequest.responseBody) || '',
                            'responseBody'
                          )
                        }
                        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 font-sans"
                      >
                        {copiedKey === 'responseBody' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy JSON</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  {selectedRequest.responseBody ? (
                    <pre className="p-2.5 rounded-lg bg-[#14161f] border border-[#232736] text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {formatJson(selectedRequest.responseBody)}
                    </pre>
                  ) : (
                    <p className="text-slate-500 italic text-[11px]">No response body recorded.</p>
                  )}
                </div>
              )}

              {detailTab === 'request' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-sans font-medium text-slate-400">
                      Outgoing Request Payload
                    </span>
                    {selectedRequest.requestBody && (
                      <button
                        onClick={() =>
                          copyToClipboard(
                            formatJson(selectedRequest.requestBody) || '',
                            'requestBody'
                          )
                        }
                        className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 font-sans"
                      >
                        {copiedKey === 'requestBody' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Payload</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  {selectedRequest.requestBody ? (
                    <pre className="p-2.5 rounded-lg bg-[#14161f] border border-[#232736] text-[11px] overflow-x-auto whitespace-pre-wrap leading-relaxed">
                      {formatJson(selectedRequest.requestBody)}
                    </pre>
                  ) : (
                    <p className="text-slate-500 italic text-[11px]">No outgoing body (GET/HEAD).</p>
                  )}
                </div>
              )}

              {detailTab === 'headers' && (
                <div className="space-y-4">
                  {/* Response Headers */}
                  <div>
                    <h4 className="text-[11px] font-sans font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                      Response Headers
                    </h4>
                    {Object.keys(selectedRequest.responseHeaders || {}).length > 0 ? (
                      <div className="rounded-lg border border-[#232736] bg-[#14161f] divide-y divide-[#1e2230] text-[11px]">
                        {Object.entries(selectedRequest.responseHeaders).map(([k, v]) => (
                          <div key={k} className="flex px-2.5 py-1.5">
                            <span className="font-semibold text-indigo-400 w-36 shrink-0 truncate">
                              {k}:
                            </span>
                            <span className="text-slate-300 break-all">{v}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 italic text-[11px]">No response headers recorded.</p>
                    )}
                  </div>

                  {/* Request Headers */}
                  <div>
                    <h4 className="text-[11px] font-sans font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                      Request Headers
                    </h4>
                    {Object.keys(selectedRequest.requestHeaders || {}).length > 0 ? (
                      <div className="rounded-lg border border-[#232736] bg-[#14161f] divide-y divide-[#1e2230] text-[11px]">
                        {Object.entries(selectedRequest.requestHeaders).map(([k, v]) => (
                          <div key={k} className="flex px-2.5 py-1.5">
                            <span className="font-semibold text-sky-400 w-36 shrink-0 truncate">
                              {k}:
                            </span>
                            <span className="text-slate-300 break-all">{v}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 italic text-[11px]">No request headers recorded.</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
