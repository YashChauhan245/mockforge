import React, { useState, useEffect } from 'react';
import { 
  Flame, 
  Activity, 
  Sliders, 
  Power, 
  Terminal,
  Zap
} from 'lucide-react';
import { RuleManager } from './components/RuleManager';
import { NetworkInspector } from './components/NetworkInspector';
import { MockRule } from '../types/rule';
import { MOCKFORGE_SOURCE, RulesUpdatedMessage } from '../types/messages';

const STORAGE_KEY_GLOBAL_ENABLED = 'mockforge_global_enabled';
const STORAGE_KEY_RULES = 'mockforge_rules';

export const SidePanel: React.FC = () => {
  const [globalEnabled, setGlobalEnabled] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'rules' | 'network' | 'chaos'>('rules');
  const [rulesCount, setRulesCount] = useState<number>(0);
  const [logsCount, setLogsCount] = useState<number>(0);

  // Load global state from chrome.storage on mount
  useEffect(() => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get([STORAGE_KEY_GLOBAL_ENABLED, STORAGE_KEY_RULES], (result) => {
        if (typeof result[STORAGE_KEY_GLOBAL_ENABLED] === 'boolean') {
          setGlobalEnabled(result[STORAGE_KEY_GLOBAL_ENABLED]);
        }
        if (Array.isArray(result[STORAGE_KEY_RULES])) {
          setRulesCount(result[STORAGE_KEY_RULES].length);
        }
      });
    }
  }, []);

  // Toggle global master switch and broadcast to background service worker
  const handleToggleGlobal = () => {
    const nextState = !globalEnabled;
    setGlobalEnabled(nextState);

    if (typeof chrome !== 'undefined') {
      if (chrome.storage?.local) {
        chrome.storage.local.set({ [STORAGE_KEY_GLOBAL_ENABLED]: nextState });
      }

      // Query current rules to broadcast
      chrome.storage.local.get([STORAGE_KEY_RULES], (result) => {
        const rules: MockRule[] = Array.isArray(result[STORAGE_KEY_RULES]) ? result[STORAGE_KEY_RULES] : [];
        const updateMsg: RulesUpdatedMessage = {
          source: MOCKFORGE_SOURCE,
          type: 'RULES_UPDATED',
          rules,
          globalEnabled: nextState,
        };
        chrome.runtime.sendMessage(updateMsg).catch(() => {});
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#0c0d12] text-slate-100 text-sm select-none">
      {/* Top Navbar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-[#232736] bg-[#14161f]">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white text-base">MockForge</span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                v0.1.0
              </span>
            </div>
            <p className="text-[11px] text-slate-400">API Interceptor & Chaos Engine</p>
          </div>
        </div>

        {/* Global Master Kill Switch */}
        <button
          onClick={handleToggleGlobal}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md font-medium text-xs transition-all ${
            globalEnabled
              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25'
              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25'
          }`}
        >
          <Power className="w-3.5 h-3.5" />
          {globalEnabled ? 'Active' : 'Paused'}
        </button>
      </header>

      {/* Navigation Tabs */}
      <nav className="flex items-center gap-1 px-3 pt-2 border-b border-[#232736] bg-[#10121a]">
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium text-xs transition-colors ${
            activeTab === 'rules'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          Mock Rules
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-[#232736] text-slate-300">
            {rulesCount}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('network')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium text-xs transition-colors ${
            activeTab === 'network'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          Network Stream
          {logsCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-[#232736] text-slate-300">
              {logsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('chaos')}
          className={`flex items-center gap-1.5 px-3 py-2 border-b-2 font-medium text-xs transition-colors ${
            activeTab === 'chaos'
              ? 'border-indigo-500 text-indigo-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          Chaos Simulator
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-3">
        {activeTab === 'rules' && (
          <RuleManager 
            globalEnabled={globalEnabled} 
            onRulesCountChange={(count) => setRulesCount(count)} 
          />
        )}

        {activeTab === 'network' && (
          <NetworkInspector 
            globalEnabled={globalEnabled} 
            onRequestCountChange={(count) => setLogsCount(count)}
          />
        )}

        {activeTab === 'chaos' && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <div className="w-12 h-12 rounded-xl bg-[#14161f] border border-[#232736] flex items-center justify-center text-slate-400 mb-3">
              <Sliders className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="font-semibold text-slate-200 text-sm">Chaos Simulator Ready</h3>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              Configure artificial latency, error rates, and network drop probability per route in Day 4.
            </p>
          </div>
        )}
      </main>

      {/* Bottom Status Bar */}
      <footer className="flex items-center justify-between px-3 py-2 border-t border-[#232736] bg-[#14161f] text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${globalEnabled ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
          <span>{globalEnabled ? 'Event Bus Connected' : 'Mocking Suspended'}</span>
        </div>
        <div className="flex items-center gap-1 text-slate-500">
          <Terminal className="w-3 h-3" />
          <span>MV3 Isolated ➔ Main</span>
        </div>
      </footer>
    </div>
  );
};
