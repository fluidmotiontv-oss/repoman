# repoman-agent

> Autonomous local and Git workflow automation agent engineered for Linux server environments. Built with high-reliability TypeScript, safety guardrails, point-in-time file rollback snapshots, and structured audit logging.

---

## 1. System Architecture Overview

`repoman-agent` operates as an autonomous daemon, automated task runner, and developer CLI on local or remote Linux instances. It bridges the gap between raw Git operations, local filesystem modifications, and CI/CD maintenance jobs.

```
+-------------------------------------------------------------------------+
|                              USER INTERFACES                            |
|    +-----------------------+               +-----------------------+    |
|    |  CLI / Commander.js   |               | Web Dashboard (React) |    |
|    |  (repoman <command>)  |               | (Port 3000 Web UI)    |    |
|    +-----------+-----------+               +-----------+-----------+    |
+----------------|---------------------------------------|----------------+
                 |                                       |
                 v                                       v
+-------------------------------------------------------------------------+
|                  EXPRESS CONTROL PLANE & REST API (/server.ts)          |
|    - /api/repoman/status        - /api/repoman/jobs/run                 |
|    - /api/repoman/git/*         - /api/repoman/workspace/rollback      |
|    - /api/repoman/audit/logs    - /api/repoman/cli/execute              |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                           CORE REPOMAN MODULES                          |
|                                                                         |
|  +---------------------+   +---------------------+   +---------------+  |
|  |   Safeguards Engine |   |  Workspace Manager  |   |  Audit Logger |  |
|  | - Block force push  |   | - Atomic file edits |   | - Structured  |  |
|  | - Protect .env/keys |   | - Snapshot stack    |   |   JSON/text   |  |
|  | - Sandbox bounds    |   | - 1-click rollback  |   | - Audit trail |  |
|  +----------+----------+   +----------+----------+   +-------+-------+  |
|             |                         |                      |          |
|             v                         v                      v          |
|  +---------------------+   +---------------------+   +---------------+  |
|  |   Git Engine        |   |   Job Runner        |   | Config Engine |  |
|  | - Branch management|   | - Pipeline steps    |   | - Schema check|  |
|  | - Safe staging      |   | - Auto-rollback     |   | - Dynamic     |  |
|  | - Conflict detect   |   | - Auto-commit       |   |   reload      |  |
|  +---------------------+   +---------------------+   +---------------+  |
+------------------------------------+------------------------------------+
                                     |
                                     v
+-------------------------------------------------------------------------+
|                       LOCAL ENVIRONMENT & REPOSITORY                    |
|       - Git Repository (.git)         - Local Source Files              |
|       - repoman-audit.log             - repoman.config.json             |
+-------------------------------------------------------------------------+
```

### Module Responsibilities:
1. **CLI / Interface Layer (`src/repoman/cli.ts`):** 
   Accepts commands for repository scanning, task scheduling, automated patching, rollback, and Git synchronization using Commander.js.
2. **Git Operations Engine (`src/repoman/git/engine.ts`):**
   Executes native Git operations with pre-flight safety checks. Manages branching, staging, automated commit messaging, push/pull sync, and conflict detection.
3. **Local File Workspace Manager (`src/repoman/core/workspace.ts`):**
   Safely reads, validates, and modifies local project files (JSON, TypeScript, Markdown, YAML) with an in-memory snapshot stack to provide zero-data-loss rollback if a task fails.
4. **Task Runner / Job Scheduler (`src/repoman/jobs/runner.ts`):**
   A modular execution pipeline that runs linter checks, dependency audits, build tasks, and release automations. Automatically creates Git branches and commits when steps succeed, or triggers rollback upon failure.
5. **Execution Safeguards (`src/repoman/core/safeguards.ts`):**
   Strictly prevents destructive operations:
   - Blocks `--force` pushes and destructive resets without explicit confirmation flags.
   - Enforces workspace sandbox boundaries (prevents writing outside allowed repository paths).
   - Protects sensitive files (`.env`, `*.pem`, `id_rsa`, `credentials.json`, `secrets/`).
6. **Audit Logger (`src/repoman/core/logger.ts`):**
   Appends structured, immutable transaction records to `repoman-audit.log` tracking every Git action, file modification, and safeguard block.

---

## 2. Directory Structure

