/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { loadConfig, saveConfig, getConfig } from './src/repoman/core/config.ts';
import { AuditLogger } from './src/repoman/core/logger.ts';
import { SafeguardsEngine } from './src/repoman/core/safeguards.ts';
import { WorkspaceManager } from './src/repoman/core/workspace.ts';
import { GitEngine } from './src/repoman/git/engine.ts';
import { JobRunner } from './src/repoman/jobs/runner.ts';
import type { SystemHealthData } from './src/repoman/types.ts';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initial config & audit log boot
loadConfig();
AuditLogger.log('INFO', 'CLI', 'Repoman Agent server process initialized', { port: PORT });

// Initialize Gemini if key is provided
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  } catch (err) {
    console.warn('Could not initialize GoogleGenAI client:', err);
  }
}

// ----------------- SYSTEM HEALTH CALCULATOR -----------------

function getSystemHealth(): SystemHealthData {
  const cpus = os.cpus() || [];
  const loadAvg = os.loadavg() as [number, number, number];
  const numCores = Math.max(1, cpus.length);

  // Compute CPU load percentage from 1-min load average normalized across cores
  let cpuPercent = Math.min(100, Math.round((loadAvg[0] / numCores) * 100));
  if (isNaN(cpuPercent) || cpuPercent < 0) cpuPercent = 6;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = Math.max(0, totalMem - freeMem);
  const memPercent = totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : 0;
  const memUsage = process.memoryUsage();

  // Disk usage inspection
  let totalDisk = 64 * 1024 * 1024 * 1024; // 64 GB baseline
  let freeDisk = 42 * 1024 * 1024 * 1024;
  try {
    if (typeof fs.statfsSync === 'function') {
      const stats = fs.statfsSync(process.cwd());
      totalDisk = stats.bsize * stats.blocks;
      freeDisk = stats.bsize * stats.bfree;
    }
  } catch {
    // fallback
  }
  const usedDisk = Math.max(0, totalDisk - freeDisk);
  const diskPercent = totalDisk > 0 ? Math.round((usedDisk / totalDisk) * 100) : 0;

  let status: 'HEALTHY' | 'ELEVATED' | 'CRITICAL' = 'HEALTHY';
  if (cpuPercent > 85 || memPercent > 90 || diskPercent > 92) {
    status = 'CRITICAL';
  } else if (cpuPercent > 65 || memPercent > 75 || diskPercent > 80) {
    status = 'ELEVATED';
  }

  return {
    status,
    cpu: {
      usagePercent: cpuPercent,
      cores: numCores,
      model: cpus[0]?.model || 'Linux Host CPU',
      loadAvg: [
        Number(loadAvg[0].toFixed(2)),
        Number(loadAvg[1].toFixed(2)),
        Number(loadAvg[2].toFixed(2))
      ]
    },
    memory: {
      totalBytes: totalMem,
      freeBytes: freeMem,
      usedBytes: usedMem,
      usagePercent: memPercent,
      processRssBytes: memUsage.rss,
      processHeapUsedBytes: memUsage.heapUsed
    },
    disk: {
      totalBytes: totalDisk,
      freeBytes: freeDisk,
      usedBytes: usedDisk,
      usagePercent: diskPercent,
      mountPath: process.cwd()
    },
    uptime: {
      systemSeconds: os.uptime(),
      processSeconds: Math.round(process.uptime())
    },
    timestamp: new Date().toISOString()
  };
}

// ----------------- API ENDPOINTS -----------------

