import React from 'react';
import { Target, AlertTriangle, Gauge, X, Filter } from 'lucide-react';
import { N2kDevice, DeviceFocusTarget } from '../types/n2k';
import { MAX_CAN_BUS_RATE_PKTS_PER_SEC } from '../services/analysisEngine';

interface ToolbarSettingsProps {
  devices: Record<number, N2kDevice>;
  focusedDevice: DeviceFocusTarget | null;
  trafficThresholdPct: number;
  onSelectFocusDeviceKey: (key: string) => void;
  onClearFocus: () => void;
  onChangeTrafficThresholdPct: (pct: number) => void;
}

export const ToolbarSettings: React.FC<ToolbarSettingsProps> = ({
  devices,
  focusedDevice,
  trafficThresholdPct,
  onSelectFocusDeviceKey,
  onClearFocus,
  onChangeTrafficThresholdPct,
}) => {
  const deviceList = Object.values(devices).sort((a, b) => a.address - b.address);

  // Generate selectable device targets formatted by Model Version & Serial Number
  const focusTargets = deviceList.map((dev) => {
    const prod = dev.productInfo;
    const name = dev.claimedName;
    const modelVersion = prod?.modelVersion || 'N/A';
    const serialCode = prod?.serialCode || 'N/A';
    const modelId = prod?.modelId || name?.manufacturerName || `Device`;
    const key = `addr_${dev.address}`;

    const label = `${modelId} [Ver: ${modelVersion}, SN: ${serialCode}] (Addr ${dev.address})`;

    return {
      key,
      address: dev.address,
      modelVersion,
      serialCode,
      modelId,
      label,
    };
  });

  const thresholdPktsSec = Math.round(MAX_CAN_BUS_RATE_PKTS_PER_SEC * (trafficThresholdPct / 100));

  return (
    <div className="glass-panel rounded-2xl p-4 shadow-xl mb-6 bg-slate-900/90 border border-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Device Target Focus Selector */}
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="flex items-center gap-2 text-cyan-400 font-semibold text-xs uppercase tracking-wider">
            <Target className="h-4 w-4" />
            <span>Single Device Focus:</span>
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <select
              value={focusedDevice ? `addr_${focusedDevice.address}` : ''}
              onChange={(e) => onSelectFocusDeviceKey(e.target.value)}
              disabled={deviceList.length === 0}
              className="flex-1 rounded-xl bg-slate-950 px-3 py-2 text-xs font-mono text-cyan-200 border border-slate-800 focus:outline-none focus:border-cyan-500 shadow-inner disabled:cursor-not-allowed disabled:text-slate-500"
            >
              <option value="">-- All Devices (No Target Focus) --</option>
              {focusTargets.map((target) => (
                <option key={target.key} value={target.key}>
                  {target.label}
                </option>
              ))}
            </select>

            {focusedDevice && (
              <button
                onClick={onClearFocus}
                className="flex items-center gap-1 rounded-xl bg-rose-950/60 px-3 py-2 text-xs font-medium text-rose-300 border border-rose-800/60 hover:bg-rose-900/80 transition-colors"
                title="Clear device focus"
              >
                <X className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Clear Focus</span>
              </button>
            )}
          </div>
        </div>

        {/* Bus Traffic Warning Threshold Selector (% of Max Bus Rate) */}
        <div className="flex flex-wrap items-center gap-3 border-t sm:border-t-0 sm:border-l border-slate-800 pt-3 sm:pt-0 sm:pl-4">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-xs uppercase tracking-wider">
            <Gauge className="h-4 w-4" />
            <span>Traffic Warning Threshold:</span>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={trafficThresholdPct}
              onChange={(e) => onChangeTrafficThresholdPct(Number(e.target.value))}
              className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-mono text-amber-300 border border-slate-800 focus:outline-none focus:border-amber-500 shadow-inner"
            >
              <option value={5}>5% of Max Bus Rate (125 pkts/s)</option>
              <option value={10}>10% of Max Bus Rate (250 pkts/s)</option>
              <option value={15}>15% of Max Bus Rate (375 pkts/s)</option>
              <option value={20}>20% of Max Bus Rate (500 pkts/s) [Default]</option>
              <option value={30}>30% of Max Bus Rate (750 pkts/s)</option>
              <option value={40}>40% of Max Bus Rate (1000 pkts/s)</option>
              <option value={50}>50% of Max Bus Rate (1250 pkts/s)</option>
              <option value={75}>75% of Max Bus Rate (1875 pkts/s)</option>
              <option value={100}>100% of Max Bus Rate (2500 pkts/s)</option>
            </select>

            <span className="text-[11px] font-mono text-slate-400 hidden lg:inline">
              ({thresholdPktsSec} pkts/s)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
