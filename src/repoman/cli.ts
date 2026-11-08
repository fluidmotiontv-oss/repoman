#!/usr/bin/env node
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import os from 'node:os';
import fs from 'node:fs';
import { Command } from 'commander';
import { getConfig, loadConfig, saveConfig } from './core/config.ts';
import { SafeguardsEngine } from './core/safeguards.ts';
import { AuditLogger } from './core/logger.ts';
import { WorkspaceManager } from './core/workspace.ts';
import { GitEngine } from './git/engine.ts';
import { JobRunner } from './jobs/runner.ts';

const program = new Command();

program
  .name('repoman')
  .description('Autonomous local and Git workflow automation agent')
  .version('1.0.0');

// Command: health
program
  .command('health')
  .description('Display host CPU, Memory, and Disk usage to monitor agent impact')
  .action(() => {
    const cpus = os.cpus() || [];
    const loadAvg = os.loadavg();
    const numCores = Math.max(1, cpus.length);
    let cpuPercent = Math.min(100, Math.round((loadAvg[0] / numCores) * 100));
    if (isNaN(cpuPercent) || cpuPercent < 0) cpuPercent = 5;

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memPercent = Math.round((usedMem / totalMem) * 100);
    const procMem = process.memoryUsage();

    let totalDisk = 64 * 1024 * 1024 * 1024;
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
    const usedDisk = totalDisk - freeDisk;
    const diskPercent = Math.round((usedDisk / totalDisk) * 100);

    console.log('\n=== HOST SYSTEM HEALTH & AGENT FOOTPRINT ===');
    console.log(`CPU Load:        ${cpuPercent}% (${numCores} Cores, Load Avg: ${loadAvg.map(l => l.toFixed(2)).join(', ')})`);
    console.log(`Host RAM:        ${(usedMem / 1024 / 1024 / 1024).toFixed(1)} GB / ${(totalMem / 1024 / 1024 / 1024).toFixed(1)} GB (${memPercent}% used)`);
    console.log(`Agent Process:   RSS: ${(procMem.rss / 1024 / 1024).toFixed(1)} MB | Heap Used: ${(procMem.heapUsed / 1024 / 1024).toFixed(1)} MB`);
    console.log(`Workspace Disk:  ${(usedDisk / 1024 / 1024 / 1024).toFixed(1)} GB / ${(totalDisk / 1024 / 1024 / 1024).toFixed(1)} GB (${diskPercent}% used)`);
    console.log(`Host Uptime:     ${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`);
    console.log(`Agent Uptime:    ${Math.floor(process.uptime() / 60)}m ${Math.floor(process.uptime() % 60)}s`);
    console.log('============================================\n');
  });

// Command: status
program
  .command('status')
  .description('Show repository status, branch, safeguards configuration, and recent audit activity')
  .action(async () => {
    const config = getConfig();
    const git = new GitEngine();
    const status = await git.getStatus();
    const logs = AuditLogger.getLogs(5);

    console.log('\n=== REPOMAN AGENT STATUS ===');
    console.log(`Agent Name:     ${config.agentName} (v${config.version})`);
    console.log(`Active Repo:    ${config.activeRepository}`);
    console.log(`Current Branch: ${status.branch} (Clean: ${status.isClean ? 'YES' : 'NO'})`);
    console.log(`Staged Files:   ${status.staged.length}`);
    console.log(`Unstaged Files: ${status.unstaged.length}`);
    console.log(`Conflicts:      ${status.conflicts.length > 0 ? status.conflicts.join(', ') : 'None'}`);
    console.log('\n--- Safeguards Policy ---');
    console.log(`Allow Force Push:  ${config.safeguards.allowForcePush ? 'YES (Warning!)' : 'NO (Protected)'}`);
    console.log(`Blocked Patterns:  ${config.safeguards.blockedFilePatterns.join(', ')}`);
    console.log(`Max Files/Commit:  ${config.safeguards.maxFilesPerCommit}`);
    console.log('\n--- Recent Audit Events ---');
    if (logs.length === 0) {
      console.log('No recent audit log entries in session.');
    } else {
      logs.forEach((l) => {
        console.log(`[${l.timestamp.slice(11, 19)}] [${l.level}] [${l.status}] ${l.action}`);
      });
    }
    console.log('============================\n');
  });

// Command: scan
program
  .command('scan')
  .description('Perform a safe boundary scan of the local workspace and project files')
  .option('-d, --dir <directory>', 'Subdirectory to scan', '.')
  .option('--depth <maxDepth>', 'Maximum directory depth', '3')
  .action(async (options) => {
    const workspace = new WorkspaceManager();
    const depth = parseInt(options.depth, 10) || 3;
    console.log(`\nScanning workspace directory: ${options.dir} (depth: ${depth})...`);

    const files = workspace.scanDirectory(options.dir, depth);
    const textFiles = files.filter((f) => !f.isDir);
    const dirs = files.filter((f) => f.isDir);

    let blockedCount = 0;
    for (const f of textFiles) {
      const check = SafeguardsEngine.validateFilePath(f.path);
      if (!check.passed) blockedCount++;
    }

    console.log(`Scanned ${files.length} items (${dirs.length} directories, ${textFiles.length} files).`);
    console.log(`Protected / Blocked items detected: ${blockedCount}`);

    AuditLogger.log(
      'INFO',
      'CLI',
      `Completed workspace scan of ${options.dir}`,
      { totalFiles: textFiles.length, dirs: dirs.length, blockedCount },
      'SUCCESS'
    );
  });

