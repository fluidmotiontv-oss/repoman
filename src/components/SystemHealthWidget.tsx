/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Cpu,
  HardDrive,
  Activity,
  Server,
  Clock,
  Gauge,
  Zap,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon
} from 'lucide-react';
import type { SystemHealthData } from '../repoman/types.ts';
import { api } from '../services/api.ts';

interface SystemHealthWidgetProps {
  initialHealth?: SystemHealthData;
  onRefreshParent?: () => void;
}

export const SystemHealthWidget: React.FC<SystemHealthWidgetProps> = ({
  initialHealth,
  onRefreshParent
}) => {
  const [health, setHealth] = useState<SystemHealthData | null>(initialHealth || null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoPoll, setAutoPoll] = useState(true);

  const fetchHealth = async () => {
    try {
      setIsRefreshing(true);
      const data = await api.getSystemHealth();
      setHealth(data);
    } catch (err) {
      console.warn('Failed to poll system health:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (initialHealth) {
      setHealth(initialHealth);
    } else {
      fetchHealth();
    }
  }, [initialHealth]);

  // Gentle 6s polling when autoPoll is active
  useEffect(() => {
    if (!autoPoll) return;
    const interval = setInterval(() => {
      fetchHealth();
    }, 6000);
    return () => clearInterval(interval);
  }, [autoPoll]);

  const formatBytes = (bytes: number): string => {
    if (bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
  };

  const formatUptime = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '0s';
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m ${Math.floor(seconds % 60)}s`;
  };

  if (!health) {
    return (
      <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center text-xs text-slate-400 gap-2">
        <Activity className="w-4 h-4 animate-spin text-teal-400" />
        <span>Collecting host telemetry...</span>
      </div>
    );
  }

  const { cpu, memory, disk, uptime, status } = health;

  // Determine progress bar color based on percentage
  const getUsageColor = (percent: number) => {
    if (percent >= 85) return { bar: 'bg-rose-500', text: 'text-rose-400', glow: 'shadow-rose-500/20' };
    if (percent >= 65) return { bar: 'bg-amber-500', text: 'text-amber-400', glow: 'shadow-amber-500/20' };
    return { bar: 'bg-teal-400', text: 'text-teal-400', glow: 'shadow-teal-500/20' };
  };

  const cpuColor = getUsageColor(cpu.usagePercent);
  const memColor = getUsageColor(memory.usagePercent);
  const diskColor = getUsageColor(disk.usagePercent);

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl relative overflow-hidden backdrop-blur-sm">
      {/* Background ambient gradient */}
      <div className="absolute top-0 right-1/4 w-72 h-44 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Widget Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-400 shadow-sm">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-tight">Host System Health & Footprint</h3>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold tracking-wider uppercase flex items-center gap-1.5 ${
                  status === 'HEALTHY'
                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                    : status === 'ELEVATED'
                    ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                    : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    status === 'HEALTHY'
                      ? 'bg-emerald-400 animate-pulse'
                      : status === 'ELEVATED'
                      ? 'bg-amber-400'
                      : 'bg-rose-400 animate-ping'
                  }`}
                />
                {status}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Live Linux resource metrics & repoman agent process consumption
            </p>
          </div>
        </div>

        {/* Polling Toggle & Manual Refresh */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoPoll(!autoPoll)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition flex items-center gap-1.5 border ${
              autoPoll
                ? 'bg-teal-500/10 text-teal-300 border-teal-500/30'
                : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
            title="Toggle live background polling"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${autoPoll ? 'bg-teal-400 animate-ping' : 'bg-slate-600'}`} />
            {autoPoll ? 'Live (6s)' : 'Paused'}
          </button>

          <button
            onClick={fetchHealth}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition disabled:opacity-50"
            title="Fetch latest system metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-teal-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Main 3 Resource Columns: CPU, Memory, Disk */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Resource 1: CPU */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-medium text-slate-300 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-teal-400" />
                CPU Load
              </span>
              <span className={`font-mono font-bold text-sm ${cpuColor.text}`}>
                {cpu.usagePercent}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${cpuColor.bar}`}
                style={{ width: `${Math.min(100, Math.max(3, cpu.usagePercent))}%` }}
              />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Cores / Host:</span>
              <span className="font-mono text-slate-200">{cpu.cores} Cores</span>
            </div>
            <div className="flex justify-between">
              <span>Load Avg (1/5/15m):</span>
              <span className="font-mono text-teal-300">
                {cpu.loadAvg[0]} · {cpu.loadAvg[1]} · {cpu.loadAvg[2]}
              </span>
            </div>
          </div>
        </div>

        {/* Resource 2: Memory */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-medium text-slate-300 flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-cyan-400" />
                RAM Memory
              </span>
              <span className={`font-mono font-bold text-sm ${memColor.text}`}>
                {memory.usagePercent}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${memColor.bar}`}
                style={{ width: `${Math.min(100, Math.max(3, memory.usagePercent))}%` }}
              />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Used / Total:</span>
              <span className="font-mono text-slate-200">
                {formatBytes(memory.usedBytes)} / {formatBytes(memory.totalBytes)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Agent Process RSS:</span>
              <span className="font-mono text-cyan-300">
                {formatBytes(memory.processRssBytes)}
              </span>
            </div>
          </div>
        </div>

        {/* Resource 3: Disk */}
        <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-medium text-slate-300 flex items-center gap-1.5">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                Workspace Disk
              </span>
              <span className={`font-mono font-bold text-sm ${diskColor.text}`}>
                {disk.usagePercent}%
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden p-0.5 border border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-500 ${diskColor.bar}`}
                style={{ width: `${Math.min(100, Math.max(3, disk.usagePercent))}%` }}
              />
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
            <div className="flex justify-between">
              <span>Available Space:</span>
              <span className="font-mono text-slate-200">
                {formatBytes(disk.freeBytes)} free
              </span>
            </div>
            <div className="flex justify-between">
              <span>Total Volume:</span>
              <span className="font-mono text-emerald-300">
                {formatBytes(disk.totalBytes)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-bar: Uptime & Process Overhead Impact */}
      <div className="mt-4 pt-3 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3 text-slate-400 text-[11px]">
          <span className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-slate-500" />
            Host Uptime: <strong className="text-slate-200 font-mono">{formatUptime(uptime.systemSeconds)}</strong>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-teal-400" />
            Agent Daemon Uptime: <strong className="text-teal-300 font-mono">{formatUptime(uptime.processSeconds)}</strong>
          </span>
        </div>

        <div className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
          <span className="text-slate-500">Agent Node Heap:</span>
          <span className="text-slate-200 font-semibold">{formatBytes(memory.processHeapUsedBytes)}</span>
          <span className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[10px] border border-emerald-500/20">
            Low Overhead
          </span>
        </div>
      </div>
    </div>
  );
};
