/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import type { AuditLogEntry, AuditLogLevel } from '../types.ts';
import { getConfig } from './config.ts';

const memoryAuditLogs: AuditLogEntry[] = [];
const MAX_MEMORY_LOGS = 500;

export class AuditLogger {
  private static logFilePath(): string {
    const config = getConfig();
    return path.resolve(process.cwd(), config.logging.logFilePath || './repoman-audit.log');
  }

  public static log(
    level: AuditLogLevel,
    category: AuditLogEntry['category'],
    action: string,
    details: Record<string, unknown> = {},
    status: AuditLogEntry['status'] = 'SUCCESS',
    userConfirmationGranted = false
  ): AuditLogEntry {
    const config = getConfig();
    const entry: AuditLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      level,
      category,
      action,
      repo: config.activeRepository || 'default',
      details,
      status,
      userConfirmationGranted
    };

    memoryAuditLogs.unshift(entry);
    if (memoryAuditLogs.length > MAX_MEMORY_LOGS) {
      memoryAuditLogs.pop();
    }

    // Format single line structured log for repoman-audit.log
    const formattedLine = `[${entry.timestamp}] [${entry.level.padEnd(5)}] [${entry.category.padEnd(9)}] [${entry.status.padEnd(9)}] ${entry.action} - ${JSON.stringify(entry.details)}\n`;

    try {
      const filePath = this.logFilePath();
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.appendFileSync(filePath, formattedLine, 'utf8');
    } catch (err) {
      console.error('Failed to write to repoman-audit.log:', err);
    }

    if (config.logging.consoleOutput) {
      const prefix = `[repoman ${entry.level}] ${entry.category} ->`;
      if (entry.level === 'BLOCK' || entry.level === 'ERROR') {
        console.error(prefix, entry.action, entry.details);
      } else if (entry.level === 'WARN') {
        console.warn(prefix, entry.action, entry.details);
      } else {
        console.log(prefix, entry.action, entry.details);
      }
    }

    return entry;
  }

  public static getLogs(limit = 100): AuditLogEntry[] {
    return memoryAuditLogs.slice(0, limit);
  }

  public static readLogFileContent(linesCount = 50): string {
    try {
      const filePath = this.logFilePath();
      if (!fs.existsSync(filePath)) {
        return '# repoman-audit.log initialized\n';
      }
      const raw = fs.readFileSync(filePath, 'utf8');
      const lines = raw.trim().split('\n');
      return lines.slice(-linesCount).join('\n');
    } catch (err) {
      return `Failed to read log file: ${String(err)}`;
    }
  }

  public static clearLogs(): void {
    memoryAuditLogs.length = 0;
    try {
      const filePath = this.logFilePath();
      fs.writeFileSync(filePath, `# repoman-audit.log cleared at ${new Date().toISOString()}\n`, 'utf8');
    } catch {
      // ignore
    }
  }
}