// Command: run <jobId>
program
  .command('run <jobId>')
  .description('Execute a configured maintenance job pipeline')
  .option('--confirm', 'Explicit confirmation flag for destructive commands')
  .action(async (jobId, options) => {
    console.log(`\n[repoman] Queuing job '${jobId}'...`);
    const runner = new JobRunner();

    try {
      const result = await runner.executeJob(jobId, !!options.confirm);
      console.log(`\nJob Status: ${result.status} (${result.durationMs || 0}ms)`);
      if (result.branchCreated) console.log(`Created Branch: ${result.branchCreated}`);
      if (result.commitCreated) console.log(`Created Commit: ${result.commitCreated}`);
      if (result.snapshotId) console.log(`Safety Snapshot: ${result.snapshotId}`);

      console.log('\n--- Step Execution Details ---');
      result.stepResults.forEach((s, idx) => {
        console.log(`Step ${idx + 1}: ${s.stepName} [${s.status}] (${s.durationMs}ms)`);
        if (s.output) console.log(`  Output: ${s.output.split('\n')[0]}...`);
      });

      if (result.error) {
        console.error(`\n[ERROR]: ${result.error}`);
        process.exitCode = 1;
      }
    } catch (err) {
      console.error(`Failed to execute job: ${String(err)}`);
      process.exitCode = 1;
    }
  });

// Command: sync
program
  .command('sync')
  .description('Synchronize local Git workspace with remote safely')
  .option('-r, --remote <remote>', 'Remote name', 'origin')
  .option('-b, --branch <branch>', 'Branch to sync')
  .action(async (options) => {
    console.log(`\n[repoman] Syncing repository with remote ${options.remote}...`);
    const git = new GitEngine();

    // Check conflicts first
    const conflictCheck = await git.checkConflicts();
    if (conflictCheck.hasConflicts) {
      console.error(`\n[ABORT]: Merge conflict markers detected in:`);
      conflictCheck.files.forEach((f) => console.error(`  - ${f}`));
      process.exitCode = 1;
      return;
    }

    const pullRes = await git.pull(options.remote, options.branch);
    if (!pullRes.success) {
      console.error(`\n[ERROR]: Git pull failed: ${pullRes.error}`);
      process.exitCode = 1;
      return;
    }

    console.log(`Git pull output:\n${pullRes.output}`);
    const status = await git.getStatus();
    console.log(`Branch is now: ${status.branch} (Clean: ${status.isClean ? 'YES' : 'NO'})`);
  });

// Command: patch
program
  .command('patch <filePath> <content>')
  .description('Safely update or patch a file with automated snapshot & rollback protection')
  .option('-d, --desc <description>', 'Patch description', 'Automated patch')
  .action(async (filePath, content, options) => {
    console.log(`\n[repoman] Applying patch to ${filePath}...`);
    const workspace = new WorkspaceManager();
    const res = workspace.writeFile(filePath, content, options.desc);

    if (res.success) {
      console.log(`Patch applied successfully! Snapshot ID: ${res.snapshot?.id}`);
    } else {
      console.error(`Patch failed: ${res.error}`);
      process.exitCode = 1;
    }
  });

// Command: rollback
program
  .command('rollback [snapshotId]')
  .description('Rollback files to a previous snapshot point')
  .action(async (snapshotId) => {
    const workspace = new WorkspaceManager();
    const snapshots = workspace.getSnapshots();

    if (snapshots.length === 0) {
      console.log('No snapshots available for rollback.');
      return;
    }

    const targetId = snapshotId || snapshots[0].id;
    console.log(`\nRolling back to snapshot ${targetId}...`);
    const res = workspace.rollbackSnapshot(targetId);

    if (res.success) {
      console.log(`Rollback complete! Restored files:`);
      res.filesRestored.forEach((f) => console.log(`  - ${f}`));
    } else {
      console.error(`Rollback failed: ${res.error}`);
      process.exitCode = 1;
    }
  });

// Command: audit
program
  .command('audit')
  .description('Display recent entries from repoman-audit.log')
  .option('-n, --lines <count>', 'Number of lines to read', '20')
  .action((options) => {
    const count = parseInt(options.lines, 10) || 20;
    console.log(`\n=== repoman-audit.log (Last ${count} lines) ===\n`);
    console.log(AuditLogger.readLogFileContent(count));
    console.log('============================================\n');
  });

// Command: config
program
  .command('config')
  .description('View or reload repoman configuration')
  .action(() => {
    const config = loadConfig();
    console.log(JSON.stringify(config, null, 2));
  });

if (import.meta.url === `file://${process.argv[1]}`) {
  program.parse(process.argv);
}

export { program };
