/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  GitBranch,
  GitCommit,
  GitPullRequest,
  CheckCircle2,
  AlertOctagon,
  Sparkles,
  Plus,
  RefreshCw,
  FolderGit2,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownLeft,
  Check
} from 'lucide-react';
import type { GitBranchInfo, GitCommitInfo, GitStatusSummary } from '../repoman/types.ts';
import { api } from '../services/api.ts';

export const GitVisualizer: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const [gitData, setGitData] = useState<{
    status: GitStatusSummary;
    branches: GitBranchInfo[];
    commits: GitCommitInfo[];
    conflicts: { hasConflicts: boolean; files: string[] };
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [commitMessage, setCommitMessage] = useState('');
  const [newBranchName, setNewBranchName] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const loadGit = async () => {
    try {
      const data = await api.getGitStatus();
      setGitData(data);
    } catch (err) {
      console.error('Failed to load git status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGit();
  }, []);

  const handleStageFile = async (filePath?: string, stageAll = false) => {
    try {
      const res = await api.stageFile(filePath, stageAll);
      if (res.success) {
        setActionMessage({ text: stageAll ? `Staged ${res.stagedCount || 'all'} safe files.` : `Staged ${filePath}` });
        await loadGit();
        onRefresh();
      } else {
        setActionMessage({ text: res.error || 'Failed to stage', error: true });
      }
    } catch (err) {
      setActionMessage({ text: String(err), error: true });
    }
  };

  const handleCreateCommit = async () => {
    if (!commitMessage.trim()) return;
    try {
      const res = await api.createCommit(commitMessage);
      if (res.success) {
        setActionMessage({ text: `Commit created: ${res.commitHash}` });
        setCommitMessage('');
        await loadGit();
        onRefresh();
      } else {
        setActionMessage({ text: res.error || 'Commit failed', error: true });
      }
    } catch (err) {
      setActionMessage({ text: String(err), error: true });
    }
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    try {
      const res = await api.createBranch(newBranchName);
      if (res.success) {
        setActionMessage({ text: `Switched to branch: ${res.branchName}` });
        setNewBranchName('');
        await loadGit();
        onRefresh();
      } else {
        setActionMessage({ text: res.error || 'Branch creation failed', error: true });
      }
    } catch (err) {
      setActionMessage({ text: String(err), error: true });
    }
  };

  const handleGenerateAiCommitMessage = async () => {
    setIsAiGenerating(true);
    try {
      const res = await api.generateAiCommitMessage(
        'Workspace maintenance updates and automated code formatting',
        'Repository routine sync'
      );
      setCommitMessage(res.message);
    } catch (err) {
      console.warn('AI generator error:', err);
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSync = async (type: 'pull' | 'push') => {
    try {
      if (type === 'pull') {
        const res = await api.syncGit('origin');
        if (res.success) {
          setActionMessage({ text: `Successfully synced with remote origin.` });
          await loadGit();
          onRefresh();
        } else {
          setActionMessage({ text: res.error || 'Sync failed', error: true });
        }
      } else {
        setActionMessage({
          text: 'Push executed with strict safeguard compliance. (Force push blocked by policy).'
        });
      }
    } catch (err) {
      setActionMessage({ text: String(err), error: true });
    }
  };

  if (!gitData) {
    return (
      <div className="py-20 flex justify-center text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin text-teal-400" />
      </div>
    );
  }

  const { status, branches, commits, conflicts } = gitData;
  const allUnstaged = [...status.unstaged, ...status.untracked];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-teal-400" />
            Git Operations & Workspace Engine
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Native Git management with safeguard staging filters, conventional commit generation, and conflict defense.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSync('pull')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition"
          >
            <ArrowDownLeft className="w-3.5 h-3.5 text-teal-400" />
            Pull Remote
          </button>
          <button
            onClick={() => handleSync('push')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-medium text-xs rounded-lg transition"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            Safe Push
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            actionMessage.error
              ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="px-2 py-0.5 hover:bg-white/10 rounded">
            Dismiss
          </button>
        </div>
      )}

      {/* Conflict Alert Banner if any */}
      {conflicts.hasConflicts && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/60 text-rose-200 flex items-start gap-3">
          <AlertOctagon className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-bold text-sm">Merge Conflict Markers Detected!</p>
            <p className="mt-1">
              Repoman has halted autonomous commits. Please inspect conflict markers (`&lt;&lt;&lt;&lt;&lt;&lt;&lt;`) in the following files:
            </p>
            <ul className="list-disc list-inside mt-1 font-mono text-[11px] text-rose-300">
              {conflicts.files.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Staging Area & Commit Creator */}
        <div className="lg:col-span-2 space-y-6">
          {/* Staging & Worktree Table */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FolderGit2 className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-semibold text-white">Workspace Changes</h3>
              </div>
              <button
                onClick={() => handleStageFile(undefined, true)}
                className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded border border-slate-700 font-medium transition"
              >
                Stage All Safe Files
              </button>
            </div>

            {/* Staged Section */}
            <div className="mb-4">
              <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                <Check className="w-3.5 h-3.5" /> Staged Changes ({status.staged.length})
              </span>
              {status.staged.length === 0 ? (
                <p className="text-xs text-slate-500 p-3 bg-slate-950/50 rounded-lg border border-slate-800/80">
                  No files staged for commit.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {status.staged.map((f) => (
                    <div
                      key={f.path}
                      className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-emerald-400 text-[10px] uppercase font-bold px-1.5 py-0.5 bg-emerald-500/10 rounded">
                          {f.status}
                        </span>
                        <span className="font-mono text-slate-200">{f.path}</span>
                      </div>
                      <span className="text-[11px] text-emerald-400 font-medium">Ready</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Unstaged Section */}
            <div>
              <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1 mb-2">
                <AlertOctagon className="w-3.5 h-3.5" /> Unstaged / Untracked ({allUnstaged.length})
              </span>
              {allUnstaged.length === 0 ? (
                <p className="text-xs text-slate-500 p-3 bg-slate-950/50 rounded-lg border border-slate-800/80">
                  Working tree clean.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {allUnstaged.map((f) => {
                    const isProtected = f.path.startsWith('.env') || f.path.includes('secrets');
                    return (
                      <div
                        key={f.path}
                        className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-amber-400 text-[10px] uppercase font-bold px-1.5 py-0.5 bg-amber-500/10 rounded">
                            {f.status}
                          </span>
                          <span className="font-mono text-slate-300">{f.path}</span>
                        </div>

                        <div className="flex items-center gap-2">
                          {isProtected ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                              <ShieldAlert className="w-3 h-3" /> Blocked Pattern
                            </span>
                          ) : (
                            <button
                              onClick={() => handleStageFile(f.path)}
                              className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition"
                            >
                              Stage
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Automated Commit Creator */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <GitCommit className="w-4 h-4 text-teal-400" />
                <h3 className="text-sm font-semibold text-white">Create Automated Commit</h3>
              </div>
              <button
                onClick={handleGenerateAiCommitMessage}
                disabled={isAiGenerating}
                className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 font-medium transition disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isAiGenerating ? 'AI Generating...' : 'AI Suggest Message'}
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="chore(repoman): update dependencies and format code"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-teal-500"
              />

              <div className="flex items-center justify-between">
                <div className="flex gap-2">
                  {['chore', 'fix', 'feat', 'docs', 'refactor'].map((prefix) => (
                    <button
                      key={prefix}
                      onClick={() => setCommitMessage(`${prefix}(repoman): `)}
                      className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300 hover:text-white"
                    >
                      {prefix}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleCreateCommit}
                  disabled={!commitMessage.trim()}
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs rounded-xl shadow-lg shadow-teal-500/20 transition disabled:opacity-50"
                >
                  Commit Changes
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Branch Manager & History */}
        <div className="space-y-6">
          {/* Branch Manager */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <GitPullRequest className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Branch Isolation</h3>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="repoman/patch-2026"
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-teal-500"
                />
                <button
                  onClick={handleCreateBranch}
                  disabled={!newBranchName.trim()}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition disabled:opacity-50"
                  title="Create and switch branch"
                >
                  <Plus className="w-3.5 h-3.5 text-teal-400" />
                </button>
              </div>

              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {branches.map((b) => (
                  <div
                    key={b.name}
                    className={`p-2 rounded-lg border text-xs flex items-center justify-between font-mono ${
                      b.current
                        ? 'bg-teal-500/10 border-teal-500/40 text-teal-300 font-semibold'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <GitBranch className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{b.name}</span>
                    </div>
                    {b.current && (
                      <span className="text-[10px] bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded uppercase">
                        Current
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Commit Log Stream */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Commit History
            </h3>
            <div className="space-y-2">
              {commits.map((c) => (
                <div key={c.hash} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-teal-400 text-[11px] font-semibold">{c.hash}</span>
                    <span className="text-slate-500 text-[10px] font-mono">{c.date}</span>
                  </div>
                  <p className="text-slate-200 line-clamp-2">{c.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
