/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import path from 'node:path';
import type { RepomanConfig } from '../types.ts';

export const DEFAULT_CONFIG: RepomanConfig = {
  version: '1.0.0',
  agentName: 'repoman-agent',
  activeRepository: 'local-repo',
  repositories: [
    {
      name: 'local-repo',
      path: '.',
      defaultBranch: 'main',
      remote: 'origin'
    }
  ],
  safeguards: {
    allowForcePush: false,
    blockedFilePatterns: [
      '.env*',
      '*.pem',
      'id_rsa*',
      '*.key',
      'credentials.json',
      'secrets/**',
      '.git/**'
    ],
    blockedCommands: [
      'rm -rf /',
      'rm -rf ~',
      'git push --force',
      'git push -f',
      'git reset --hard origin',
      'dropdb',
      'mkfs',
      'dd if='
    ],
    requireCleanWorkingTree: true,
    maxFilesPerCommit: 25,
    maxLinesChangedPerJob: 1500,
    allowedRepositoryPaths: ['.', './src/*', './services/*', './packages/*'],
    requireConfirmationForDestructive: true
  },
  jobs: [
    {
      id: 'lint-and-autofix',
      name: 'Lint & Automated Formatting',
      description: 'Scans workspace files, executes linter checks, and applies automated style fixes.',
      category: 'lint',
      steps: [
        {
          name: 'Run Type Check',
          command: 'npm run lint',
          continueOnError: false,
          rollbackOnFailure: true
        }
      ],
      autoCommit: true,
      commitMessageTemplate: 'chore(lint): automated linter pass [skip ci]',
      createBranch: true,
      branchPrefix: 'repoman/lint-pass'
    },
    {
      id: 'dependency-audit',
      name: 'Dependency Security Audit',
      description: 'Performs vulnerability scan on packages and verifies lockfile integrity.',
      category: 'security',
      steps: [
        {
          name: 'Audit Dependencies',
          command: 'npm audit --audit-level=high',
          continueOnError: true
        }
      ],
      autoCommit: false
    }
  ],
  logging: {
    logFilePath: './repoman-audit.log',
    level: 'INFO',
    consoleOutput: true
  }
};

let cachedConfig: RepomanConfig | null = null;

export function loadConfig(configPath?: string): RepomanConfig {
  const targetPath = configPath || path.resolve(process.cwd(), 'repoman.config.json');

  if (fs.existsSync(targetPath)) {
    try {
      const raw = fs.readFileSync(targetPath, 'utf8');
      const parsed = JSON.parse(raw) as Partial<RepomanConfig>;
      cachedConfig = {
        ...DEFAULT_CONFIG,
        ...parsed,
        safeguards: {
          ...DEFAULT_CONFIG.safeguards,
          ...(parsed.safeguards || {})
        },
        logging: {
          ...DEFAULT_CONFIG.logging,
          ...(parsed.logging || {})
        }
      };
      return cachedConfig;
    } catch (err) {
      console.error(`Failed to parse config at ${targetPath}:`, err);
    }
  }

  cachedConfig = { ...DEFAULT_CONFIG };
  return cachedConfig;
}

export function saveConfig(config: RepomanConfig, configPath?: string): void {
  const targetPath = configPath || path.resolve(process.cwd(), 'repoman.config.json');
  fs.writeFileSync(targetPath, JSON.stringify(config, null, 2), 'utf8');
  cachedConfig = config;
}

export function getConfig(): RepomanConfig {
  if (!cachedConfig) {
    return loadConfig();
  }
  return cachedConfig;
}
