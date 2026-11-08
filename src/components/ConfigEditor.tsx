/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  RotateCcw,
  CheckCircle2,
  ShieldCheck,
  Code2,
  Sliders,
  Download,
  AlertTriangle
} from 'lucide-react';
import type { RepomanConfig } from '../repoman/types.ts';
import { api } from '../services/api.ts';

export const ConfigEditor: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const [config, setConfig] = useState<RepomanConfig | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  const fetchConfig = async () => {
    try {
      const data = await api.getConfig();
      setConfig(data);
      setJsonText(JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Failed to load config:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async () => {
    try {
      let payload = config;
      if (viewMode === 'json') {
        payload = JSON.parse(jsonText);
      }
      if (!payload) return;

      const res = await api.saveConfig(payload);
      if (res.success) {
        setConfig(res.config);
        setJsonText(JSON.stringify(res.config, null, 2));
        setSaveStatus('Saved configuration and updated repoman.config.json successfully!');
        setTimeout(() => setSaveStatus(null), 4000);
        onRefresh();
      }
    } catch (err) {
      setSaveStatus(`Failed to save: ${String(err)}`);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([jsonText], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'repoman.config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!config) {
    return (
      <div className="py-20 flex justify-center text-slate-400">
        <RotateCcw className="w-6 h-6 animate-spin text-teal-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-teal-400" />
            repoman.config.json & Safeguard Policies
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Configure automated jobs, environment boundaries, sensitive file shields, and execution limits.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex text-xs">
            <button
              onClick={() => {
                setViewMode('visual');
                if (config) setJsonText(JSON.stringify(config, null, 2));
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition ${
                viewMode === 'visual'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              Visual Policy
            </button>
            <button
              onClick={() => {
                setViewMode('json');
                if (config) setJsonText(JSON.stringify(config, null, 2));
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition ${
                viewMode === 'json'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              Raw JSON
            </button>
          </div>

          <button
            onClick={handleDownload}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Download repoman.config.json"
          >
            <Download className="w-4 h-4 text-teal-400" />
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs rounded-xl shadow-lg shadow-teal-500/20 transition"
          >
            <Save className="w-3.5 h-3.5" />
            Apply Changes
          </button>
        </div>
      </div>

      {saveStatus && (
        <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-300 flex items-center justify-between">
          <span>{saveStatus}</span>
          <button onClick={() => setSaveStatus(null)} className="px-2 py-0.5 rounded hover:bg-white/10">
            Dismiss
          </button>
        </div>
      )}

      {/* Editor Content */}
      {viewMode === 'json' ? (
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>repoman.config.json</span>
            <span>UTF-8 JSON Schema</span>
          </div>
          <textarea
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            rows={22}
            className="w-full p-4 font-mono text-xs text-teal-300 bg-transparent border-none focus:outline-none leading-relaxed resize-none"
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Safeguard Settings Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-400" />
              Safety Safeguards Policy
            </h3>

            <div className="space-y-3 text-xs">
              {/* Force Push Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div>
                  <span className="font-medium text-slate-200">Allow Force Push</span>
                  <p className="text-[11px] text-slate-400">
                    Blocks git push --force and git push -f commands
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.safeguards.allowForcePush}
                  onChange={(e) => {
                    const updated = {
                      ...config,
                      safeguards: { ...config.safeguards, allowForcePush: e.target.checked }
                    };
                    setConfig(updated);
                    setJsonText(JSON.stringify(updated, null, 2));
                  }}
                  className="rounded bg-slate-900 border-slate-700 text-teal-500 focus:ring-teal-500"
                />
              </div>

              {/* Require Clean Tree */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div>
                  <span className="font-medium text-slate-200">Require Clean Working Tree</span>
                  <p className="text-[11px] text-slate-400">
                    Prevents automated job execution if uncommitted user changes exist
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={config.safeguards.requireCleanWorkingTree}
                  onChange={(e) => {
                    const updated = {
                      ...config,
                      safeguards: { ...config.safeguards, requireCleanWorkingTree: e.target.checked }
                    };
                    setConfig(updated);
                    setJsonText(JSON.stringify(updated, null, 2));
                  }}
                  className="rounded bg-slate-900 border-slate-700 text-teal-500 focus:ring-teal-500"
                />
              </div>

              {/* Max files per commit */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-medium text-slate-200">Max Files Per Commit</span>
                  <p className="text-[11px] text-slate-400">Threshold limit to prevent bulk accidental changes</p>
                </div>
                <input
                  type="number"
                  value={config.safeguards.maxFilesPerCommit}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 10;
                    const updated = {
                      ...config,
                      safeguards: { ...config.safeguards, maxFilesPerCommit: val }
                    };
                    setConfig(updated);
                    setJsonText(JSON.stringify(updated, null, 2));
                  }}
                  className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right font-mono text-white text-xs"
                />
              </div>

              {/* Max lines changed */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-medium text-slate-200">Max Lines Changed Per Job</span>
                  <p className="text-[11px] text-slate-400">Safety line ceiling for automated patches</p>
                </div>
                <input
                  type="number"
                  value={config.safeguards.maxLinesChangedPerJob}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10) || 1000;
                    const updated = {
                      ...config,
                      safeguards: { ...config.safeguards, maxLinesChangedPerJob: val }
                    };
                    setConfig(updated);
                    setJsonText(JSON.stringify(updated, null, 2));
                  }}
                  className="w-24 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-right font-mono text-white text-xs"
                />
              </div>
            </div>
          </div>

          {/* Sandbox & Boundaries Card */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-cyan-400" />
              Environment Isolation & Targets
            </h3>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="font-medium text-slate-200 block mb-1">
                  Allowed Repository Paths (Sandbox Boundary)
                </span>
                <p className="text-[11px] text-slate-400 mb-2">
                  Agent is strictly confined to these directories:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {config.safeguards.allowedRepositoryPaths.map((p) => (
                    <span
                      key={p}
                      className="px-2 py-0.5 rounded font-mono text-[11px] bg-slate-900 border border-slate-800 text-teal-300"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="font-medium text-slate-200 block mb-1">
                  Protected File Mask Patterns
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {config.safeguards.blockedFilePatterns.map((p) => (
                    <span
                      key={p}
                      className="px-2 py-0.5 rounded font-mono text-[11px] bg-slate-900 border border-slate-800 text-amber-300"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="font-medium text-slate-200 block mb-1">
                  Blocked Shell Patterns
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {config.safeguards.blockedCommands.map((c) => (
                    <span
                      key={c}
                      className="px-2 py-0.5 rounded font-mono text-[11px] bg-slate-900 border border-slate-800 text-rose-300"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
