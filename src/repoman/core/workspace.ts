/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import type { WorkspaceSnapshot } from '../types.ts';
import { SafeguardsEngine } from './safeguards.ts';
import { AuditLogger } from './logger.ts';

const snapshotStack: WorkspaceSnapshot[] = [];
const MAX_SNAPSHOTS = 50;

export class WorkspaceManager {
  private baseDir: string;

  constructor(baseDir = process.cwd()) {
    this.baseDir = path.resolve(baseDir);
  }

  /**
   * Creates a snapshot of specified files before modifying them, enabling instant rollback.
   */
  public createSnapshot(
    filePaths: string[],
    description: string,
    jobId?: string
  ): WorkspaceSnapshot {
    const snapshot: WorkspaceSnapshot = {
      id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      jobId,
      description,
      repoPath: this.baseDir,
      files: []
    };

    for (const relPath of filePaths) {
      const fullPath = path.resolve(this.baseDir, relPath);
      const existed = fs.existsSync(fullPath);
      let content = '';
      if (existed) {
        try {
          content = fs.readFileSync(fullPath, 'utf8');
        } catch (err) {
          console.warn(`Could not read ${relPath} for snapshot:`, err);
        }
      }
      snapshot.files.push({
        relativePath: relPath,
        content,
        existed
      });
    }

    snapshotStack.unshift(snapshot);
    if (snapshotStack.length > MAX_SNAPSHOTS) {
      snapshotStack.pop();
    }

    AuditLogger.log(
      'SAFE',
      'FILE',
      `Created workspace snapshot: ${snapshot.id}`,
      { snapshotId: snapshot.id, description, fileCount: filePaths.length },
      'SUCCESS'
    );

    return snapshot;
  }

  /**
   * Reverts files to the given snapshot.
   */
  public rollbackSnapshot(snapshotId: string): { success: boolean; filesRestored: string[]; error?: string } {
    const snapshot = snapshotStack.find((s) => s.id === snapshotId);
    if (!snapshot) {
      AuditLogger.log(
        'ERROR',
        'FILE',
        `Rollback failed: snapshot ${snapshotId} not found`,
        { snapshotId },
        'FAILED'
      );
      return { success: false, filesRestored: [], error: `Snapshot ${snapshotId} not found` };
    }

    const restored: string[] = [];
    try {
      for (const item of snapshot.files) {
        const fullPath = path.resolve(snapshot.repoPath, item.relativePath);
        if (item.existed) {
          const dir = path.dirname(fullPath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(fullPath, item.content, 'utf8');
          restored.push(item.relativePath);
        } else {
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            restored.push(`(deleted new file) ${item.relativePath}`);
          }
        }
      }

      AuditLogger.log(
        'TX',
        'FILE',
        `Rolled back workspace to snapshot: ${snapshotId}`,
        { snapshotId, description: snapshot.description, restoredCount: restored.length },
        'ROLLED_BACK'
      );

      return { success: true, filesRestored: restored };
    } catch (err) {
      const errorMsg = String(err);
      AuditLogger.log(
        'ERROR',
        'FILE',
        `Rollback error for snapshot ${snapshotId}: ${errorMsg}`,
        { snapshotId, error: errorMsg },
        'FAILED'
      );
      return { success: false, filesRestored: restored, error: errorMsg };
    }
  }

  /**
   * Returns list of saved snapshots.
   */
  public getSnapshots(): WorkspaceSnapshot[] {
    return [...snapshotStack];
  }

  /**
   * Safely reads a file with safeguard verification.
   */
  public readFile(relativePath: string): { success: boolean; content?: string; error?: string } {
    const check = SafeguardsEngine.validateFilePath(relativePath, false);
    if (!check.passed) {
      return { success: false, error: check.reason };
    }

    const fullPath = path.resolve(this.baseDir, relativePath);
    if (!fs.existsSync(fullPath)) {
      return { success: false, error: `File not found: ${relativePath}` };
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf8');
      return { success: true, content };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  /**
   * Safely writes a file, taking a snapshot first.
   */
  public writeFile(
    relativePath: string,
    content: string,
    description = 'File update'
  ): { success: boolean; snapshot?: WorkspaceSnapshot; error?: string } {
    const check = SafeguardsEngine.validateFilePath(relativePath, true);
    if (!check.passed) {
      return { success: false, error: check.reason };
    }

    const snapshot = this.createSnapshot([relativePath], description);

    try {
      const fullPath = path.resolve(this.baseDir, relativePath);
      const dir = path.dirname(fullPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(fullPath, content, 'utf8');

      AuditLogger.log(
        'TX',
        'FILE',
        `Modified file: ${relativePath}`,
        { relativePath, bytes: content.length, snapshotId: snapshot.id },
        'SUCCESS'
      );

      return { success: true, snapshot };
    } catch (err) {
      // Auto-rollback on error
      this.rollbackSnapshot(snapshot.id);
      return { success: false, error: `Write failed and rolled back: ${String(err)}` };
    }
  }

  /**
   * Updates a JSON file safely (e.g. package.json, tsconfig.json)
   */
  public updateJsonFile<T = Record<string, unknown>>(
    relativePath: string,
    modifier: (current: T) => T,
    description = 'JSON update'
  ): { success: boolean; snapshot?: WorkspaceSnapshot; updated?: T; error?: string } {
    const read = this.readFile(relativePath);
    if (!read.success || read.content === undefined) {
      return { success: false, error: read.error };
    }

    try {
      const parsed = JSON.parse(read.content) as T;
      const modified = modifier(parsed);
      const formatted = JSON.stringify(modified, null, 2) + '\n';
      const writeRes = this.writeFile(relativePath, formatted, description);
      if (!writeRes.success) {
        return { success: false, error: writeRes.error };
      }
      return { success: true, snapshot: writeRes.snapshot, updated: modified };
    } catch (err) {
      return { success: false, error: `JSON update failed: ${String(err)}` };
    }
  }

  /**
   * Scans a directory safely, filtering out ignored and sensitive files.
   */
  public scanDirectory(relDir = '.', maxDepth = 4): { path: string; isDir: boolean; size: number }[] {
    const results: { path: string; isDir: boolean; size: number }[] = [];
    const root = path.resolve(this.baseDir, relDir);

    const traverse = (currentDir: string, depth: number) => {
      if (depth > maxDepth) return;
      if (!fs.existsSync(currentDir)) return;

      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
          continue;
        }

        const full = path.join(currentDir, entry.name);
        const rel = path.relative(this.baseDir, full);
        const isDir = entry.isDirectory();

        let size = 0;
        try {
          size = isDir ? 0 : fs.statSync(full).size;
        } catch {
          // ignore stat errors
        }

        results.push({ path: rel, isDir, size });

        if (isDir) {
          traverse(full, depth + 1);
        }
      }
    };

    traverse(root, 0);
    return results;
  }
}
