import React, { useRef, useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, AlertTriangle, RotateCcw, Clock, Target, Maximize2, X } from 'lucide-react';
import { TimelineBucket, BusAnomaly, DeviceFocusTarget } from '../types/n2k';

interface TimelineControlsProps {
  buckets: TimelineBucket[];
  anomalies: BusAnomaly[];
  startMs: number;
  endMs: number;
  currentMs: number;
  focusedDevice?: DeviceFocusTarget | null;
  timeWindow: { startMs: number; endMs: number } | null;
  onSeek: (timestampMs: number) => void;
  onSelectTimeWindow: (window: { startMs: number; endMs: number } | null) => void;
  onNextAnomaly: () => void;
  onPrevAnomaly: () => void;
  disabled?: boolean;
}

export const TimelineControls: React.FC<TimelineControlsProps> = ({
  buckets,
  anomalies,
  startMs,
  endMs,
  currentMs,
  focusedDevice,
  timeWindow,
  onSeek,
  onSelectTimeWindow,
  onNextAnomaly,
  onPrevAnomaly,
  disabled = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playSpeed, setPlaySpeed] = useState<number>(1);
  const [isSelecting, setIsSelecting] = useState<boolean>(false);
  const [dragStartRatio, setDragStartRatio] = useState<number | null>(null);
  const [dragEndRatio, setDragEndRatio] = useState<number | null>(null);

  const displayStartMs = timeWindow ? timeWindow.startMs : startMs;
  const displayEndMs = timeWindow ? timeWindow.endMs : endMs;
  const displayDurationMs = Math.max(1, displayEndMs - displayStartMs);
  const progressRatio = Math.max(0, Math.min(1, (currentMs - displayStartMs) / displayDurationMs));

  // Playback timer
  useEffect(() => {
    if (!isPlaying || disabled) return;

    const interval = setInterval(() => {
      onSeek(Math.min(displayEndMs, currentMs + 100 * playSpeed));
      if (currentMs >= displayEndMs) {
        setIsPlaying(false);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, playSpeed, currentMs, displayEndMs, onSeek, disabled]);

  // Draw visual timeline chart on Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // Draw grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    if (disabled || buckets.length === 0) {
      ctx.fillStyle = '#64748b';
      ctx.font = '500 14px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Open a CAN log to populate the timeline', width / 2, height / 2);
      return;
    }

    const maxRate = Math.max(10, ...buckets.map((b) => b.packetRate));
    const barWidth = width / buckets.length;

    // Render packet rate bars
    buckets.forEach((bucket, i) => {
      const x = i * barWidth;
      const barHeight = (bucket.packetRate / maxRate) * (height - 20);
      const y = height - barHeight;

      // Color coding for bucket
      if (bucket.anomalyCount > 0) {
        ctx.fillStyle = '#f59e0b'; // Amber warning
      } else if (bucket.hasAddressClaim) {
        ctx.fillStyle = '#3b82f6'; // Blue address claim
      } else if (focusedDevice) {
        ctx.fillStyle = '#38bdf8'; // Focused device cyan traffic
      } else {
        ctx.fillStyle = '#06b6d4'; // Normal bus traffic
      }

      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });

    // Render active drag selection preview
    if (isSelecting && dragStartRatio !== null && dragEndRatio !== null) {
      const x1 = Math.min(dragStartRatio, dragEndRatio) * width;
      const x2 = Math.max(dragStartRatio, dragEndRatio) * width;
      const w = x2 - x1;

      ctx.fillStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.fillRect(x1, 0, w, height);

      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.strokeRect(x1, 0, w, height);
    }

    // Render anomaly markers at top of canvas
    anomalies.forEach((a) => {
      const x = ((a.timestampMs - displayStartMs) / displayDurationMs) * width;
      ctx.fillStyle = a.severity === 'critical' ? '#ef4444' : '#f59e0b';
      ctx.beginPath();
      ctx.arc(x, 8, 4, 0, Math.PI * 2);
      ctx.fill();
    });

    // Render pointer line
    const pointerX = progressRatio * width;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pointerX, 0);
    ctx.lineTo(pointerX, height);
    ctx.stroke();

    // Pointer head triangle
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(pointerX - 6, 0);
    ctx.lineTo(pointerX + 6, 0);
    ctx.lineTo(pointerX, 8);
    ctx.closePath();
    ctx.fill();
  }, [buckets, anomalies, currentMs, progressRatio, displayStartMs, displayEndMs, displayDurationMs, focusedDevice, isSelecting, dragStartRatio, dragEndRatio, disabled]);

  const getRatioFromEvent = (e: React.MouseEvent<HTMLCanvasElement>): number => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    return Math.max(0, Math.min(1, clickX / rect.width));
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const ratio = getRatioFromEvent(e);
    setIsSelecting(true);
    setDragStartRatio(ratio);
    setDragEndRatio(ratio);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled || !isSelecting) return;
    const ratio = getRatioFromEvent(e);
    setDragEndRatio(ratio);
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled || !isSelecting || dragStartRatio === null) return;
    const endRatio = getRatioFromEvent(e);
    setIsSelecting(false);

    const minRatio = Math.min(dragStartRatio, endRatio);
    const maxRatio = Math.max(dragStartRatio, endRatio);

    // If dragged selection width is > 1% of canvas width, set region time window
    if (maxRatio - minRatio > 0.01) {
      const windowStartMs = displayStartMs + minRatio * displayDurationMs;
      const windowEndMs = displayStartMs + maxRatio * displayDurationMs;
      onSelectTimeWindow({ startMs: windowStartMs, endMs: windowEndMs });
      onSeek(windowStartMs);
    } else {
      // Single click seek
      const targetMs = displayStartMs + endRatio * displayDurationMs;
      onSeek(targetMs);
    }

    setDragStartRatio(null);
    setDragEndRatio(null);
  };

  const formattedTimestamp = disabled
    ? 'No data loaded'
    : new Date(currentMs).toISOString().replace('T', ' ').replace('Z', '');
  const relativeSec = disabled ? '—' : `${((currentMs - displayStartMs) / 1000).toFixed(3)}s`;

  return (
    <div className="glass-panel rounded-2xl p-4 shadow-2xl mb-6">
      {/* Region Selection Active Banner */}
      {timeWindow && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cyan-950/80 p-2.5 border border-cyan-700/60 text-xs shadow-md">
          <div className="flex items-center gap-2">
            <Maximize2 className="h-4 w-4 text-cyan-400" />
            <span className="font-bold text-cyan-300 uppercase tracking-wider">Region Window Selected:</span>
            <span className="font-mono font-semibold text-white">
              {new Date(timeWindow.startMs).toISOString().split('T')[1].replace('Z', '')} to {new Date(timeWindow.endMs).toISOString().split('T')[1].replace('Z', '')}
            </span>
            <span className="font-mono text-cyan-400">
              ({((timeWindow.endMs - timeWindow.startMs) / 1000).toFixed(2)}s duration)
            </span>
          </div>
          <button
            onClick={() => onSelectTimeWindow(null)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-cyan-900 hover:bg-cyan-800 text-cyan-200 hover:text-white border border-cyan-700 transition-colors font-medium"
          >
            <X className="h-3.5 w-3.5" />
            <span>Reset Timeline Region</span>
          </button>
        </div>
      )}

      {/* Header bar above timeline */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 border border-slate-800 font-mono text-xs">
            <Clock className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-slate-400">Pointer Time:</span>
            <span className="font-semibold text-slate-100">{formattedTimestamp}</span>
            <span className="text-cyan-400 font-medium">({relativeSec})</span>
          </div>

          {focusedDevice ? (
            <div className="flex items-center gap-1.5 text-xs text-cyan-300 bg-cyan-950/80 px-2.5 py-1 rounded-lg border border-cyan-800 font-mono">
              <Target className="h-3.5 w-3.5 text-cyan-400" />
              <span>Target Device: Addr {focusedDevice.address} ({focusedDevice.modelId || 'Device'})</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-cyan-500"></span> Total Bus Traffic
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-500 ml-2"></span> Address Claims
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500 ml-2"></span> Anomalies
            </div>
          )}
        </div>

        {/* Anomaly navigation buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevAnomaly}
            disabled={disabled || anomalies.length === 0}
            className="flex items-center gap-1 rounded-lg bg-amber-950/60 px-2.5 py-1 text-xs font-medium text-amber-300 border border-amber-800/60 hover:bg-amber-900/80 transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-amber-950/60"
          >
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span>Prev Issue</span>
          </button>
          <button
            onClick={onNextAnomaly}
            disabled={disabled || anomalies.length === 0}
            className="flex items-center gap-1 rounded-lg bg-amber-950/60 px-2.5 py-1 text-xs font-medium text-amber-300 border border-amber-800/60 hover:bg-amber-900/80 transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-amber-950/60"
          >
            <span>Next Issue</span>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
          </button>
        </div>
      </div>

      {/* Visual Timeline Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-950 cursor-crosshair group">
        <canvas
          ref={canvasRef}
          width={1000}
          height={80}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`w-full h-20 block select-none ${disabled ? 'cursor-default' : 'cursor-crosshair'}`}
        />
        <div className="absolute bottom-1 right-2 pointer-events-none text-[10px] text-slate-500 font-mono">
          Click or Drag across timeline to select region window
        </div>
      </div>

      {/* Control buttons & speed toggles */}
      <div className="flex flex-wrap items-center justify-between gap-4 mt-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onSeek(displayStartMs)}
            disabled={disabled}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            title="Jump to Start of Window"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={() => onSeek(Math.max(displayStartMs, currentMs - 1000))}
            disabled={disabled}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            title="-1s"
          >
            <SkipBack className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              if (!isPlaying && currentMs >= displayEndMs) {
                onSeek(displayStartMs);
              }
              setIsPlaying(!isPlaying);
            }}
            disabled={disabled}
            className="flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-1.5 text-xs font-semibold text-white shadow-lg shadow-cyan-600/30 hover:bg-cyan-500 active:scale-95 transition-all disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500 disabled:shadow-none"
          >
            {isPlaying ? <Pause className="h-4 w-4 fill-white" /> : <Play className="h-4 w-4 fill-white ml-0.5" />}
            <span>{isPlaying ? 'Pause' : 'Play Timeline'}</span>
          </button>
          <button
            onClick={() => onSeek(Math.min(displayEndMs, currentMs + 1000))}
            disabled={disabled}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
            title="+1s"
          >
            <SkipForward className="h-4 w-4" />
          </button>
        </div>

        {/* Speed multiplier selector */}
        <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1 border border-slate-800 text-xs">
          <span className="text-slate-400 px-2 font-medium">Speed:</span>
          {[1, 2, 5, 10].map((spd) => (
            <button
              key={spd}
              onClick={() => setPlaySpeed(spd)}
              disabled={disabled}
              className={`px-2 py-0.5 rounded font-mono font-medium transition-colors ${
                playSpeed === spd ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {spd}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

