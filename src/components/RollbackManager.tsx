/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  Clock,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Camera,
  Layers,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import type { WorkspaceSnapshot } from '../repoman/types.ts';
import { api } from '../services/api.ts';

export const RollbackManager: React.FC<{ onRefresh: () => void }> = ({ onRefresh }) => {
  const [snapshots, setSnapshots] = useState<WorkspaceSnapshot[]>([]);
  const [selectedSnapshot, setSelectedSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const [selectedFile, setSelectedFile] = useState<{ relativePath: string; content: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  const loadSnapshots = async () => {
    try {
      const data = await api.getSnapshots();
      setSnapshots(data.snapshots);
      if (data.snapshots.length > 0 && !selectedSnapshot) {
        setSelectedSnapshot(data.snapshots[0]);
        if (data.snapshots[0].files.length > 0) {
          setSelectedFile(data.snapshots[0].files[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load snapshots:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
  }, []);

  const handleRollback = async (snapshotId: string) => {
    setIsRollingBack(true);
    try {
      const res = await api.rollbackSnapshot(snapshotId);
      if (res.success) {
        setActionMessage({
          text: `Workspace successfully rolled back to ${snapshotId}. Restored ${res.filesRestored.length} files.`
        });
        await loadSnapshots();
        onRefresh();
      } else {
        setActionMessage({ text: res.error || 'Rollback failed', error: true });
      }
    } catch (err) {
      setActionMessage({ text: String(err), error: true });
    } finally {
      setIsRollingBack(false);
    }
  };

  const handleCreateManualSnapshot = async () => {
    try {
      const res = await api.writeFileContent(
        'repoman.snapshot.marker',
        `# Snapshot Created at ${new Date().toISOString()}\n`,
        'User manual snapshot checkpoint'
      );
      if (res.success) {
        setActionMessage({ text: 'Created manual workspace restore checkpoint.' });
        await loadSnapshots();
        onRefresh();
      }
    } catch (err) {
      setActionMessage({ text: String(err), error: true });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-teal-400" />
            Workspace Snapshot & Rollback Stack
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Point-in-time workspace snapshots taken automatically prior to job execution or file modification.
          </p>
        </div>

        <button
          onClick={handleCreateManualSnapshot}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl border border-slate-700 font-medium transition"
        >
          <Camera className="w-4 h-4 text-teal-400" />
          Capture Checkpoint
        </button>
      </div>

      {actionMessage && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            actionMessage.error
              ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
          }`}
        >
          <span>{actionMessage.text}</span>
          <button onClick={() => setActionMessage(null)} className="px-2 py-0.5 hover:bg-white/10 rounded">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Snapshot Stack List */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-1">
            Restore Points ({snapshots.length})
          </h3>

          {snapshots.length === 0 ? (
            <div className="p-8 text-center text-slate-500 bg-slate-900/40 border border-slate-800 rounded-xl text-xs">
              <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              No snapshots captured yet. Triggering a job or patching a file will automatically create one.
            </div>
          ) : (
            <div className="space-y-2">
              {snapshots.map((snap) => {
                const isSelected = selectedSnapshot?.id === snap.id;
                return (
                  <div
                    key={snap.id}
                    onClick={() => {
                      setSelectedSnapshot(snap);
                      if (snap.files.length > 0) setSelectedFile(snap.files[0]);
                    }}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-slate-900 border-teal-500/50 shadow-md shadow-teal-950/30'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-xs font-semibold text-teal-400">{snap.id}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {snap.timestamp.slice(11, 19)}
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 font-medium line-clamp-1">{snap.description}</p>

                    <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                      <span>{snap.files.length} files tracked</span>
                      {snap.jobId && (
                        <span className="text-amber-400 font-mono text-[10px]">job: {snap.jobId}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right 2 Columns: Snapshot Inspector & Diff Preview */}
        <div className="lg:col-span-2 space-y-6">
          {selectedSnapshot ? (
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white font-mono">{selectedSnapshot.id}</h3>
                    <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded font-mono">
                      {selectedSnapshot.timestamp}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1">{selectedSnapshot.description}</p>
                </div>

                <button
                  onClick={() => handleRollback(selectedSnapshot.id)}
                  disabled={isRollingBack}
                  className="flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isRollingBack ? 'animate-spin' : ''}`} />
                  {isRollingBack ? 'Restoring Workspace...' : 'Rollback To This Checkpoint'}
                </button>
              </div>

              {/* Files list inside this snapshot */}
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                  Tracked Files in Snapshot ({selectedSnapshot.files.length})
                </span>

                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                  {selectedSnapshot.files.map((f) => {
                    const isSelectedFile = selectedFile?.relativePath === f.relativePath;
                    return (
                      <button
                        key={f.relativePath}
                        onClick={() => setSelectedFile(f)}
                        className={`px-2.5 py-1 rounded text-xs font-mono transition flex items-center gap-1.5 ${
                          isSelectedFile
                            ? 'bg-teal-500/20 border border-teal-500/40 text-teal-300'
                            : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <FileCode className="w-3 h-3 text-teal-400" />
                        <span>{f.relativePath}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* File Content Preview */}
              {selectedFile && (
                <div className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden">
                  <div className="p-2.5 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-200 font-medium">
                      Snapshot State: {selectedFile.relativePath}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {selectedFile.content.length} characters
                    </span>
                  </div>
                  <pre className="p-4 font-mono text-[11px] text-slate-300 max-h-96 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                    {selectedFile.content || '(File was created or empty at this checkpoint)'}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 bg-slate-900/40 border border-slate-800 rounded-xl text-xs">
              Select a snapshot from the stack to inspect files and initiate safe rollback.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
