import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Clock, 
  Copy, 
  Check, 
  X, 
  AlertCircle, 
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Code
} from 'lucide-react';
import { MockRule, HttpMethod } from '../../types/rule';
import { MOCKFORGE_SOURCE, RulesUpdatedMessage } from '../../types/messages';

interface RuleManagerProps {
  globalEnabled: boolean;
  onRulesCountChange?: (count: number) => void;
}

const STORAGE_KEY_RULES = 'mockforge_rules';
const STORAGE_KEY_GLOBAL_ENABLED = 'mockforge_global_enabled';

const SAMPLE_RULE: Omit<MockRule, 'id' | 'createdAt'> = {
  name: 'JSONPlaceholder Todos Mock',
  enabled: true,
  urlPattern: '*jsonplaceholder.typicode.com/todos/*',
  method: 'GET',
  statusCode: 200,
  delayMs: 300,
  failureRate: 0,
  responseHeaders: {
    'content-type': 'application/json',
  },
  responseBody: JSON.stringify(
    {
      userId: 1,
      id: 1,
      title: 'Forged with MockForge ⚒️',
      completed: true,
      author: 'Yash Chauhan',
      status: 'mocked_successfully',
    },
    null,
    2
  ),
};

export const RuleManager: React.FC<RuleManagerProps> = ({ globalEnabled, onRulesCountChange }) => {
  const [rules, setRules] = useState<MockRule[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Form State
  const [formName, setFormName] = useState('');
  const [formUrlPattern, setFormUrlPattern] = useState('');
  const [formMethod, setFormMethod] = useState<HttpMethod>('GET');
  const [formStatusCode, setFormStatusCode] = useState<number>(200);
  const [formDelayMs, setFormDelayMs] = useState<number>(0);
  const [formResponseBody, setFormResponseBody] = useState('{\n  "message": "Hello from MockForge"\n}');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load rules from chrome.storage.local on mount
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get([STORAGE_KEY_RULES], (result) => {
        if (Array.isArray(result[STORAGE_KEY_RULES])) {
          setRules(result[STORAGE_KEY_RULES]);
          onRulesCountChange?.(result[STORAGE_KEY_RULES].length);
        }
      });
    }
  }, []);

  // Sync rules to chrome.storage.local and broadcast to background service worker
  const syncRules = (newRules: MockRule[]) => {
    setRules(newRules);
    onRulesCountChange?.(newRules.length);

    if (typeof chrome !== 'undefined') {
      if (chrome.storage?.local) {
        chrome.storage.local.set({ [STORAGE_KEY_RULES]: newRules });
      }

      const updateMsg: RulesUpdatedMessage = {
        source: MOCKFORGE_SOURCE,
        type: 'RULES_UPDATED',
        rules: newRules,
        globalEnabled,
      };

      chrome.runtime.sendMessage(updateMsg).catch(() => {});
    }
  };

  const handleOpenCreateModal = () => {
    setEditingRuleId(null);
    setFormName('');
    setFormUrlPattern('');
    setFormMethod('GET');
    setFormStatusCode(200);
    setFormDelayMs(0);
    setFormResponseBody('{\n  "message": "Hello from MockForge"\n}');
    setJsonError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (rule: MockRule) => {
    setEditingRuleId(rule.id);
    setFormName(rule.name);
    setFormUrlPattern(rule.urlPattern);
    setFormMethod(rule.method);
    setFormStatusCode(rule.statusCode);
    setFormDelayMs(rule.delayMs || 0);
    setFormResponseBody(rule.responseBody || '{}');
    setJsonError(null);
    setIsModalOpen(true);
  };

  const handleToggleRule = (id: string) => {
    const updated = rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r));
    syncRules(updated);
  };

  const handleDeleteRule = (id: string) => {
    const updated = rules.filter((r) => r.id !== id);
    syncRules(updated);
  };

  const handleDuplicateRule = (rule: MockRule) => {
    const duplicated: MockRule = {
      ...rule,
      id: 'rule_' + Math.random().toString(36).substring(2, 9),
      name: `${rule.name} (Copy)`,
      createdAt: Date.now(),
    };
    syncRules([duplicated, ...rules]);
  };

  const handleFormatJson = () => {
    try {
      const parsed = JSON.parse(formResponseBody);
      setFormResponseBody(JSON.stringify(parsed, null, 2));
      setJsonError(null);
    } catch (err) {
      setJsonError('Invalid JSON format');
    }
  };

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate JSON format
    try {
      if (formResponseBody.trim()) {
        JSON.parse(formResponseBody);
      }
      setJsonError(null);
    } catch {
      setJsonError('Please enter valid JSON');
      return;
    }

    if (!formUrlPattern.trim()) {
      alert('Please enter a valid URL pattern');
      return;
    }

    if (editingRuleId) {
      // Update existing
      const updated = rules.map((r) =>
        r.id === editingRuleId
          ? {
              ...r,
              name: formName.trim() || formUrlPattern,
              urlPattern: formUrlPattern.trim(),
              method: formMethod,
              statusCode: formStatusCode,
              delayMs: formDelayMs,
              responseBody: formResponseBody,
            }
          : r
      );
      syncRules(updated);
    } else {
      // Create new
      const newRule: MockRule = {
        id: 'rule_' + Math.random().toString(36).substring(2, 9),
        name: formName.trim() || formUrlPattern.trim(),
        enabled: true,
        urlPattern: formUrlPattern.trim(),
        method: formMethod,
        statusCode: formStatusCode,
        delayMs: formDelayMs,
        failureRate: 0,
        responseHeaders: { 'content-type': 'application/json' },
        responseBody: formResponseBody,
        createdAt: Date.now(),
      };
      syncRules([newRule, ...rules]);
    }

    setIsModalOpen(false);
  };

  const handleLoadSampleRule = () => {
    const sample: MockRule = {
      ...SAMPLE_RULE,
      id: 'rule_' + Math.random().toString(36).substring(2, 9),
      createdAt: Date.now(),
    };
    syncRules([sample, ...rules]);
  };

  const handleCopyPattern = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const filteredRules = rules.filter((rule) => {
    const matchesSearch =
      rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rule.urlPattern.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesMethod = selectedMethod === 'ALL' || rule.method === selectedMethod;
    return matchesSearch && matchesMethod;
  });

  const getMethodBadgeClass = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
      case 'POST':
        return 'bg-sky-500/15 text-sky-400 border-sky-500/30';
      case 'PUT':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'DELETE':
        return 'bg-rose-500/15 text-rose-400 border-rose-500/30';
      case 'PATCH':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      default:
        return 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30';
    }
  };

  const getStatusBadgeClass = (status: number) => {
    if (status >= 200 && status < 300) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (status >= 400 && status < 500) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    if (status >= 500) return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
    return 'text-slate-300 bg-slate-800 border-slate-700';
  };

  return (
    <div className="flex flex-col h-full">
      {/* Control Toolbar */}
      <div className="flex flex-col gap-2.5 pb-3 border-b border-[#232736]">
        <div className="flex items-center justify-between gap-2">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search rules..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#14161f] border border-[#232736] rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500/60"
            />
          </div>

          {/* New Rule Button */}
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-md shadow-indigo-600/20 transition-all shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            New Rule
          </button>
        </div>

        {/* Method Filter Pills */}
        <div className="flex items-center gap-1 overflow-x-auto text-[11px] pb-0.5">
          {['ALL', 'GET', 'POST', 'PUT', 'DELETE'].map((method) => (
            <button
              key={method}
              onClick={() => setSelectedMethod(method)}
              className={`px-2 py-0.5 rounded transition-colors ${
                selectedMethod === method
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-medium'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#14161f]'
              }`}
            >
              {method}
            </button>
          ))}
        </div>
      </div>

      {/* Rules List or Empty State */}
      <div className="flex-1 overflow-y-auto py-3 space-y-2.5">
        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
            <div className="w-12 h-12 rounded-xl bg-[#14161f] border border-[#232736] flex items-center justify-center text-slate-400 mb-3 shadow-inner">
              <Zap className="w-6 h-6 text-indigo-400" />
            </div>
            <h3 className="font-semibold text-slate-200 text-sm">No Mock Rules Configured</h3>
            <p className="text-xs text-slate-400 max-w-xs mt-1 mb-4">
              Create your first rule to intercept outgoing API endpoints and return custom forged payloads.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleOpenCreateModal}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs shadow-lg shadow-indigo-600/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                New Mock Rule
              </button>
              <button
                onClick={handleLoadSampleRule}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#14161f] hover:bg-[#1a1d29] text-slate-300 border border-[#232736] font-medium text-xs transition-all"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Load Sample Rule
              </button>
            </div>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            No rules match "{searchQuery}"
          </div>
        ) : (
          filteredRules.map((rule) => (
            <div
              key={rule.id}
              className={`p-3 rounded-lg border transition-all ${
                rule.enabled && globalEnabled
                  ? 'bg-[#14161f] border-[#232736] hover:border-slate-600'
                  : 'bg-[#10121a] border-[#1d202d] opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {/* Method Pill */}
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getMethodBadgeClass(
                      rule.method
                    )}`}
                  >
                    {rule.method}
                  </span>

                  {/* Rule Name */}
                  <span className="font-medium text-slate-200 text-xs truncate">
                    {rule.name}
                  </span>
                </div>

                {/* Quick Toggle Switch */}
                <button
                  onClick={() => handleToggleRule(rule.id)}
                  title={rule.enabled ? 'Disable Rule' : 'Enable Rule'}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  {rule.enabled ? (
                    <ToggleRight className="w-5 h-5 text-indigo-400" />
                  ) : (
                    <ToggleLeft className="w-5 h-5 text-slate-600" />
                  )}
                </button>
              </div>

              {/* URL Pattern with Copy */}
              <div className="flex items-center justify-between bg-[#0c0d12] border border-[#1e2230] rounded px-2 py-1 mb-2.5">
                <code className="text-[11px] font-mono text-slate-300 truncate flex-1">
                  {rule.urlPattern}
                </code>
                <button
                  onClick={() => handleCopyPattern(rule.urlPattern, rule.id)}
                  className="text-slate-500 hover:text-slate-300 ml-2"
                  title="Copy Pattern"
                >
                  {copiedId === rule.id ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>

              {/* Badges & Actions Footer */}
              <div className="flex items-center justify-between text-[11px] pt-1">
                <div className="flex items-center gap-1.5">
                  {/* Status Code */}
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold border ${getStatusBadgeClass(rule.statusCode)}`}>
                    {rule.statusCode}
                  </span>

                  {/* Delay Badge */}
                  {rule.delayMs > 0 && (
                    <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px]">
                      <Clock className="w-2.5 h-2.5" />
                      {rule.delayMs}ms
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEditModal(rule)}
                    className="p-1 rounded hover:bg-[#232736] text-slate-400 hover:text-slate-200"
                    title="Edit Rule"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDuplicateRule(rule)}
                    className="p-1 rounded hover:bg-[#232736] text-slate-400 hover:text-slate-200"
                    title="Duplicate Rule"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteRule(rule.id)}
                    className="p-1 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400"
                    title="Delete Rule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Modal Rule Editor
         ───────────────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#14161f] border border-[#232736] rounded-xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#232736]">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  <Zap className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-slate-100 text-sm">
                  {editingRuleId ? 'Edit Mock Rule' : 'New Mock Rule'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveRule} className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs">
              {/* Rule Name */}
              <div>
                <label className="block text-slate-300 font-medium mb-1">Rule Name</label>
                <input
                  type="text"
                  placeholder="e.g. Mock Users API"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full bg-[#0c0d12] border border-[#232736] rounded-lg px-3 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500/60"
                />
              </div>

              {/* URL Pattern */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">URL Pattern</label>
                  <span className="text-[10px] text-slate-500">Supports * wildcards & regex</span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="e.g. */api/users/* or *todos*"
                  value={formUrlPattern}
                  onChange={(e) => setFormUrlPattern(e.target.value)}
                  className="w-full font-mono text-xs bg-[#0c0d12] border border-[#232736] rounded-lg px-3 py-1.5 text-indigo-300 focus:outline-none focus:border-indigo-500/60"
                />
              </div>

              {/* Method & Status Code */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-medium mb-1">HTTP Method</label>
                  <select
                    value={formMethod}
                    onChange={(e) => setFormMethod(e.target.value as HttpMethod)}
                    className="w-full bg-[#0c0d12] border border-[#232736] rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500/60"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                    <option value="ALL">ALL (Wildcard)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-1">Status Code</label>
                  <select
                    value={formStatusCode}
                    onChange={(e) => setFormStatusCode(Number(e.target.value))}
                    className="w-full bg-[#0c0d12] border border-[#232736] rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-indigo-500/60"
                  >
                    <option value={200}>200 OK</option>
                    <option value={201}>201 Created</option>
                    <option value={204}>204 No Content</option>
                    <option value={400}>400 Bad Request</option>
                    <option value={401}>401 Unauthorized</option>
                    <option value={403}>403 Forbidden</option>
                    <option value={404}>404 Not Found</option>
                    <option value={500}>500 Internal Error</option>
                    <option value={502}>502 Bad Gateway</option>
                    <option value={503}>503 Unavailable</option>
                  </select>
                </div>
              </div>

              {/* Artificial Delay */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Artificial Latency</label>
                  <span className="text-[11px] font-mono text-amber-400 font-semibold">{formDelayMs} ms</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="5000"
                  step="100"
                  value={formDelayMs}
                  onChange={(e) => setFormDelayMs(Number(e.target.value))}
                  className="w-full accent-indigo-500 bg-[#0c0d12] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                  <span>0ms (Instant)</span>
                  <span>1500ms</span>
                  <span>5000ms</span>
                </div>
              </div>

              {/* Response Body with Beautify JSON */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-medium">Mock Response Body (JSON)</label>
                  <button
                    type="button"
                    onClick={handleFormatJson}
                    className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300"
                  >
                    <Code className="w-3 h-3" />
                    Format JSON
                  </button>
                </div>
                <textarea
                  rows={7}
                  value={formResponseBody}
                  onChange={(e) => {
                    setFormResponseBody(e.target.value);
                    if (jsonError) setJsonError(null);
                  }}
                  className={`w-full font-mono text-[11px] bg-[#0c0d12] border rounded-lg p-2.5 text-slate-200 focus:outline-none ${
                    jsonError ? 'border-rose-500/80 focus:border-rose-500' : 'border-[#232736] focus:border-indigo-500/60'
                  }`}
                />
                {jsonError && (
                  <p className="flex items-center gap-1 text-rose-400 text-[11px] mt-1">
                    <AlertCircle className="w-3 h-3" />
                    {jsonError}
                  </p>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#232736]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg border border-[#232736] text-slate-300 hover:bg-[#1a1d29] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/20 transition-all"
                >
                  {editingRuleId ? 'Save Changes' : 'Create Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