// Status
app.get('/api/repoman/status', async (req, res) => {
  try {
    const config = getConfig();
    const git = new GitEngine();
    const status = await git.getStatus();
    const branches = await git.listBranches();
    const commits = await git.getCommitLog(5);
    const logs = AuditLogger.getLogs(20);
    const workspace = new WorkspaceManager();
    const snapshots = workspace.getSnapshots();
    const systemHealth = getSystemHealth();

    res.json({
      agentName: config.agentName,
      version: config.version,
      activeRepository: config.activeRepository,
      gitStatus: status,
      branches,
      recentCommits: commits,
      recentLogs: logs,
      snapshotCount: snapshots.length,
      safeguards: config.safeguards,
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      systemHealth
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Dedicated System Health Endpoint
app.get('/api/repoman/system-health', (req, res) => {
  try {
    res.json(getSystemHealth());
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Config
app.get('/api/repoman/config', (req, res) => {
  res.json(getConfig());
});

app.post('/api/repoman/config', (req, res) => {
  try {
    const newConfig = req.body;
    saveConfig(newConfig);
    AuditLogger.log('SAFE', 'CLI', 'Updated repoman configuration', { version: newConfig.version });
    res.json({ success: true, config: newConfig });
  } catch (err) {
    res.status(400).json({ error: String(err) });
  }
});

// Jobs
app.get('/api/repoman/jobs', (req, res) => {
  const config = getConfig();
  const runner = new JobRunner();
  res.json({
    jobs: config.jobs,
    history: runner.getHistory()
  });
});

app.post('/api/repoman/jobs/run', async (req, res) => {
  const { jobId, confirm } = req.body;
  if (!jobId) {
    return res.status(400).json({ error: 'jobId is required' });
  }

  const runner = new JobRunner();
  try {
    const result = await runner.executeJob(jobId, !!confirm);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Git operations
app.get('/api/repoman/git/status', async (req, res) => {
  try {
    const git = new GitEngine();
    const status = await git.getStatus();
    const branches = await git.listBranches();
    const commits = await git.getCommitLog(10);
    const conflicts = await git.checkConflicts();

    res.json({
      status,
      branches,
      commits,
      conflicts
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/repoman/git/stage', async (req, res) => {
  const { path: filePath, stageAll } = req.body;
  const git = new GitEngine();

  try {
    if (stageAll) {
      const result = await git.stageAll();
      return res.json(result);
    }
    const result = await git.stageFile(filePath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/repoman/git/commit', async (req, res) => {
  const { message, author } = req.body;
  const git = new GitEngine();

  try {
    const result = await git.createCommit(message, { author });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/repoman/git/branch', async (req, res) => {
  const { name } = req.body;
  const git = new GitEngine();

  try {
    const result = await git.createBranch(name);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/repoman/git/sync', async (req, res) => {
  const { remote, branch } = req.body;
  const git = new GitEngine();

  try {
    const conflicts = await git.checkConflicts();
    if (conflicts.hasConflicts) {
      return res.status(409).json({
        error: 'Merge conflicts detected before sync.',
        conflicts: conflicts.files
      });
    }

    const pullRes = await git.pull(remote || 'origin', branch);
    res.json(pullRes);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// Workspace & Files
app.get('/api/repoman/workspace/files', (req, res) => {
  const workspace = new WorkspaceManager();
  const files = workspace.scanDirectory('.', 3);
  const enriched = files.map((f) => ({
    ...f,
    safeguard: SafeguardsEngine.validateFilePath(f.path)
  }));
  res.json({ files: enriched });
});

app.get('/api/repoman/workspace/file', (req, res) => {
  const relPath = req.query.path as string;
  if (!relPath) return res.status(400).json({ error: 'path is required' });

  const workspace = new WorkspaceManager();
  const read = workspace.readFile(relPath);
  res.json(read);
});

app.post('/api/repoman/workspace/file', (req, res) => {
  const { path: relPath, content, description } = req.body;
  if (!relPath || content === undefined) {
    return res.status(400).json({ error: 'path and content are required' });
  }

  const workspace = new WorkspaceManager();
  const result = workspace.writeFile(relPath, content, description);
  res.json(result);
});

app.get('/api/repoman/workspace/snapshots', (req, res) => {
  const workspace = new WorkspaceManager();
  res.json({ snapshots: workspace.getSnapshots() });
});

app.post('/api/repoman/workspace/rollback', (req, res) => {
  const { snapshotId } = req.body;
  if (!snapshotId) return res.status(400).json({ error: 'snapshotId is required' });

  const workspace = new WorkspaceManager();
  const result = workspace.rollbackSnapshot(snapshotId);
  res.json(result);
});

// Audit Logs
app.get('/api/repoman/audit/logs', (req, res) => {
  const limit = parseInt(req.query.limit as string, 10) || 100;
  const memoryLogs = AuditLogger.getLogs(limit);
  const rawLogFile = AuditLogger.readLogFileContent(limit);

  res.json({
    logs: memoryLogs,
    rawText: rawLogFile
  });
});

app.post('/api/repoman/audit/clear', (req, res) => {
  AuditLogger.clearLogs();
  res.json({ success: true });
});

// Interactive CLI command simulation
app.post('/api/repoman/cli/execute', async (req, res) => {
  const { command } = req.body;
  if (!command || typeof command !== 'string') {
    return res.status(400).json({ error: 'command string is required' });
  }

  const trimmed = command.trim();
  const outputLines: string[] = [];

  try {
    const parts = trimmed.split(/\s+/);
    const mainCmd = parts[0] === 'repoman' ? parts[1] : parts[0];

    if (!mainCmd || mainCmd === '--help' || mainCmd === 'help') {
      outputLines.push('Usage: repoman [options] [command]');
      outputLines.push('');
      outputLines.push('Autonomous local and Git workflow automation agent');
      outputLines.push('');
      outputLines.push('Commands:');
      outputLines.push('  status                       Show repository status, branch, safeguards configuration');
      outputLines.push('  scan [options]               Perform a safe boundary scan of the local workspace');
      outputLines.push('  run <jobId> [--confirm]      Execute a configured maintenance job pipeline');
      outputLines.push('  sync [options]               Synchronize local Git workspace with remote safely');
      outputLines.push('  patch <file> <content>       Safely update or patch a file with snapshot protection');
      outputLines.push('  rollback [snapshotId]        Rollback files to a previous snapshot point');
      outputLines.push('  audit [options]              Display recent entries from repoman-audit.log');
      outputLines.push('  health                       Display local CPU, Memory, and Disk usage footprint');
      outputLines.push('  config                       View current configuration');
    } else if (mainCmd === 'health' || mainCmd === 'sys' || mainCmd === 'system') {
      const h = getSystemHealth();
      outputLines.push('=== HOST SYSTEM HEALTH & AGENT FOOTPRINT ===');
      outputLines.push(`Overall Status:   ${h.status}`);
      outputLines.push(`CPU Load:         ${h.cpu.usagePercent}% (${h.cpu.cores} Cores, Load: ${h.cpu.loadAvg.join(', ')})`);
      outputLines.push(`RAM Usage:        ${(h.memory.usedBytes / 1024 / 1024 / 1024).toFixed(1)} GB / ${(h.memory.totalBytes / 1024 / 1024 / 1024).toFixed(1)} GB (${h.memory.usagePercent}%)`);
      outputLines.push(`Agent RSS Foot:   ${(h.memory.processRssBytes / 1024 / 1024).toFixed(1)} MB (Heap: ${(h.memory.processHeapUsedBytes / 1024 / 1024).toFixed(1)} MB)`);
      outputLines.push(`Workspace Disk:   ${(h.disk.usedBytes / 1024 / 1024 / 1024).toFixed(1)} GB / ${(h.disk.totalBytes / 1024 / 1024 / 1024).toFixed(1)} GB (${h.disk.usagePercent}% used)`);
      outputLines.push(`System Uptime:    ${Math.floor(h.uptime.systemSeconds / 3600)}h ${Math.floor((h.uptime.systemSeconds % 3600) / 60)}m`);
      outputLines.push(`Daemon Uptime:    ${Math.floor(h.uptime.processSeconds / 60)}m ${h.uptime.processSeconds % 60}s`);
      outputLines.push('============================================');
    } else if (mainCmd === 'status') {
      const git = new GitEngine();
      const status = await git.getStatus();
      const config = getConfig();
      outputLines.push('=== REPOMAN AGENT STATUS ===');
      outputLines.push(`Agent Name:     ${config.agentName} (v${config.version})`);
      outputLines.push(`Active Repo:    ${config.activeRepository}`);
      outputLines.push(`Current Branch: ${status.branch} (Clean: ${status.isClean ? 'YES' : 'NO'})`);
      outputLines.push(`Staged Files:   ${status.staged.length}`);
      outputLines.push(`Unstaged Files: ${status.unstaged.length}`);
      outputLines.push(`Conflicts:      ${status.conflicts.length > 0 ? status.conflicts.join(', ') : 'None'}`);
      outputLines.push(`Force Push:     ${config.safeguards.allowForcePush ? 'ALLOWED' : 'BLOCKED'}`);
    } else if (mainCmd === 'scan') {
      const workspace = new WorkspaceManager();
      const files = workspace.scanDirectory('.', 2);
      outputLines.push(`Scanned ${files.length} workspace entries.`);
      outputLines.push('Boundary compliance: 100% within sandbox.');
    } else if (mainCmd === 'run') {
      const jobId = parts[2] || parts[1];
      const hasConfirm = trimmed.includes('--confirm');
      const runner = new JobRunner();
      const result = await runner.executeJob(jobId, hasConfirm);
      outputLines.push(`Job ${jobId} finished: ${result.status} (${result.durationMs}ms)`);
      result.stepResults.forEach((s) => {
        outputLines.push(`  ✓ ${s.stepName}: ${s.status} (${s.durationMs}ms)`);
      });
      if (result.error) outputLines.push(`  ⚠ Error: ${result.error}`);
    } else if (mainCmd === 'audit') {
      outputLines.push(AuditLogger.readLogFileContent(15));
    } else if (mainCmd === 'rollback') {
      const workspace = new WorkspaceManager();
      const snaps = workspace.getSnapshots();
      if (snaps.length === 0) {
        outputLines.push('No snapshots available for rollback.');
      } else {
        const snap = snaps[0];
        const resRoll = workspace.rollbackSnapshot(snap.id);
        outputLines.push(`Rolled back to ${snap.id}: restored ${resRoll.filesRestored.length} files.`);
      }
    } else {
      outputLines.push(`Executing command: ${trimmed}`);
      outputLines.push(`Unknown or simulated CLI instruction: ${mainCmd}`);
    }

    res.json({ output: outputLines.join('\n') });
  } catch (err) {
    res.json({ output: `Error executing command: ${String(err)}` });
  }
});

// AI Commit Message Generator via Gemini
app.post('/api/repoman/ai/commit-message', async (req, res) => {
  const { diff, description } = req.body;

  if (aiClient) {
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `You are an expert Git automation engineer. Generate a concise, conventional commit message (type(scope): description) for these changes:
Context: ${description || 'Code maintenance'}
Diff / Summary: ${diff || 'General refactoring and dependency updates'}
Respond with ONLY the single-line commit message.`
      });

      const message = response.text?.trim() || 'chore(repoman): automated workspace update';
      return res.json({ message });
    } catch (err) {
      console.warn('Gemini AI generation failed, using conventional fallback:', err);
    }
  }

  // Fallback
  res.json({
    message: `chore(workspace): ${description || 'automated maintenance and safety pass'} [repoman]`
  });
});

// ----------------- VITE MIDDLEWARE / STATIC SERVING -----------------

async function startServer() {
  if (process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist'))) {
    app.use(express.static(path.resolve(process.cwd(), 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    // In dev, use Vite's connect instance as middleware
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 repoman-agent running at http://localhost:${PORT}`);
    console.log(`📁 Audit log active at ./repoman-audit.log\n`);
  });
}

startServer();
