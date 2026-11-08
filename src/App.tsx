/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar, type TabKey } from './components/Navbar.tsx';
import { Dashboard } from './components/Dashboard.tsx';
import { JobRunnerPanel } from './components/JobRunnerPanel.tsx';
import { GitVisualizer } from './components/GitVisualizer.tsx';
import { RollbackManager } from './components/RollbackManager.tsx';
import { AuditLogViewer } from './components/AuditLogViewer.tsx';
import { TerminalEmulator } from './components/TerminalEmulator.tsx';
import { ConfigEditor } from './components/ConfigEditor.tsx';
import { DocsAndGuide } from './components/DocsAndGuide.tsx';
import { api, type RepomanStatusResponse } from './services/api.ts';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [status, setStatus] = useState<RepomanStatusResponse | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStatus = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await api.getStatus();
      setStatus(data);
    } catch (err) {
      console.warn('Could not connect to repoman server status:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000); // 15s gentle poll
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-teal-500 selection:text-slate-950">
      {/* Top Navbar */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        activeRepo={status?.activeRepository || 'local-repo'}
        onRefresh={fetchStatus}
        isRefreshing={isRefreshing}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'dashboard' && (
          <Dashboard
            status={status}
            onRefresh={fetchStatus}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'jobs' && <JobRunnerPanel onRefresh={fetchStatus} />}

        {activeTab === 'git' && <GitVisualizer onRefresh={fetchStatus} />}

        {activeTab === 'rollback' && <RollbackManager onRefresh={fetchStatus} />}

        {activeTab === 'audit' && <AuditLogViewer onRefresh={fetchStatus} />}

        {activeTab === 'terminal' && <TerminalEmulator />}

        {activeTab === 'config' && <ConfigEditor onRefresh={fetchStatus} />}

        {activeTab === 'docs' && <DocsAndGuide />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono font-medium text-slate-400">repoman-agent</span>
            <span>•</span>
            <span>Autonomous Local & Git Workflow Automation</span>
          </div>

          <div className="flex items-center gap-3 font-mono text-[11px]">
            <span className="flex items-center gap-1.5 text-teal-400/90">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              Guardrails Strict
            </span>
            <span>•</span>
            <span>Audit: ./repoman-audit.log</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
