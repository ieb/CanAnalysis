import React, { useRef } from 'react';
import { Activity, Upload, FileText, AlertCircle, Cpu, Clock } from 'lucide-react';
import { AnalysisSummary } from '../types/n2k';

interface NavbarProps {
  summary: AnalysisSummary | null;
  onFileUpload: (file: File) => void;
  isAnalyzing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  summary,
  onFileUpload,
  isAnalyzing,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onFileUpload(e.target.files[0]);
    }
  };

  return (
    <header className="glass-panel sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/80 px-4 py-3 shadow-xl backdrop-blur-md">
      <div className="mx-auto flex flex-wrap items-center justify-between gap-4 max-w-7xl">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-500 shadow-lg shadow-cyan-500/20 ring-1 ring-cyan-400/30">
            <Activity className="h-5 w-5 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white font-sans">CanAnalysis</h1>
              <span className="rounded-full bg-cyan-950/80 px-2.5 py-0.5 text-xs font-semibold text-cyan-400 border border-cyan-800/50">
                NMEA 2000
              </span>
            </div>
            <p className="text-xs text-slate-400">Technical CAN Bus & Address Claim Diagnostics</p>
          </div>
        </div>

        {/* Dataset Stats Summary Pill */}
        {summary && (
          <div className="hidden lg:flex items-center gap-4 rounded-xl bg-slate-900/90 px-4 py-2 border border-slate-800/80 text-xs shadow-inner">
            <div className="flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-cyan-400" />
              <span className="text-slate-400">Packets:</span>
              <span className="font-mono font-semibold text-slate-200">{summary.totalPackets.toLocaleString()}</span>
            </div>
            <div className="h-3.5 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-slate-400">Duration:</span>
              <span className="font-mono font-semibold text-slate-200">{(summary.durationMs / 1000).toFixed(2)}s</span>
            </div>
            <div className="h-3.5 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <Cpu className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-slate-400">Devices:</span>
              <span className="font-mono font-semibold text-emerald-400">{summary.uniqueDevicesCount}</span>
            </div>
            <div className="h-3.5 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <AlertCircle className={`h-3.5 w-3.5 ${summary.totalAnomaliesCount > 0 ? 'text-amber-400' : 'text-slate-400'}`} />
              <span className="text-slate-400">Anomalies:</span>
              <span className={`font-mono font-semibold ${summary.totalAnomaliesCount > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
                {summary.totalAnomaliesCount}
              </span>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".log,.csv,.txt"
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            className="flex items-center gap-2 rounded-lg bg-slate-800 px-3.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:text-white border border-slate-700 active:scale-95"
          >
            <Upload className="h-3.5 w-3.5 text-cyan-400" />
            <span>Open Log File</span>
          </button>
        </div>
      </div>
    </header>
  );
};
