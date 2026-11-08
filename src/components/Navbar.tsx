/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  ShieldCheck,
  Terminal,
  RotateCcw,
  GitBranch,
  PlayCircle,
  FileText,
  Settings,
  BookOpen,
  RefreshCw,
  FolderGit2
} from 'lucide-react';

export type TabKey =
  | 'dashboard'
  | 'jobs'
  | 'git'
  | 'rollback'
  | 'audit'
  | 'terminal'
  | 'config'
  | 'docs';

interface NavbarProps {
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  activeRepo: string;
  onRepoChange?: (repo: string) => void;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  activeRepo,
  onRefresh,
  isRefreshing
}) => {
  const tabs = [
    { key: 'dashboard' as TabKey, label: 'Dashboard', icon: ShieldCheck },
    { key: 'jobs' as TabKey, label: 'Job Runner', icon: PlayCircle },
    { key: 'git' as TabKey, label: 'Git Engine', icon: GitBranch },
    { key: 'rollback' as TabKey, label: 'Rollbacks', icon: RotateCcw },
    { key: 'audit' as TabKey, label: 'Audit Trail', icon: FileText },
    { key: 'terminal' as TabKey, label: 'CLI Terminal', icon: Terminal },
    { key: 'config' as TabKey, label: 'Safeguards', icon: Settings },
    { key: 'docs' as TabKey, label: 'Guide & Specs', icon: BookOpen }
  ];

  return (
    <header className="sticky top-0 z-50 bg-slate-950/95 backdrop-blur-md border-b border-slate-800 text-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 via-emerald-500 to-teal-400 p-0.5 shadow-lg shadow-teal-900/30">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-teal-400 font-mono font-bold text-lg">
              R⚙
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white font-mono">
                repoman<span className="text-teal-400">-agent</span>
              </span>
              <span className="px-1.5 py-0.5 text-[10px] uppercase font-mono font-semibold tracking-wider bg-teal-500/10 text-teal-300 border border-teal-500/30 rounded">
                v1.0.0
              </span>
              <span className="px-1.5 py-0.5 text-[10px] uppercase font-mono font-semibold tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Guarded
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Autonomous Local & Git Workflow Automation
            </p>
          </div>
        </div>

        {/* Repository selector & refresh */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs text-slate-300">
            <FolderGit2 className="w-3.5 h-3.5 text-teal-400" />
            <span className="text-slate-400">Target:</span>
            <span className="font-mono text-white font-medium">{activeRepo}</span>
          </div>

          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh System State"
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-teal-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-t border-slate-800/80 bg-slate-950/70 overflow-x-auto scrollbar-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 py-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => onTabChange(tab.key)}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-teal-500/15 text-teal-300 border border-teal-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-teal-400' : 'text-slate-500'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
