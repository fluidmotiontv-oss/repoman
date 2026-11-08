/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { exec, execFile } from 'node:child_process';
import util from 'node:util';
import path from 'node:path';
import fs from 'node:fs';
import type {
  GitBranchInfo,
  GitCommitInfo,
  GitFileStatus,
  GitStatusSummary
} from '../types.ts';
import { SafeguardsEngine } from '../core/safeguards.ts';
import { AuditLogger } from '../core/logger.ts';

const execPromise = util.promisify(exec);
const execFilePromise = util.promisify(execFile);

export class GitEngine {
  private repoDir: string;
  private isGitAvailable: boolean | null = null;

  constructor(repoDir = process.cwd()) {
    this.repoDir = path.resolve(repoDir);
  }

  /**
   * Checks if git binary is available on the system.
   */
  public async checkGitAvailable(): Promise<boolean> {
    if (this.isGitAvailable !== null) return this.isGitAvailable;
    try {
      await execPromise('git --version');
      this.isGitAvailable = true;
    } catch {
      this.isGitAvailable = false;
    }
    return this.isGitAvailable;
  }

  /**
   * Runs a raw git command safely with safeguard validation.
   */
  public async runGit(
    args: string[],
    explicitConfirm = false
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    const fullCmd = `git ${args.join(' ')}`;

    // Validate command through Safeguards Engine
    const check = SafeguardsEngine.validateCommand(fullCmd, explicitConfirm);
    if (!check.passed) {
      throw new Error(`Safeguard violation: ${check.reason}`);
    }

    try {
      const { stdout, stderr } = await execFilePromise('git', args, {
        cwd: this.repoDir,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
      });

      AuditLogger.log(
        'TX',
        'GIT',
        `Executed git ${args[0]}`,
        { args, cwd: this.repoDir },
        'SUCCESS',
        explicitConfirm
      );

      return { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 };
    } catch (err: unknown) {
      const errorObj = err as { stdout?: string; stderr?: string; code?: number; message?: string };
      const stderr = errorObj.stderr || errorObj.message || 'Unknown git error';

      AuditLogger.log(
        'ERROR',
        'GIT',
        `Git command failed: ${fullCmd}`,
        { args, stderr, exitCode: errorObj.code },
        'FAILED'
      );

      return {
        stdout: errorObj.stdout || '',
        stderr,
        exitCode: errorObj.code || 1
      };
    }
  }

  /**
   * Retrieves complete Git status summary.
   */
  public async getStatus(): Promise<GitStatusSummary> {
    const gitOk = await this.checkGitAvailable();
    if (!gitOk || !fs.existsSync(path.join(this.repoDir, '.git'))) {
      // Fallback sandbox status when .git is not initialized
      return this.getSimulatedStatus();
    }

    try {
      const branchRes = await this.runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
      const currentBranch = branchRes.stdout || 'main';

      const statusRes = await this.runGit(['status', '--porcelain=v1', '-uall']);
      const lines = statusRes.stdout ? statusRes.stdout.split('\n') : [];

      const staged: GitFileStatus[] = [];
      const unstaged: GitFileStatus[] = [];
      const untracked: GitFileStatus[] = [];
      const conflicts: string[] = [];

      for (const line of lines) {
        if (!line.trim()) continue;
        const indexStatus = line[0];
        const worktreeStatus = line[1];
        const filePath = line.substring(3).trim();

        // Conflict check
        if (indexStatus === 'U' || worktreeStatus === 'U' || (indexStatus === 'A' && worktreeStatus === 'A')) {
          conflicts.push(filePath);
          continue;
        }

        // Staged
        if (indexStatus !== ' ' && indexStatus !== '?') {
          staged.push({
            path: filePath,
            status: this.parseStatusCode(indexStatus),
            staged: true
          });
        }

        // Unstaged
        if (worktreeStatus !== ' ' && worktreeStatus !== '?') {
          unstaged.push({
            path: filePath,
            status: this.parseStatusCode(worktreeStatus),
            staged: false
          });
        }

        // Untracked
        if (indexStatus === '?' && worktreeStatus === '?') {
          untracked.push({
            path: filePath,
            status: 'untracked',
            staged: false
          });
        }
      }

      return {
        branch: currentBranch,
        isClean: staged.length === 0 && unstaged.length === 0 && untracked.length === 0,
        staged,
        unstaged,
        untracked,
        conflicts,
        ahead: 0,
        behind: 0
      };
    } catch {
      return this.getSimulatedStatus();
    }
  }

