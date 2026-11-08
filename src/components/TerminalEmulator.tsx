/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Terminal as TerminalIcon,
  Play,
  Trash2,
  CornerDownLeft,
  Sparkles
} from 'lucide-react';
import { api } from '../services/api.ts';

export const TerminalEmulator: React.FC = () => {
  const [input, setInput] = useState('repoman status');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number>(-1);
  const [lines, setLines] = useState<Array<{ type: 'cmd' | 'out' | 'err'; text: string }>>([
    {
      type: 'out',
      text: 'repoman-agent Linux Terminal v1.0.0 [Ready]\nType "repoman --help" for available commands.\n'
    }
  ]);
  const [isExecuting, setIsExecuting] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  const handleExecute = async (cmdToRun?: string) => {
    const cmd = (cmdToRun || input).trim();
    if (!cmd) return;

    setLines((prev) => [...prev, { type: 'cmd', text: `$ ${cmd}` }]);
    setHistory((prev) => [cmd, ...prev]);
    setHistoryIdx(-1);
    setInput('');
    setIsExecuting(true);

    try {
      const res = await api.executeCli(cmd);
      setLines((prev) => [...prev, { type: 'out', text: res.output }]);
    } catch (err) {
      setLines((prev) => [...prev, { type: 'err', text: `Execution failed: ${String(err)}` }]);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleExecute();
    } else if (e.key === 'ArrowUp') {
      if (history.length > 0) {
        const nextIdx = Math.min(historyIdx + 1, history.length - 1);
        setHistoryIdx(nextIdx);
        setInput(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      if (historyIdx > 0) {
        const nextIdx = historyIdx - 1;
        setHistoryIdx(nextIdx);
        setInput(history[nextIdx]);
      } else if (historyIdx === 0) {
        setHistoryIdx(-1);
        setInput('');
      }
    }
  };

  const sampleCommands = [
    'repoman status',
    'repoman health',
    'repoman scan --depth 3',
    'repoman run lint-and-autofix',
    'repoman run dependency-audit',
    'repoman sync',
    'repoman audit --lines 15',
    'repoman rollback'
  ];

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <TerminalIcon className="w-5 h-5 text-teal-400" />
            Autonomous Agent Terminal
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Execute repoman commands in real time against the backend Linux environment.
          </p>
        </div>

        <button
          onClick={() => setLines([])}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl border border-slate-700 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Clear Screen
        </button>
      </div>

      {/* Quick Suggestions Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <span className="text-slate-400 text-[11px] shrink-0 font-medium">Quick Run:</span>
        {sampleCommands.map((sc) => (
          <button
            key={sc}
            onClick={() => handleExecute(sc)}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-teal-300 border border-slate-800 font-mono text-[11px] shrink-0 transition"
          >
            {sc}
          </button>
        ))}
      </div>

      {/* Terminal Screen */}
      <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col h-[520px]">
        {/* Terminal Titlebar */}
        <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between select-none">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-rose-500/80" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
            </div>
            <span className="text-xs font-mono text-slate-400 ml-2">bash - repoman-agent@linux-host</span>
          </div>

          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
            <span>PORT: 3000</span>
            <span>UTF-8</span>
          </div>
        </div>

        {/* Terminal Output Area */}
        <div className="flex-1 p-4 font-mono text-xs overflow-y-auto space-y-2 text-slate-200">
          {lines.map((l, i) => (
            <div key={i} className="leading-relaxed">
              {l.type === 'cmd' ? (
                <div className="text-teal-400 font-bold flex items-center gap-1">
                  <span>{l.text}</span>
                </div>
              ) : l.type === 'err' ? (
                <pre className="text-rose-400 whitespace-pre-wrap">{l.text}</pre>
              ) : (
                <pre className="text-slate-300 whitespace-pre-wrap">{l.text}</pre>
              )}
            </div>
          ))}
          {isExecuting && (
            <div className="flex items-center gap-2 text-teal-400 animate-pulse text-xs">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
              <span>repoman executing pipeline...</span>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Terminal Input Prompt */}
        <div className="p-3 bg-slate-900/60 border-t border-slate-800 flex items-center gap-2">
          <span className="font-mono text-teal-400 font-bold text-xs select-none pl-2">repoman $</span>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isExecuting}
            placeholder="Type command (e.g. repoman status)..."
            className="flex-1 bg-transparent border-none text-white font-mono text-xs focus:outline-none placeholder-slate-600"
            autoFocus
          />
          <button
            onClick={() => handleExecute()}
            disabled={isExecuting || !input.trim()}
            className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs rounded-lg transition disabled:opacity-50 flex items-center gap-1"
          >
            <span>Run</span>
            <CornerDownLeft className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};