```
├── repoman.config.json          # Main configuration file (safeguards, jobs, repos)
├── repoman-audit.log            # Structured audit log file
├── server.ts                    # Express REST API & Vite middleware server
├── package.json                 # Project dependencies & scripts
├── README.md                    # System documentation
└── src/
    ├── repoman/
    │   ├── types.ts             # TypeScript definitions and config schemas
    │   ├── cli.ts               # Commander.js CLI entry point
    │   ├── core/
    │   │   ├── config.ts        # Configuration loader & validator
    │   │   ├── logger.ts        # Structured audit logger
    │   │   ├── safeguards.ts    # Execution safeguards & boundary guardrails
    │   │   └── workspace.ts     # Workspace manager with snapshot & rollback
    │   ├── git/
    │   │   └── engine.ts        # Git commands, branches, commits & conflict engine
    │   └── jobs/
    │       └── runner.ts        # Modular pipeline runner with auto-rollback
    ├── components/              # Interactive Web Control Plane
    │   ├── Navbar.tsx           # Header & active repository switcher
    │   ├── Dashboard.tsx        # Overview metrics & quick status
    │   ├── GitVisualizer.tsx    # Visual branch graph, staging & commit maker
    │   ├── JobRunnerPanel.tsx   # Interactive task runner with live logs
    │   ├── RollbackManager.tsx  # Snapshot explorer & 1-click restore
    │   ├── AuditLogViewer.tsx   # Live repoman-audit.log stream & filter
    │   ├── TerminalEmulator.tsx # Embedded interactive CLI terminal
    │   ├── ConfigEditor.tsx     # JSON & visual configuration editor
    │   └── DocsAndGuide.tsx     # System guide & setup docs
    ├── services/
    │   └── api.ts               # REST API client
    ├── App.tsx                  # Main Web control plane layout
    ├── index.css                # Tailwind styling
    └── main.tsx                 # React entry point
```

---

## 3. Configuration Template (`repoman.config.json`)

```json
{
  "version": "1.0.0",
  "agentName": "repoman-agent",
  "activeRepository": "local-repo",
  "repositories": [
    {
      "name": "local-repo",
      "path": ".",
      "defaultBranch": "main",
      "remote": "origin"
    }
  ],
  "safeguards": {
    "allowForcePush": false,
    "blockedFilePatterns": [
      ".env*",
      "*.pem",
      "id_rsa*",
      "*.key",
      "credentials.json",
      "secrets/**",
      ".git/**"
    ],
    "blockedCommands": [
      "rm -rf /",
      "rm -rf ~",
      "git push --force",
      "git push -f",
      "git reset --hard origin"
    ],
    "requireCleanWorkingTree": true,
    "maxFilesPerCommit": 25,
    "maxLinesChangedPerJob": 1500,
    "allowedRepositoryPaths": [
      ".",
      "./src/*",
      "./services/*",
      "./packages/*"
    ],
    "requireConfirmationForDestructive": true
  },
  "jobs": [
    {
      "id": "lint-and-autofix",
      "name": "Lint & Automated Formatting",
      "description": "Scans workspace files, executes linter checks, and applies automated style fixes.",
      "category": "lint",
      "steps": [
        {
          "name": "Run Type Check",
          "command": "npm run lint",
          "continueOnError": false,
          "rollbackOnFailure": true
        }
      ],
      "autoCommit": true,
      "commitMessageTemplate": "chore(lint): automated linter pass [skip ci]",
      "createBranch": true,
      "branchPrefix": "repoman/lint-pass"
    }
  ],
  "logging": {
    "logFilePath": "./repoman-audit.log",
    "level": "INFO",
    "consoleOutput": true
  }
}
```

---

## 4. Setup & Usage Guide

### Prerequisites
- **Node.js**: v18+ (or **Bun** v1.0+)
- **Git**: v2.25+ installed on host system
- **OS**: Linux / macOS / WSL2

### Installation

```bash
# Clone or place repoman-agent into your server
git clone <repo-url> repoman-agent
cd repoman-agent

# Install dependencies
npm install
```

### Running the Web Control Plane
Start the full-stack server on port 3000:
```bash
npm run dev
# Server listening on http://localhost:3000
```

### Running the CLI Directly
You can run the CLI directly via `npx tsx` or `npm run repoman`:

```bash
# View current status and safeguards
npx tsx src/repoman/cli.ts status

# Scan repository boundaries and protected files
npx tsx src/repoman/cli.ts scan --depth 3

# Run a maintenance job pipeline
npx tsx src/repoman/cli.ts run lint-and-autofix

# Run with explicit confirmation for destructive steps
npx tsx src/repoman/cli.ts run sync-upstream --confirm

# Synchronize Git repository with remote
npx tsx src/repoman/cli.ts sync --remote origin --branch main

# Safely patch a file with snapshot rollback protection
npx tsx src/repoman/cli.ts patch src/config.json '{"theme":"dark"}' --desc "Theme update"

# Rollback to the most recent or specified snapshot
npx tsx src/repoman/cli.ts rollback
npx tsx src/repoman/cli.ts rollback snap-173100000-abcd

# Inspect the structured audit log
npx tsx src/repoman/cli.ts audit --lines 30
```

---

## 5. Audit Log Format (`repoman-audit.log`)

Every Git transaction, file write, job step, and safeguard interception is appended with UTC timestamps:

```
[2026-11-08T11:15:00.123Z] [INFO ] [CLI      ] [SUCCESS  ] Repoman Agent server process initialized - {"port":3000}
[2026-11-08T11:15:10.450Z] [SAFE ] [FILE     ] [SUCCESS  ] Created workspace snapshot: snap-1731064510-x891 - {"fileCount":42}
[2026-11-08T11:15:12.890Z] [BLOCK] [SAFEGUARD] [BLOCKED  ] Blocked force push command: git push --force - {"allowForcePush":false}
[2026-11-08T11:15:15.300Z] [TX   ] [GIT      ] [SUCCESS  ] Created commit a89c2d1: chore(lint): automated linter pass
```
