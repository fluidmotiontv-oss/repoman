/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SafeguardRules {
  allowForcePush: boolean;
  blockedFilePatterns: string[]; // e.g. ['.env*', '*.pem', 'id_rsa*', 'secrets/**', 'credentials.*']
  blockedCommands: string[]; // e.g. ['rm -rf /', 'dropdb', 'mkfs', 'dd']
  requireCleanWorkingTree: boolean;
  maxFilesPerCommit: number;
  maxLinesChangedPerJob: number;
  allowedRepositoryPaths: string[]; // Sandboxing boundary
  requireConfirmationForDestructive: boolean;
}

export interface MaintenanceJobDefinition {
  id: string;
  name: string;
  description: string;
  category: 'lint' | 'security' | 'deps' | 'sync' | 'format' | 'build' | 'custom';
  schedule?: string; // cron format or interval
  steps: {
    name: string;
    command: string;
    continueOnError?: boolean;
    rollbackOnFailure?: boolean;
    timeoutMs?: number;
  }[];
  autoCommit?: boolean;
  commitMessageTemplate?: string;
  createBranch?: boolean;
  branchPrefix?: string;
}

export interface RepomanConfig {
  version: string;
  agentName: string;
  activeRepository: string;
  repositories: {
    name: string;
    path: string;
    defaultBranch: string;
    remote: string;
  }[];
  safeguards: SafeguardRules;
  jobs: MaintenanceJobDefinition[];
  logging: {
    logFilePath: string;
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    consoleOutput: boolean;
  };
}

export type AuditLogLevel = 'INFO' | 'WARN' | 'BLOCK' | 'TX' | 'SAFE' | 'ERROR';

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  level: AuditLogLevel;
  category: 'GIT' | 'FILE' | 'JOB' | 'SAFEGUARD' | 'CLI';
  action: string;
  repo: string;
  details: Record<string, unknown>;
  status: 'SUCCESS' | 'BLOCKED' | 'FAILED' | 'ROLLED_BACK';
  userConfirmationGranted?: boolean;
}

export interface WorkspaceSnapshot {
  id: string;
  timestamp: string;
  jobId?: string;
  description: string;
  repoPath: string;
  files: {
    relativePath: string;
    content: string;
    existed: boolean;
  }[];
}

export interface GitBranchInfo {
  name: string;
  current: boolean;
  commitHash: string;
  upstream?: string;
  ahead?: number;
  behind?: number;
}

export interface GitCommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
  tags?: string[];
}

export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed' | 'conflict';
  staged: boolean;
  diffSummary?: string;
}

export interface GitStatusSummary {
  branch: string;
  isClean: boolean;
  staged: GitFileStatus[];
  unstaged: GitFileStatus[];
  untracked: GitFileStatus[];
  conflicts: string[];
  ahead: number;
  behind: number;
}

export interface JobExecutionResult {
  jobId: string;
  jobName: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'ROLLED_BACK' | 'BLOCKED';
  startTime: string;
  endTime?: string;
  durationMs?: number;
  branchCreated?: string;
  commitCreated?: string;
  snapshotId?: string;
  stepResults: {
    stepName: string;
    command: string;
    exitCode: number;
    output: string;
    durationMs: number;
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  }[];
  error?: string;
  filesModified?: string[];
}

export interface SystemHealthData {
  status: 'HEALTHY' | 'ELEVATED' | 'CRITICAL';
  cpu: {
    usagePercent: number;
    cores: number;
    model: string;
    loadAvg: [number, number, number];
  };
  memory: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usagePercent: number;
    processRssBytes: number;
    processHeapUsedBytes: number;
  };
  disk: {
    totalBytes: number;
    freeBytes: number;
    usedBytes: number;
    usagePercent: number;
    mountPath: string;
  };
  uptime: {
    systemSeconds: number;
    processSeconds: number;
  };
  timestamp: string;
}
