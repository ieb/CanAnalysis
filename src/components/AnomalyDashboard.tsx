import React, { useState } from 'react';
import { AlertOctagon, AlertTriangle, Info, ArrowUpRight, CheckCircle2, ShieldAlert, Target } from 'lucide-react';
import { BusAnomaly, DeviceFocusTarget } from '../types/n2k';

interface AnomalyDashboardProps {
  anomalies: BusAnomaly[];
  focusedDevice?: DeviceFocusTarget | null;
  onSeekToTimestamp: (timestampMs: number) => void;
}

export const AnomalyDashboard: React.FC<AnomalyDashboardProps> = ({
  anomalies,
  focusedDevice,
  onSeekToTimestamp,
}) => {
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

  const filtered = anomalies.filter((a) => {
    if (focusedDevice && a.address !== undefined && a.address !== focusedDevice.address) return false;
    if (filterSeverity === 'critical') return a.severity === 'critical';
    if (filterSeverity === 'warning') return a.severity === 'warning';
    if (filterSeverity === 'info') return a.severity === 'info';
    return true;
  });

  const criticalCount = filtered.filter((a) => a.severity === 'critical').length;
  const warningCount = filtered.filter((a) => a.severity === 'warning').length;
  const infoCount = filtered.filter((a) => a.severity === 'info').length;

  return (
    <div className="glass-panel rounded-2xl p-5 shadow-2xl mb-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-950/80 border border-amber-800 text-amber-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-100">Technical Bus Health Anomalies</h2>
              {focusedDevice && (
                <span className="flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
                  <Target className="h-3 w-3" /> Addr {focusedDevice.address} Only
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {focusedDevice
                ? `Showing health warnings affecting focused device Addr ${focusedDevice.address} (${focusedDevice.modelId || 'Target Device'})`
                : `Address claim disputes, unanswered ISO requests, and protocol health flags (${anomalies.length} total)`}
            </p>
          </div>
        </div>

        {/* Severity Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1 border border-slate-800 text-xs">
          <button
            onClick={() => setFilterSeverity('all')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              filterSeverity === 'all' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({filtered.length})
          </button>
          <button
            onClick={() => setFilterSeverity('critical')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              filterSeverity === 'critical' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Critical ({criticalCount})
          </button>
          <button
            onClick={() => setFilterSeverity('warning')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              filterSeverity === 'warning' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Warnings ({warningCount})
          </button>
          <button
            onClick={() => setFilterSeverity('info')}
            className={`px-3 py-1 rounded font-medium transition-colors ${
              filterSeverity === 'info' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Info ({infoCount})
          </button>
        </div>
      </div>

      {/* Anomaly Feed */}
      {filtered.length === 0 ? (
        <div className="flex items-center justify-center gap-2 p-8 text-center text-emerald-400 text-xs bg-slate-950/40 rounded-xl border border-slate-800/60">
          <CheckCircle2 className="h-4 w-4" />
          <span>No anomalies detected matching the current filter!</span>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
          {filtered.map((anomaly) => (
            <div
              key={anomaly.id}
              className={`flex flex-wrap items-center justify-between gap-4 p-3 rounded-xl border transition-all ${
                anomaly.severity === 'critical'
                  ? 'bg-rose-950/20 border-rose-800/60 hover:bg-rose-950/40'
                  : anomaly.severity === 'warning'
                  ? 'bg-amber-950/20 border-amber-800/60 hover:bg-amber-950/40'
                  : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-start gap-3">
                {anomaly.severity === 'critical' ? (
                  <AlertOctagon className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
                ) : anomaly.severity === 'warning' ? (
                  <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <Info className="h-5 w-5 text-cyan-400 shrink-0 mt-0.5" />
                )}

                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-0.5">
                    <h3 className="text-xs font-bold text-slate-100">{anomaly.title}</h3>
                    {anomaly.address !== undefined && (
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-950 text-cyan-300 border border-slate-800">
                        Addr {anomaly.address}
                      </span>
                    )}
                    {anomaly.pgn !== undefined && (
                      <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-950 text-blue-300 border border-slate-800">
                        PGN {anomaly.pgn}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300">{anomaly.description}</p>
                </div>
              </div>

              {/* Seek Button */}
              <button
                onClick={() => onSeekToTimestamp(anomaly.timestampMs)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-cyan-600 text-xs font-mono text-cyan-300 hover:text-white border border-slate-800 transition-all shrink-0 active:scale-95"
                title="Seek Timeline Pointer to Event"
              >
                <span>{anomaly.timestamp.split(' ')[1] || anomaly.timestamp}</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
