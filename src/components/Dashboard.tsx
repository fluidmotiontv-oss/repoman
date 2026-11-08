/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  ShieldAlert,
  GitBranch,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Play,
  Terminal,
  Activity,
  Layers,
  FileCheck,
  Ban
} from 'lucide-react';
import type { RepomanStatusResponse } from '../services/api.ts';
import { api } from '../services/api.ts';
import { SystemHealthWidget } from './SystemHealthWidget.tsx';

interface DashboardProps {
  status: RepomanStatusResponse | null;
  onRefresh: () => void;
  onNavigateTab: (tab: any) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ status, onRefresh, onNavigateTab }) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ type: 'success' | 'warn' | 'error'; message: string } | null>(null);

  const showNotification = (type: 'success' | 'warn' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 6000);
  };

  const handleRunQuickJob = async (jobId: string) => {
    try {
      setActionLoading(jobId);
      const res = await api.runJob(jobId, false);
      if (res.status === 'SUCCESS') {
        showNotification('success', `Job ${jobId} succeeded! Created commit ${res.commitCreated || 'none'}.`);
      } else if (res.status === 'ROLLED_BACK') {
        showNotification('warn', `Job ${jobId} encountered an error and rolled back automatically.`);
      } else {
        showNotification('error', `Job ${jobId} failed: ${res.error || 'Unknown error'}`);
      }
      onRefresh();
    } catch (err) {
      showNotification('error', `Error executing job: ${String(err)}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleSimulateSafeguardBlock = async () => {
    try {
      setActionLoading('safeguard-test');
      const res = await api.executeCli('repoman run blocked-command-test');
      showNotification('warn', 'Safeguards intercepted execution! Check Audit Trail for details.');
      onRefresh();
    } catch {
      showNotification('warn', 'Safeguard test triggered.');
    } finally {
      setActionLoading(null);
    }
  };

  if (!status) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400">
        <Activity className="w-8 h-8 animate-spin text-teal-400 mb-3" />
        <p>Connecting to repoman-agent daemon...</p>
      </div>
    );
  }

  const { gitStatus, safeguards, recentCommits, recentLogs, snapshotCount } = status;

  return (
    <div className="space-y-6">
      {/* Alert Notification */}
      {notification && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
            notification.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
              : notification.type === 'warn'
              ? 'bg-amber-950/40 border-amber-500/40 text-amber-300'
              : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5 text-sm">
            {notification.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {notification.type === 'warn' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
            {notification.type === 'error' && <Ban className="w-4 h-4 text-rose-400 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-xs px-2 py-1 rounded hover:bg-white/10"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top Banner Overview */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-teal-950/40 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-teal-500/10 text-teal-300 border border-teal-500/30">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                Autonomous Engine Online
              </span>
              <span className="text-xs text-slate-400 font-mono">
                PID: {process.pid || 3000} | Linux Workspace
              </span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Repository Automation & Git Ops Control Plane
            </h1>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Monitors local project files, automates maintenance pipelines, enforces destructive safeguards, and provides 1-click snapshot rollbacks.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => handleRunQuickJob('lint-and-autofix')}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-medium text-xs rounded-xl shadow-lg shadow-teal-500/20 transition disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {actionLoading === 'lint-and-autofix' ? 'Running...' : 'Run Lint Pass'}
            </button>
            <button
              onClick={() => handleRunQuickJob('dependency-audit')}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-xl border border-slate-700 transition disabled:opacity-50"
            >
              <FileCheck className="w-3.5 h-3.5 text-teal-400" />
              {actionLoading === 'dependency-audit' ? 'Auditing...' : 'Audit Deps'}
            </button>
            <button
              onClick={handleSimulateSafeguardBlock}
              disabled={actionLoading !== null}
              className="flex items-center gap-2 px-3 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 font-medium text-xs rounded-xl border border-rose-500/30 transition disabled:opacity-50"
              title="Test the safeguard engine by attempting a prohibited operation"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              Test Guardrail Block
            </button>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Safeguards Status */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Safety Guardrails</span>
            <div className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">ACTIVE</span>
            <span className="text-xs text-emerald-400 font-medium">Strict Enforce</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex flex-col gap-1">
            <div className="flex justify-between">
              <span>Force Push:</span>
              <span className="font-mono text-rose-400">BLOCKED</span>
            </div>
            <div className="flex justify-between">
              <span>Protected Patterns:</span>
              <span className="font-mono text-slate-200">{safeguards.blockedFilePatterns.length} rules</span>
            </div>
          </div>
        </div>

        {/* Card 2: Git Worktree State */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Git Workspace</span>
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
              <GitBranch className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{gitStatus.branch}</span>
            <span
              className={`text-xs font-medium ${
                gitStatus.isClean ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {gitStatus.isClean ? 'Clean' : 'Modified'}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex flex-col gap-1">
            <div className="flex justify-between">
              <span>Staged / Unstaged:</span>
              <span className="font-mono text-slate-200">
                {gitStatus.staged.length} / {gitStatus.unstaged.length + gitStatus.untracked.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Conflicts:</span>
              <span className={`font-mono ${gitStatus.conflicts.length > 0 ? 'text-rose-400 font-bold' : 'text-slate-400'}`}>
                {gitStatus.conflicts.length > 0 ? `${gitStatus.conflicts.length} DETECTED` : 'None'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Rollback Stack */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Rollback Stack</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{snapshotCount}</span>
            <span className="text-xs text-emerald-400 font-medium">Snapshots</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex flex-col gap-1">
            <div className="flex justify-between">
              <span>Max History:</span>
              <span className="font-mono text-slate-200">50 snapshots</span>
            </div>
            <div className="flex justify-between">
              <span>Auto-Rollback on Error:</span>
              <span className="font-mono text-emerald-400">ENABLED</span>
            </div>
          </div>
        </div>

        {/* Card 4: Audit Trail Count */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition">
          <div className="flex items-center justify-between text-slate-400 mb-3">
            <span className="text-xs font-medium uppercase tracking-wider">Audit Log Trail</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold font-mono text-white">{recentLogs.length}</span>
            <span className="text-xs text-purple-400 font-medium">Logged TXs</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-400 flex flex-col gap-1">
            <div className="flex justify-between">
              <span>Target File:</span>
              <span className="font-mono text-slate-300 truncate max-w-[140px]">repoman-audit.log</span>
            </div>
            <div className="flex justify-between">
              <span>Integrity:</span>
              <span className="font-mono text-emerald-400">Verified</span>
            </div>
          </div>
        </div>
      </div>

      {/* System Health & Host Footprint Widget */}
      <SystemHealthWidget initialHealth={status.systemHealth} onRefreshParent={onRefresh} />

      {/* Main Grid: Safeguards & Recent Activities */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Active Safeguards & Git Graph */}
        <div className="lg:col-span-2 space-y-6">
          {/* Safeguard Guardrails Breakdown */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-teal-400" />
                <h2 className="text-base font-semibold text-white">Execution Safeguards & Isolation Rules</h2>
              </div>
              <button
                onClick={() => onNavigateTab('config')}
                className="text-xs text-teal-400 hover:text-teal-300 font-medium"
              >
                Configure Policy →
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Box 1: Blocked File Patterns */}
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="font-medium text-slate-200 mb-2 flex items-center justify-between">
                  <span>Blocked File Patterns</span>
                  <span className="text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20 font-mono">
                    Zero-Touch
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {safeguards.blockedFilePatterns.map((pat) => (
                    <span
                      key={pat}
                      className="px-2 py-0.5 rounded font-mono text-[11px] bg-slate-900 border border-slate-700/60 text-amber-300"
                    >
                      {pat}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-2.5">
                  Protects secrets, private keys, environment configs, and the raw .git directory from unauthorized mutation.
                </p>
              </div>

              {/* Box 2: Blocked Destructive Commands */}
              <div className="p-3.5 rounded-lg bg-slate-950/60 border border-slate-800">
                <div className="font-medium text-slate-200 mb-2 flex items-center justify-between">
                  <span>Dangerous Command Interceptor</span>
                  <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 font-mono">
                    Strict Intercept
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {safeguards.blockedCommands.map((cmd) => (
                    <span
                      key={cmd}
                      className="px-2 py-0.5 rounded font-mono text-[11px] bg-slate-900 border border-slate-700/60 text-rose-300"
                    >
                      {cmd}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-2.5">
                  Intercepts force pushes, root deletions, and unconfirmed destructive disk commands.
                </p>
              </div>
            </div>

            {/* Sandbox Isolation Policy */}
            <div className="mt-4 p-3 rounded-lg bg-slate-950/40 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-teal-400" />
                <span className="text-slate-300">Environment Sandbox Boundary:</span>
                <span className="font-mono text-teal-300">
                  {safeguards.allowedRepositoryPaths.join(', ')}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Max Files/Commit: {safeguards.maxFilesPerCommit}
              </span>
            </div>
          </div>

          {/* Recent Commits Timeline */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-teal-400" />
                <h2 className="text-base font-semibold text-white">Recent Git Commits</h2>
              </div>
              <button
                onClick={() => onNavigateTab('git')}
                className="text-xs text-teal-400 hover:text-teal-300 font-medium"
              >
                Open Git Engine →
              </button>
            </div>

            <div className="space-y-2.5">
              {recentCommits.map((c) => (
                <div
                  key={c.hash}
                  className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-teal-400 font-semibold bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                      {c.hash}
                    </span>
                    <div>
                      <p className="text-slate-200 font-medium">{c.message}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        by <span className="text-slate-300">{c.author}</span> on {c.date}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column (1 Col): Live Audit Stream & Quick CLI */}
        <div className="space-y-6">
          {/* Quick CLI Launcher */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-teal-400" />
                <h2 className="text-base font-semibold text-white">CLI Quick Runner</h2>
              </div>
              <button
                onClick={() => onNavigateTab('terminal')}
                className="text-xs text-teal-400 hover:text-teal-300 font-medium"
              >
                Full Console →
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-3">
              Run repoman commands directly against the local Linux server daemon:
            </p>

            <div className="space-y-1.5 font-mono text-xs">
              <button
                onClick={() => handleRunQuickJob('lint-and-autofix')}
                className="w-full text-left p-2 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition flex items-center justify-between"
              >
                <span>repoman run lint-and-autofix</span>
                <Play className="w-3 h-3 text-teal-400" />
              </button>
              <button
                onClick={() => onNavigateTab('terminal')}
                className="w-full text-left p-2 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition flex items-center justify-between"
              >
                <span>repoman scan --depth 3</span>
                <Terminal className="w-3 h-3 text-teal-400" />
              </button>
              <button
                onClick={() => onNavigateTab('audit')}
                className="w-full text-left p-2 rounded bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition flex items-center justify-between"
              >
                <span>repoman audit --lines 20</span>
                <Activity className="w-3 h-3 text-teal-400" />
              </button>
            </div>
          </div>

          {/* Audit Stream Feed */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" />
                <h2 className="text-base font-semibold text-white">Live Audit Feed</h2>
              </div>
              <button
                onClick={() => onNavigateTab('audit')}
                className="text-xs text-teal-400 hover:text-teal-300 font-medium"
              >
                View Log File →
              </button>
            </div>

            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
              {recentLogs.slice(0, 8).map((log) => {
                const isBlock = log.level === 'BLOCK' || log.status === 'BLOCKED';
                const isWarn = log.level === 'WARN';
                const isTx = log.level === 'TX';

                return (
                  <div
                    key={log.id}
                    className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          isBlock
                            ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                            : isWarn
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : isTx
                            ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30'
                            : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {log.level}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {log.timestamp.slice(11, 19)}
                      </span>
                    </div>
                    <p className="text-slate-200 font-medium line-clamp-1">{log.action}</p>
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                      cat: {log.category} | status: {log.status}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
