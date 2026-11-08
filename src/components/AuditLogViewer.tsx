/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  FileText,
  Filter,
  Download,
  Trash2,
  Search,
  RefreshCw,
  Copy,
  Check,
  ShieldAlert,
  Activity
} from 'lucide-react';
import type { AuditLogEntry, AuditLogLevel } from '../repoman/types.ts';
import { api } from '../services/api.ts';

export const AuditLogViewer: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [rawText, setRawText] = useState('');
  const [viewMode, setViewMode] = useState<'structured' | 'raw'>('structured');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchLogs = async () => {
    try {
      const data = await api.getAuditLogs(200);
      setLogs(data.logs);
      setRawText(data.rawText);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([rawText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `repoman-audit-${new Date().toISOString().split('T')[0]}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClear = async () => {
    if (confirm('Clear current audit log entries from repoman-audit.log?')) {
      await api.clearAuditLogs();
      await fetchLogs();
      onRefresh();
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (levelFilter !== 'ALL' && log.level !== levelFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchAction = log.action.toLowerCase().includes(q);
      const matchCat = log.category.toLowerCase().includes(q);
      const matchDetails = JSON.stringify(log.details).toLowerCase().includes(q);
      return matchAction || matchCat || matchDetails;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-teal-400" />
            Immutable Audit Trail & Safe Execution Logs
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Tracking every local Git transaction, file mutation, and safeguard intervention in <span className="font-mono text-teal-300">./repoman-audit.log</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-slate-950 p-1 rounded-xl border border-slate-800 flex text-xs">
            <button
              onClick={() => setViewMode('structured')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                viewMode === 'structured'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Structured Cards
            </button>
            <button
              onClick={() => setViewMode('raw')}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                viewMode === 'raw'
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Raw File Log
            </button>
          </div>

          <button
            onClick={handleCopy}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Copy log to clipboard"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={handleDownload}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
            title="Download repoman-audit.log"
          >
            <Download className="w-4 h-4 text-teal-400" />
          </button>
          <button
            onClick={handleClear}
            className="p-2 rounded-xl bg-slate-800 hover:bg-rose-950/60 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/40 transition"
            title="Clear audit log"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 border border-slate-800 p-3 rounded-xl">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search action, category, or parameter..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="text-xs text-slate-400 mr-1">Level:</span>
          {['ALL', 'TX', 'BLOCK', 'WARN', 'SAFE', 'INFO'].map((lvl) => (
            <button
              key={lvl}
              onClick={() => setLevelFilter(lvl)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium transition ${
                levelFilter === lvl
                  ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                  : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      {viewMode === 'raw' ? (
        <div className="bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
          <div className="p-3 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
            <span>cat ./repoman-audit.log</span>
            <span>{rawText.split('\n').length} lines</span>
          </div>
          <pre className="p-4 font-mono text-[11px] text-teal-300/90 leading-relaxed overflow-x-auto max-h-[600px] whitespace-pre-wrap">
            {rawText || '# repoman-audit.log is empty'}
          </pre>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-slate-900/40 border border-slate-800 rounded-xl text-xs">
              No audit log entries found matching filter criteria.
            </div>
          ) : (
            filteredLogs.map((log) => {
              const isBlock = log.level === 'BLOCK' || log.status === 'BLOCKED';
              const isWarn = log.level === 'WARN';
              const isTx = log.level === 'TX';

              return (
                <div
                  key={log.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isBlock
                      ? 'bg-rose-950/20 border-rose-500/30'
                      : isWarn
                      ? 'bg-amber-950/20 border-amber-500/30'
                      : isTx
                      ? 'bg-slate-900/90 border-teal-500/30'
                      : 'bg-slate-900/70 border-slate-800'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase ${
                          isBlock
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                            : isWarn
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : isTx
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        {log.level}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                        CAT: {log.category}
                      </span>
                      <span className="text-[11px] font-mono text-slate-400">
                        STATUS: <strong className="text-slate-200">{log.status}</strong>
                      </span>
                    </div>

                    <span className="text-slate-500 font-mono text-[11px]">
                      {log.timestamp}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-slate-100">{log.action}</p>

                  {log.details && Object.keys(log.details).length > 0 && (
                    <div className="mt-2.5 p-2 rounded bg-slate-950/70 border border-slate-800/80 font-mono text-[11px] text-slate-400 overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
