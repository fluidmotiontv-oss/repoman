/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { exec } from 'node:child_process';
import util from 'node:util';
import path from 'node:path';
import type {
  JobExecutionResult,
  MaintenanceJobDefinition,
  WorkspaceSnapshot
} from '../types.ts';
import { getConfig } from '../core/config.ts';
import { SafeguardsEngine } from '../core/safeguards.ts';
import { AuditLogger } from '../core/logger.ts';
import { WorkspaceManager } from '../core/workspace.ts';
import { GitEngine } from '../git/engine.ts';

const execPromise = util.promisify(exec);
const jobHistory: JobExecutionResult[] = [];
const MAX_JOB_HISTORY = 100;

export class JobRunner {
  private repoDir: string;
  private workspace: WorkspaceManager;
  private git: GitEngine;

  constructor(repoDir = process.cwd()) {
    this.repoDir = path.resolve(repoDir);
    this.workspace = new WorkspaceManager(this.repoDir);
    this.git = new GitEngine(this.repoDir);
  }

  /**
   * Executes a defined maintenance job by ID or definition.
   */
  public async executeJob(
    jobOrId: string | MaintenanceJobDefinition,
    explicitConfirm = false
  ): Promise<JobExecutionResult> {
    const config = getConfig();
    let job: MaintenanceJobDefinition | undefined;

    if (typeof jobOrId === 'string') {
      job = config.jobs.find((j) => j.id === jobOrId);
      if (!job) {
        throw new Error(`Job '${jobOrId}' not found in repoman.config.json`);
      }
    } else {
      job = jobOrId;
    }

    const execution: JobExecutionResult = {
      jobId: job.id,
      jobName: job.name,
      status: 'RUNNING',
      startTime: new Date().toISOString(),
      stepResults: []
    };

    jobHistory.unshift(execution);
    if (jobHistory.length > MAX_JOB_HISTORY) jobHistory.pop();

    AuditLogger.log(
      'INFO',
      'JOB',
      `Starting job execution: ${job.name} (${job.id})`,
      { jobId: job.id, category: job.category },
      'SUCCESS'
    );

    let snapshot: WorkspaceSnapshot | undefined;
    let createdBranch: string | undefined;

    try {
      // 1. Create safety snapshot of project files
      const scan = this.workspace.scanDirectory('.', 3);
      const textFiles = scan.filter((f) => !f.isDir && f.size < 500000).map((f) => f.path);
      snapshot = this.workspace.createSnapshot(
        textFiles.slice(0, 100),
        `Pre-job snapshot for ${job.name} (${job.id})`,
        job.id
      );
      execution.snapshotId = snapshot.id;

      // 2. If configured, create isolated Git branch for the job
      if (job.createBranch) {
        const branchPrefix = job.branchPrefix || `repoman/${job.id}`;
        const branchName = `${branchPrefix}-${Date.now().toString().slice(-6)}`;
        const branchRes = await this.git.createBranch(branchName);
        if (branchRes.success) {
          createdBranch = branchRes.branchName;
          execution.branchCreated = createdBranch;
        }
      }

      // 3. Execute job steps sequentially
      for (const step of job.steps) {
        const stepStart = Date.now();

        // Validate command safety
        const safeCheck = SafeguardsEngine.validateCommand(step.command, explicitConfirm);
        if (!safeCheck.passed) {
          execution.stepResults.push({
            stepName: step.name,
            command: step.command,
            exitCode: 1,
            output: `Blocked by safeguard: ${safeCheck.reason}`,
            durationMs: Date.now() - stepStart,
            status: 'FAILED'
          });

          execution.status = 'BLOCKED';
          execution.error = safeCheck.reason;
          break;
        }

        try {
          const timeout = step.timeoutMs || 45000;
          const { stdout, stderr } = await execPromise(step.command, {
            cwd: this.repoDir,
            timeout
          });

          const durationMs = Date.now() - stepStart;
          const output = (stdout || '') + (stderr ? `\n[STDERR]: ${stderr}` : '');

          execution.stepResults.push({
            stepName: step.name,
            command: step.command,
            exitCode: 0,
            output: output.trim(),
            durationMs,
            status: 'SUCCESS'
          });

          AuditLogger.log(
            'INFO',
            'JOB',
            `Step succeeded: ${step.name}`,
            { jobId: job.id, step: step.name, durationMs },
            'SUCCESS'
          );
        } catch (err: unknown) {
          const durationMs = Date.now() - stepStart;
          const errObj = err as { stdout?: string; stderr?: string; code?: number; message?: string };
          const errOutput = (errObj.stdout || '') + '\n' + (errObj.stderr || errObj.message || 'Execution error');

          execution.stepResults.push({
            stepName: step.name,
            command: step.command,
            exitCode: errObj.code || 1,
            output: errOutput.trim(),
            durationMs,
            status: 'FAILED'
          });

          AuditLogger.log(
            'WARN',
            'JOB',
            `Step failed: ${step.name}`,
            { jobId: job.id, step: step.name, exitCode: errObj.code },
            'FAILED'
          );

          if (!step.continueOnError) {
            // Trigger automatic rollback if configured
            if (step.rollbackOnFailure && snapshot) {
              AuditLogger.log(
                'TX',
                'JOB',
                `Triggering automated rollback due to failure in step '${step.name}'`,
                { jobId: job.id, snapshotId: snapshot.id },
                'ROLLED_BACK'
              );
              this.workspace.rollbackSnapshot(snapshot.id);
              execution.status = 'ROLLED_BACK';
              execution.error = `Step '${step.name}' failed. Workspace successfully rolled back to snapshot ${snapshot.id}.`;
            } else {
              execution.status = 'FAILED';
              execution.error = `Step '${step.name}' failed with code ${errObj.code || 1}.`;
            }
            break;
          }
        }
      }

      // If all steps passed or completed
      if (execution.status === 'RUNNING') {
        execution.status = 'SUCCESS';

        // 4. Auto-commit if enabled
        if (job.autoCommit) {
          const status = await this.git.getStatus();
          if (!status.isClean) {
            await this.git.stageAll();
            const commitMsg =
              job.commitMessageTemplate || `chore(repoman): automated maintenance pass for ${job.name}`;
            const commitRes = await this.git.createCommit(commitMsg);
            if (commitRes.success) {
              execution.commitCreated = commitRes.commitHash;
            }
          }
        }
      }
    } catch (err) {
      execution.status = 'FAILED';
      execution.error = String(err);
      if (snapshot) {
        this.workspace.rollbackSnapshot(snapshot.id);
      }
    } finally {
      execution.endTime = new Date().toISOString();
      if (execution.startTime) {
        execution.durationMs = new Date(execution.endTime).getTime() - new Date(execution.startTime).getTime();
      }

      AuditLogger.log(
        execution.status === 'SUCCESS' ? 'SAFE' : 'ERROR',
        'JOB',
        `Finished job: ${job.name} -> ${execution.status}`,
        {
          jobId: job.id,
          status: execution.status,
          durationMs: execution.durationMs,
          stepsCount: execution.stepResults.length
        },
        execution.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED'
      );
    }

    return execution;
  }

  /**
   * Returns job history.
   */
  public getHistory(): JobExecutionResult[] {
    return [...jobHistory];
  }
}
