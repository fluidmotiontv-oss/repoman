/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  BookOpen,
  Code2,
  Terminal,
  ShieldCheck,
  RotateCcw,
  GitBranch,
  Copy,
  Check,
  Server,
  Layers,
  CheckCircle2
} from 'lucide-react';

export const DocsAndGuide: React.FC = () => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const cliSnippets = {
    install: `git clone <repo-url> repoman-agent\ncd repoman-agent\nnpm install`,
    dev: `npm run dev  # Starts full-stack on port 3000`,
    status: `npx tsx src/repoman/cli.ts status`,
    scan: `npx tsx src/repoman/cli.ts scan --depth 3`,
    run: `npx tsx src/repoman/cli.ts run lint-and-autofix`,
    runConfirm: `npx tsx src/repoman/cli.ts run sync-upstream --confirm`,
    rollback: `npx tsx src/repoman/cli.ts rollback [snapshot-id]`,
    audit: `npx tsx src/repoman/cli.ts audit --lines 30`
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-teal-400" />
          Architecture Specifications & Setup Manual
        </h2>
        <p className="text-xs text-slate-300 mt-1">
          Complete engineering reference for deploying and integrating repoman-agent into your Linux server and Git pipelines.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Architecture Modules */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-teal-400" />
              1. Core Architecture & Modules Breakdown
            </h3>

            <div className="space-y-3 text-xs">
              {/* Module 1 */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-teal-300">CLI / Interface Layer</span>
                  <span className="font-mono text-[10px] text-slate-500">src/repoman/cli.ts</span>
                </div>
                <p className="text-slate-300">
                  Built on Commander.js. Provides a rich suite of command-line tools for repository scanning, task scheduling, automated patching, Git syncing, and rollback executions.
                </p>
              </div>

              {/* Module 2 */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-teal-300">Git Operations Engine</span>
                  <span className="font-mono text-[10px] text-slate-500">src/repoman/git/engine.ts</span>
                </div>
                <p className="text-slate-300">
                  Directly interfaces with local Git commands. Handles automated branch creation, staging with safeguard filters, conventional commit generation, push/pull synchronization, and merge conflict inspection.
                </p>
              </div>

              {/* Module 3 */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-teal-300">Local File Workspace Manager</span>
                  <span className="font-mono text-[10px] text-slate-500">src/repoman/core/workspace.ts</span>
                </div>
                <p className="text-slate-300">
                  Safely reads, validates, and modifies local project files (JSON, YAML, Markdown, TS/JS). Maintains an in-memory snapshot stack with automatic rollbacks if any step fails.
                </p>
              </div>

              {/* Module 4 */}
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-teal-300">Task Runner / Job Scheduler</span>
                  <span className="font-mono text-[10px] text-slate-500">src/repoman/jobs/runner.ts</span>
                </div>
                <p className="text-slate-300">
                  Modular job queue executing defined maintenance scripts, linter checks, dependency updates, and build pipelines with timeout protection, step tracking, and automatic rollback triggers.
                </p>
              </div>
            </div>
          </div>

          {/* Safety & Guardrails */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              2. Safety, Logging & Guardrails
            </h3>

            <div className="space-y-3 text-xs text-slate-300">
              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="font-bold text-emerald-300 block mb-1">Execution Safeguards</span>
                <p>
                  Strictly prevents destructive operations: blocks force pushes (<code className="text-rose-400">git push --force</code>, <code className="text-rose-400">-f</code>), prevents accidental uncommitted overwrites, and blocks execution of dangerous patterns like <code className="text-rose-400">rm -rf /</code> without explicit confirmation (<code className="text-teal-300">--confirm</code>).
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="font-bold text-emerald-300 block mb-1">Audit Logging</span>
                <p>
                  Maintains an immutable, structured log file (<code className="text-teal-300">repoman-audit.log</code>) recording every Git transaction, file modification, safeguard block, and job outcome with precise ISO timestamps.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                <span className="font-bold text-emerald-300 block mb-1">Environment Isolation</span>
                <p>
                  Restricts file reading and writing strictly within allowed repository boundaries, protecting external host system files and sensitive credential masks (<code className="text-amber-300">.env*</code>, <code className="text-amber-300">*.pem</code>, <code className="text-amber-300">id_rsa*</code>).
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Setup & CLI Quick Reference */}
        <div className="space-y-6">
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Terminal className="w-4 h-4 text-teal-400" />
              CLI Quick Reference
            </h3>

            <div className="space-y-2">
              {[
                { title: 'Status & Safeguards', cmd: cliSnippets.status, id: 'status' },
                { title: 'Scan Repository Boundaries', cmd: cliSnippets.scan, id: 'scan' },
                { title: 'Execute Maintenance Job', cmd: cliSnippets.run, id: 'run' },
                { title: 'Run with Destructive Confirm', cmd: cliSnippets.runConfirm, id: 'confirm' },
                { title: 'Rollback Workspace', cmd: cliSnippets.rollback, id: 'rollback' },
                { title: 'Inspect Audit Logs', cmd: cliSnippets.audit, id: 'audit' }
              ].map((item) => (
                <div key={item.id} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="font-medium text-[11px] text-slate-300">{item.title}</span>
                    <button
                      onClick={() => copyToClipboard(item.cmd, item.id)}
                      className="p-1 hover:text-white rounded"
                    >
                      {copiedSection === item.id ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                  <pre className="font-mono text-[10px] text-teal-300 overflow-x-auto">{item.cmd}</pre>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-cyan-400" />
              Environment Requirements
            </h3>
            <ul className="space-y-2 text-xs text-slate-300">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>Node.js v18+ or Bun v1.0+ runtime</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>Git v2.25+ installed on local host</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>Port 3000 open for Web Control Plane</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400 shrink-0" />
                <span>Optional GEMINI_API_KEY for AI commit generator</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