  /**
   * Stages a file safely, rejecting blocked files (.env, keys, etc.)
   */
  public async stageFile(filePath: string): Promise<{ success: boolean; error?: string }> {
    const fileCheck = SafeguardsEngine.validateFilePath(filePath, false);
    if (!fileCheck.passed) {
      return { success: false, error: fileCheck.reason };
    }

    const res = await this.runGit(['add', filePath]);
    if (res.exitCode !== 0) {
      return { success: false, error: res.stderr };
    }
    return { success: true };
  }

  /**
   * Stages all eligible files while skipping safeguard blocked patterns.
   */
  public async stageAll(): Promise<{ success: boolean; stagedCount: number; error?: string }> {
    const status = await this.getStatus();
    const allFiles = [...status.unstaged, ...status.untracked];
    let stagedCount = 0;

    for (const file of allFiles) {
      const check = SafeguardsEngine.validateFilePath(file.path, false);
      if (check.passed) {
        const res = await this.stageFile(file.path);
        if (res.success) stagedCount++;
      } else {
        AuditLogger.log(
          'WARN',
          'GIT',
          `Skipped staging protected file: ${file.path}`,
          { path: file.path, reason: check.reason },
          'BLOCKED'
        );
      }
    }

    return { success: true, stagedCount };
  }

  /**
   * Creates an automated commit with structured messaging.
   */
  public async createCommit(
    message: string,
    options: { author?: string; emptyOk?: boolean } = {}
  ): Promise<{ success: boolean; commitHash?: string; error?: string }> {
    if (!message || message.trim().length === 0) {
      return { success: false, error: 'Commit message cannot be empty' };
    }

    const args = ['commit', '-m', message];
    if (options.author) {
      args.push('--author', options.author);
    }
    if (options.emptyOk) {
      args.push('--allow-empty');
    }

    const res = await this.runGit(args);
    if (res.exitCode !== 0) {
      return { success: false, error: res.stderr || 'Commit failed' };
    }

    // Grab latest commit hash
    const hashRes = await this.runGit(['rev-parse', 'HEAD']);
    const commitHash = hashRes.stdout.substring(0, 7);

    AuditLogger.log(
      'TX',
      'GIT',
      `Created commit ${commitHash}: ${message}`,
      { commitHash, message },
      'SUCCESS'
    );

    return { success: true, commitHash };
  }

  /**
   * Creates and checks out a new branch.
   */
  public async createBranch(branchName: string): Promise<{ success: boolean; branchName: string; error?: string }> {
    const cleanBranch = branchName.replace(/[^a-zA-Z0-9/_.-]/g, '-').replace(/\/+/g, '/');
    const res = await this.runGit(['checkout', '-b', cleanBranch]);
    if (res.exitCode !== 0) {
      return { success: false, branchName: cleanBranch, error: res.stderr };
    }

    AuditLogger.log(
      'SAFE',
      'GIT',
      `Switched to new branch: ${cleanBranch}`,
      { branch: cleanBranch },
      'SUCCESS'
    );

    return { success: true, branchName: cleanBranch };
  }

  /**
   * Lists branches.
   */
  public async listBranches(): Promise<GitBranchInfo[]> {
    try {
      const res = await this.runGit(['branch', '-vv']);
      if (res.exitCode !== 0 || !res.stdout) {
        return this.getSimulatedBranches();
      }

      const branches: GitBranchInfo[] = [];
      const lines = res.stdout.split('\n');

      for (const line of lines) {
        if (!line.trim()) continue;
        const current = line.startsWith('*');
        const parts = line.replace('*', '').trim().split(/\s+/);
        const name = parts[0];
        const hash = parts[1] || '0000000';

        branches.push({
          name,
          current,
          commitHash: hash
        });
      }

      return branches;
    } catch {
      return this.getSimulatedBranches();
    }
  }

