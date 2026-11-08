/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Terminal,
  ShieldCheck,
  GitBranch,
  Check,
  ListOrdered
} from 'lucide-react';
import type { JobExecutionResult, MaintenanceJobDefinition } from '../repoman/types.ts';
import { api } from '../services/api.ts';

export const JobRunnerPanel: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const [jobs, setJobs] = useState<MaintenanceJobDefinition[]>([]);
  const [history, setHistory] = useState<JobExecutionResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [activeExecution, setActiveExecution] = useState<JobExecutionResult | null>(null);
  const [requireConfirmation, setRequireConfirmation] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const loadJobsData = async () => {
    try {
      const data = await api.getJobs();
      setJobs(data.jobs);
      setHistory(data.history);
      if (data.jobs.length > 0 && !selectedJobId) {
        setSelectedJobId(data.jobs[0].id);
      }
    } catch (err) {
      console.error('Failed to load jobs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadJobsData();
  }, []);

  const handleRunJob = async (jobId: string) => {
    setRunningJobId(jobId);
    setActiveExecution({
      jobId,
      jobName: jobs.find((j) => j.id === jobId)?.name || jobId,
      status: 'RUNNING',
      startTime: new Date().toISOString(),
      stepResults: []
    });

    try {
      const result = await api.runJob(jobId, requireConfirmation);
      setActiveExecution(result);
      await loadJobsData();
      onRefresh();
    } catch (err) {
      console.error('Job run failed:', err);
    } finally {
      setRunningJobId(null);
    }
  };

  const selectedJob = jobs.find((j) => j.id === selectedJobId) || jobs[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ListOrdered className="w-5 h-5 text-teal-400" />
            Task Runner & Maintenance Job Scheduler
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Automates local maintenance pipelines, security scans, formatters, and builds with automatic rollback on failure.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 select-none">
            <input
              type="checkbox"
              checked={requireConfirmation}
              onChange={(e) => setRequireConfirmation(e.target.checked)}
              className="rounded bg-slate-900 border-slate-700 text-teal-500 focus:ring-teal-500"
            />
            <span>Allow Destructive Steps (--confirm)</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Jobs List (Left Column) */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
            Configured Pipelines ({jobs.length})
          </h3>

          <div className="space-y-2">
            {jobs.map((job) => {
              const isSelected = job.id === selectedJobId;
              const isRunning = runningJobId === job.id;

              return (
                <div
                  key={job.id}
                  onClick={() => setSelectedJobId(job.id)}
                  className={`p-4 rounded-xl border cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-slate-900 border-teal-500/50 shadow-md shadow-teal-950/30'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">{job.name}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-slate-800 text-slate-300 border border-slate-700">
                          {job.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">{job.description}</p>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRunJob(job.id);
                      }}
                      disabled={isRunning || runningJobId !== null}
                      className="p-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 transition disabled:opacity-50 shrink-0"
                      title="Run pipeline now"
                    >
                      <Play className={`w-3.5 h-3.5 fill-current ${isRunning ? 'animate-spin' : ''}`} />
                    </button>
                  </div>

                  <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span>{job.steps.length} sequential steps</span>
                    {job.autoCommit && (
                      <span className="text-teal-400 font-mono flex items-center gap-1">
                        <GitBranch className="w-3 h-3" /> Auto-Commit
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Job Pipeline & Live Execution (Middle + Right 2 Cols) */}
        <div className="lg:col-span-2 space-y-6">
          {selectedJob && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-white">{selectedJob.name}</h3>
                    <span className="text-xs font-mono text-teal-400 bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                      ID: {selectedJob.id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{selectedJob.description}</p>
                </div>

                <button
                  onClick={() => handleRunJob(selectedJob.id)}
                  disabled={runningJobId !== null}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-semibold text-xs rounded-xl shadow-lg shadow-teal-500/20 transition disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 fill-current ${runningJobId === selectedJob.id ? 'animate-spin' : ''}`} />
                  {runningJobId === selectedJob.id ? 'Executing Pipeline...' : 'Execute Pipeline'}
                </button>
              </div>

              {/* Step Sequence Details */}
              <div className="space-y-2 mb-4">
                <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
                  Execution Steps Pipeline
                </span>
                <div className="space-y-2">
                  {selectedJob.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center font-mono text-[10px]">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="font-medium text-slate-200">{step.name}</p>
                          <p className="font-mono text-[11px] text-teal-300/80 mt-0.5">{step.command}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {step.rollbackOnFailure && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                            <RotateCcw className="w-2.5 h-2.5" /> Auto-Rollback
                          </span>
                        )}
                        {step.continueOnError && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-400">
                            Continue on Error
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Job Configuration Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-slate-950/50 p-3 rounded-lg border border-slate-800/80">
                <div>
                  <span className="text-slate-400">Create Dedicated Branch:</span>
                  <p className="font-mono text-slate-200 mt-0.5">
                    {selectedJob.createBranch ? selectedJob.branchPrefix || 'Yes' : 'No (Use Current)'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Auto-Commit on Success:</span>
                  <p className="font-mono text-slate-200 mt-0.5">
                    {selectedJob.autoCommit ? 'Enabled' : 'Disabled'}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400">Schedule (Cron):</span>
                  <p className="font-mono text-slate-200 mt-0.5">
                    {selectedJob.schedule || 'Manual Trigger'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Active / Most Recent Execution Live Console */}
          {activeExecution && (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-teal-400" />
                  <h3 className="text-sm font-semibold text-white">
                    Execution Output: {activeExecution.jobName}
                  </h3>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={`px-2 py-0.5 rounded font-mono font-medium ${
                      activeExecution.status === 'SUCCESS'
                        ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                        : activeExecution.status === 'ROLLED_BACK'
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                        : activeExecution.status === 'RUNNING'
                        ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 animate-pulse'
                        : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                    }`}
                  >
                    {activeExecution.status}
                  </span>
                  {activeExecution.durationMs !== undefined && (
                    <span className="text-slate-400 font-mono">{activeExecution.durationMs}ms</span>
                  )}
                </div>
              </div>

              {/* Execution Details & Steps */}
              {activeExecution.error && (
                <div className="p-3 mb-3 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2">
                  <XCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Execution Halted: </span>
                    {activeExecution.error}
                  </div>
                </div>
              )}

              {activeExecution.snapshotId && (
                <div className="p-2 mb-3 rounded bg-slate-950 border border-slate-800 text-xs text-slate-300 flex items-center justify-between font-mono">
                  <span>Pre-Job Snapshot: {activeExecution.snapshotId}</span>
                  <span className="text-teal-400">Restore Point Active</span>
                </div>
              )}

              <div className="space-y-2">
                {activeExecution.stepResults.map((step, idx) => (
                  <div key={idx} className="rounded-lg bg-slate-950 border border-slate-800/90 overflow-hidden text-xs">
                    <div className="p-2.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {step.status === 'SUCCESS' ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        <span className="font-semibold text-slate-200">{step.stepName}</span>
                        <span className="font-mono text-slate-500 text-[11px]">{step.command}</span>
                      </div>
                      <span className="font-mono text-slate-400 text-[11px]">{step.durationMs}ms</span>
                    </div>
                    {step.output && (
                      <pre className="p-3 font-mono text-[11px] text-slate-300 bg-slate-950 overflow-x-auto max-h-40 whitespace-pre-wrap">
                        {step.output}
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historical Runs */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
              Recent Job History ({history.length})
            </h3>

            {history.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">No jobs executed yet in this session.</p>
            ) : (
              <div className="space-y-2">
                {history.slice(0, 5).map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                          item.status === 'SUCCESS'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : item.status === 'ROLLED_BACK'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-rose-500/10 text-rose-400'
                        }`}
                      >
                        {item.status}
                      </span>
                      <div>
                        <span className="font-medium text-slate-200">{item.jobName}</span>
                        <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                          {item.startTime.slice(11, 19)} ({item.durationMs || 0}ms)
                        </p>
                      </div>
                    </div>

                    {item.commitCreated && (
                      <span className="font-mono text-teal-400 text-[11px] bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">
                        commit: {item.commitCreated}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
