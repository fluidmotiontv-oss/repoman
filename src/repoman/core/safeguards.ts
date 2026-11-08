/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import path from 'node:path';
import { getConfig } from './config.ts';
import { AuditLogger } from './logger.ts';

export interface SafeguardCheckResult {
  passed: boolean;
  reason?: string;
  category: 'FILE_PROTECTION' | 'COMMAND_SAFETY' | 'PATH_ISOLATION' | 'CHANGE_LIMIT';
  requiresConfirmation?: boolean;
}

export class SafeguardsEngine {
  /**
   * Verifies if a file path is safe to read or write.
   * Blocks access to sensitive files like .env, SSH keys, credentials, or outside the allowed workspace.
   */
  public static validateFilePath(targetPath: string, isWrite = false): SafeguardCheckResult {
    const config = getConfig();
    const safeguards = config.safeguards;
    const normalized = path.normalize(targetPath).replace(/\\/g, '/');

    // 1. Check path isolation (sandbox boundary)
    const isInsideAllowed = safeguards.allowedRepositoryPaths.some((allowed) => {
      const cleanAllowed = allowed.replace(/\*$/, '').replace(/\/$/, '');
      if (cleanAllowed === '.' || cleanAllowed === '') return true;
      return normalized.startsWith(cleanAllowed) || normalized.includes(cleanAllowed);
    });

    if (!isInsideAllowed) {
      AuditLogger.log(
        'BLOCK',
        'SAFEGUARD',
        `Blocked path access outside sandbox: ${normalized}`,
        { path: normalized, allowed: safeguards.allowedRepositoryPaths },
        'BLOCKED'
      );
      return {
        passed: false,
        reason: `Target path '${normalized}' is outside designated repository boundaries.`,
        category: 'PATH_ISOLATION'
      };
    }

    // 2. Check sensitive blocked file patterns
    const filename = path.basename(normalized);
    for (const pattern of safeguards.blockedFilePatterns) {
      if (this.matchesPattern(normalized, pattern) || this.matchesPattern(filename, pattern)) {
        AuditLogger.log(
          'BLOCK',
          'SAFEGUARD',
          `Blocked file operation on sensitive pattern: ${pattern}`,
          { file: normalized, pattern, isWrite },
          'BLOCKED'
        );
        return {
          passed: false,
          reason: `Access to '${normalized}' is blocked by safeguard pattern '${pattern}'.`,
          category: 'FILE_PROTECTION'
        };
      }
    }

    return { passed: true, category: 'FILE_PROTECTION' };
  }

  /**
   * Verifies if a shell command or git command is safe to execute.
   * Blocks force pushes, dangerous system deletion commands, etc.
   */
  public static validateCommand(
    command: string,
    explicitConfirmation = false
  ): SafeguardCheckResult {
    const config = getConfig();
    const safeguards = config.safeguards;
    const lower = command.toLowerCase().trim();

    // Check force push
    const isForcePush =
      lower.includes('push') && (lower.includes('--force') || lower.includes('-f') || lower.includes('+refs/heads/'));
    if (isForcePush && !safeguards.allowForcePush) {
      AuditLogger.log(
        'BLOCK',
        'SAFEGUARD',
        `Blocked force push command: ${command}`,
        { command, allowForcePush: safeguards.allowForcePush },
        'BLOCKED'
      );
      return {
        passed: false,
        reason: 'Force push is strictly disabled by repoman safeguard policy.',
        category: 'COMMAND_SAFETY'
      };
    }

    // Check blocked dangerous commands
    for (const blocked of safeguards.blockedCommands) {
      if (lower.includes(blocked.toLowerCase())) {
        if (safeguards.requireConfirmationForDestructive && !explicitConfirmation) {
          AuditLogger.log(
            'BLOCK',
            'SAFEGUARD',
            `Blocked destructive command pending confirmation: ${command}`,
            { command, blockedPattern: blocked },
            'BLOCKED'
          );
          return {
            passed: false,
            reason: `Command contains destructive pattern '${blocked}'. Explicit confirmation (--confirm) is required.`,
            category: 'COMMAND_SAFETY',
            requiresConfirmation: true
          };
        }
      }
    }

    return { passed: true, category: 'COMMAND_SAFETY' };
  }

  /**
   * Checks change magnitude limits to prevent massive accidental overwrites.
   */
  public static validateChangeLimits(
    fileCount: number,
    linesChanged: number
  ): SafeguardCheckResult {
    const config = getConfig();
    const safeguards = config.safeguards;

    if (fileCount > safeguards.maxFilesPerCommit) {
      AuditLogger.log(
        'WARN',
        'SAFEGUARD',
        `Change count exceeds maximum files limit: ${fileCount} > ${safeguards.maxFilesPerCommit}`,
        { fileCount, max: safeguards.maxFilesPerCommit },
        'BLOCKED'
      );
      return {
        passed: false,
        reason: `Change impacts ${fileCount} files, exceeding limit of ${safeguards.maxFilesPerCommit}.`,
        category: 'CHANGE_LIMIT'
      };
    }

    if (linesChanged > safeguards.maxLinesChangedPerJob) {
      AuditLogger.log(
        'WARN',
        'SAFEGUARD',
        `Change magnitude exceeds maximum lines limit: ${linesChanged} > ${safeguards.maxLinesChangedPerJob}`,
        { linesChanged, max: safeguards.maxLinesChangedPerJob },
        'BLOCKED'
      );
      return {
        passed: false,
        reason: `Change alters ${linesChanged} lines, exceeding safety threshold of ${safeguards.maxLinesChangedPerJob}.`,
        category: 'CHANGE_LIMIT'
      };
    }

    return { passed: true, category: 'CHANGE_LIMIT' };
  }

  private static matchesPattern(value: string, pattern: string): boolean {
    if (pattern.startsWith('*') && pattern.endsWith('*')) {
      const mid = pattern.slice(1, -1);
      return value.includes(mid);
    }
    if (pattern.startsWith('*')) {
      return value.endsWith(pattern.slice(1));
    }
    if (pattern.endsWith('*')) {
      return value.startsWith(pattern.slice(0, -1));
    }
    return value === pattern || value.includes(pattern);
  }
}