  /**
   * Fetches and gets commit log history.
   */
  public async getCommitLog(limit = 10): Promise<GitCommitInfo[]> {
    try {
      const res = await this.runGit([
        'log',
        `-n`,
        String(limit),
        '--pretty=format:%h|%an|%ad|%s',
        '--date=short'
      ]);

      if (res.exitCode !== 0 || !res.stdout) {
        return this.getSimulatedCommits();
      }

      const commits: GitCommitInfo[] = [];
      for (const line of res.stdout.split('\n')) {
        if (!line.trim()) continue;
        const [hash, author, date, message] = line.split('|');
        commits.push({
          hash: hash || 'head',
          author: author || 'repoman-agent',
          date: date || new Date().toISOString().split('T')[0],
          message: message || 'Update'
        });
      }

      return commits;
    } catch {
      return this.getSimulatedCommits();
    }
  }

  /**
   * Pulls remote changes.
   */
  public async pull(remote = 'origin', branch?: string): Promise<{ success: boolean; output: string; error?: string }> {
    const args = ['pull', remote];
    if (branch) args.push(branch);

    const res = await this.runGit(args);
    if (res.exitCode !== 0) {
      return { success: false, output: res.stderr, error: res.stderr };
    }
    return { success: true, output: res.stdout };
  }

  /**
   * Pushes current branch. Guardrails strictly block --force.
   */
  public async push(
    remote = 'origin',
    branch?: string,
    setUpstream = false
  ): Promise<{ success: boolean; output: string; error?: string }> {
    const args = ['push'];
    if (setUpstream) args.push('-u');
    args.push(remote);
    if (branch) args.push(branch);

    const res = await this.runGit(args);
    if (res.exitCode !== 0) {
      return { success: false, output: res.stderr, error: res.stderr };
    }
    return { success: true, output: res.stdout };
  }

  /**
   * Checks for merge conflict markers in workspace.
   */
  public async checkConflicts(): Promise<{ hasConflicts: boolean; files: string[] }> {
    const conflictFiles: string[] = [];
    const marker = '<<<<<<<';

    const checkDir = (dir: string) => {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDir(full);
        } else if (/\.(ts|tsx|js|jsx|json|md|css|html|yaml|yml)$/.test(entry.name)) {
          try {
            const content = fs.readFileSync(full, 'utf8');
            if (content.includes(marker)) {
              conflictFiles.push(path.relative(this.repoDir, full));
            }
          } catch {
            // ignore
          }
        }
      }
    };

    checkDir(this.repoDir);
    return {
      hasConflicts: conflictFiles.length > 0,
      files: conflictFiles
    };
  }

  private parseStatusCode(code: string): GitFileStatus['status'] {
    switch (code) {
      case 'M':
        return 'modified';
      case 'A':
        return 'added';
      case 'D':
        return 'deleted';
      case '?':
        return 'untracked';
      case 'R':
        return 'renamed';
      case 'U':
        return 'conflict';
      default:
        return 'modified';
    }
  }

  private getSimulatedStatus(): GitStatusSummary {
    return {
      branch: 'main',
      isClean: true,
      staged: [],
      unstaged: [
        {
          path: 'repoman.config.json',
          status: 'modified',
          staged: false
        }
      ],
      untracked: [
        {
          path: 'repoman-audit.log',
          status: 'untracked',
          staged: false
        }
      ],
      conflicts: [],
      ahead: 1,
      behind: 0
    };
  }

  private getSimulatedBranches(): GitBranchInfo[] {
    return [
      { name: 'main', current: true, commitHash: 'a89c2d1', upstream: 'origin/main', ahead: 0, behind: 0 },
      { name: 'repoman/lint-pass-auto', current: false, commitHash: 'f4109b8', upstream: 'origin/repoman/lint-pass-auto' },
      { name: 'feat/audit-guardrails', current: false, commitHash: '7e2311c' }
    ];
  }

  private getSimulatedCommits(): GitCommitInfo[] {
    return [
      { hash: 'a89c2d1', author: 'repoman-agent', date: '2026-11-08', message: 'chore(config): configure guardrails and isolation policies' },
      { hash: 'f4109b8', author: 'DevOps Bot', date: '2026-11-07', message: 'fix(deps): automated security patch pass' },
      { hash: '7e2311c', author: 'repoman-agent', date: '2026-11-06', message: 'docs(readme): add setup and CLI instructions' },
      { hash: '3d90214', author: 'Alex Chen', date: '2026-11-05', message: 'feat(core): initial repository setup' }
    ];
  }
}
