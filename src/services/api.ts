/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  AuditLogEntry,
  GitBranchInfo,
  GitCommitInfo,
  GitStatusSummary,
  JobExecutionResult,
  MaintenanceJobDefinition,
  RepomanConfig,
  SafeguardRules,
  SystemHealthData,
  WorkspaceSnapshot
} from '../repoman/types.ts';

export interface RepomanStatusResponse {
  agentName: string;
  version: string;
  activeRepository: string;
  gitStatus: GitStatusSummary;
  branches: GitBranchInfo[];
  recentCommits: GitCommitInfo[];
  recentLogs: AuditLogEntry[];
  snapshotCount: number;
  safeguards: SafeguardRules;
  hasGeminiKey: boolean;
  systemHealth?: SystemHealthData;
}

export interface WorkspaceFileItem {
  path: string;
  isDir: boolean;
  size: number;
  safeguard: {
    passed: boolean;
    reason?: string;
    category: string;
  };
}

export const api = {
  async getStatus(): Promise<RepomanStatusResponse> {
    const res = await fetch('/api/repoman/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch status`);
    return res.json();
  },

  async getConfig(): Promise<RepomanConfig> {
    const res = await fetch('/api/repoman/config');
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch config`);
    return res.json();
  },

  async saveConfig(config: RepomanConfig): Promise<{ success: boolean; config: RepomanConfig }> {
    const res = await fetch('/api/repoman/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to save config`);
    return res.json();
  },

  async getJobs(): Promise<{ jobs: MaintenanceJobDefinition[]; history: JobExecutionResult[] }> {
    const res = await fetch('/api/repoman/jobs');
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch jobs`);
    return res.json();
  },

  async runJob(jobId: string, confirm = false): Promise<JobExecutionResult> {
    const res = await fetch('/api/repoman/jobs/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobId, confirm })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to run job`);
    return res.json();
  },

  async getGitStatus(): Promise<{
    status: GitStatusSummary;
    branches: GitBranchInfo[];
    commits: GitCommitInfo[];
    conflicts: { hasConflicts: boolean; files: string[] };
  }> {
    const res = await fetch('/api/repoman/git/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch git status`);
    return res.json();
  },

  async stageFile(path?: string, stageAll = false): Promise<{ success: boolean; error?: string; stagedCount?: number }> {
    const res = await fetch('/api/repoman/git/stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, stageAll })
    });
    return res.json();
  },

  async createCommit(message: string, author?: string): Promise<{ success: boolean; commitHash?: string; error?: string }> {
    const res = await fetch('/api/repoman/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, author })
    });
    return res.json();
  },

  async createBranch(name: string): Promise<{ success: boolean; branchName: string; error?: string }> {
    const res = await fetch('/api/repoman/git/branch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    return res.json();
  },

  async syncGit(remote = 'origin', branch?: string): Promise<{ success: boolean; output: string; error?: string }> {
    const res = await fetch('/api/repoman/git/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remote, branch })
    });
    return res.json();
  },

  async getWorkspaceFiles(): Promise<{ files: WorkspaceFileItem[] }> {
    const res = await fetch('/api/repoman/workspace/files');
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch files`);
    return res.json();
  },

  async getFileContent(filePath: string): Promise<{ success: boolean; content?: string; error?: string }> {
    const res = await fetch(`/api/repoman/workspace/file?path=${encodeURIComponent(filePath)}`);
    return res.json();
  },

  async writeFileContent(
    filePath: string,
    content: string,
    description?: string
  ): Promise<{ success: boolean; snapshot?: WorkspaceSnapshot; error?: string }> {
    const res = await fetch('/api/repoman/workspace/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath, content, description })
    });
    return res.json();
  },

  async getSnapshots(): Promise<{ snapshots: WorkspaceSnapshot[] }> {
    const res = await fetch('/api/repoman/workspace/snapshots');
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch snapshots`);
    return res.json();
  },

  async rollbackSnapshot(snapshotId: string): Promise<{ success: boolean; filesRestored: string[]; error?: string }> {
    const res = await fetch('/api/repoman/workspace/rollback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ snapshotId })
    });
    return res.json();
  },

  async getAuditLogs(limit = 100): Promise<{ logs: AuditLogEntry[]; rawText: string }> {
    const res = await fetch(`/api/repoman/audit/logs?limit=${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch audit logs`);
    return res.json();
  },

  async clearAuditLogs(): Promise<{ success: boolean }> {
    const res = await fetch('/api/repoman/audit/clear', { method: 'POST' });
    return res.json();
  },

  async executeCli(command: string): Promise<{ output: string }> {
    const res = await fetch('/api/repoman/cli/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
    return res.json();
  },

  async generateAiCommitMessage(diff?: string, description?: string): Promise<{ message: string }> {
    const res = await fetch('/api/repoman/ai/commit-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ diff, description })
    });
    return res.json();
  },

  async getSystemHealth(): Promise<SystemHealthData> {
    const res = await fetch('/api/repoman/system-health');
    if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch system health`);
    return res.json();
  }
};
