import React, { useState } from 'react';
import { Cpu, ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, Radio, HelpCircle, FileText, Info, Target, X } from 'lucide-react';
import { N2kDevice, DeviceFocusTarget } from '../types/n2k';
import { getPgnDescription } from '../services/n2kDatabase';

interface DeviceMatrixProps {
  devices: Record<number, N2kDevice>;
  currentMs: number;
  focusedDevice: DeviceFocusTarget | null;
  onFocusDevice: (dev: N2kDevice) => void;
  onClearFocus: () => void;
}

export const DeviceMatrix: React.FC<DeviceMatrixProps> = ({
  devices,
  currentMs,
  focusedDevice,
  onFocusDevice,
  onClearFocus,
}) => {
  const [expandedAddr, setExpandedAddr] = useState<number | null>(null);
  const [filterText, setFilterText] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'all' | 'claimed' | 'issues' | 'focused'>('all');

  const deviceList = Object.values(devices).sort((a, b) => a.address - b.address);

  const filteredDevices = deviceList.filter((dev) => {
    if (activeTab === 'focused' && focusedDevice && dev.address !== focusedDevice.address) return false;
    if (activeTab === 'claimed' && dev.claimStatus !== 'claimed') return false;
    if (activeTab === 'issues' && dev.claimStatus === 'claimed' && (!dev.heartbeat || dev.heartbeat.status === 0)) return false;

    if (!filterText) return true;
    const query = filterText.toLowerCase();
    const mfg = dev.claimedName?.manufacturerName?.toLowerCase() || '';
    const func = dev.claimedName?.functionName?.toLowerCase() || '';
    const cls = dev.claimedName?.className?.toLowerCase() || '';
    const model = dev.productInfo?.modelId?.toLowerCase() || '';
    const ver = dev.productInfo?.modelVersion?.toLowerCase() || '';
    const serial = dev.productInfo?.serialCode?.toLowerCase() || '';
    const addr = dev.address.toString();

    return mfg.includes(query) || func.includes(query) || cls.includes(query) || model.includes(query) || ver.includes(query) || serial.includes(query) || addr.includes(query);
  });

  return (
    <div className="glass-panel rounded-2xl p-5 shadow-2xl mb-6">
      {/* Target Focus Banner if focused */}
      {focusedDevice && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-cyan-950/80 p-3.5 border border-cyan-700/60 shadow-lg shadow-cyan-950/40">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-600 text-white shadow">
              <Target className="h-4 w-4 animate-spin" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Single Device Target Focus Active</span>
                <span className="font-mono text-xs text-white px-2 py-0.5 rounded bg-cyan-900 border border-cyan-700">
                  Addr {focusedDevice.address}
                </span>
              </div>
              <p className="text-xs text-slate-200 font-mono mt-0.5">
                Model: <span className="font-semibold text-cyan-200">{focusedDevice.modelId || 'N/A'}</span> • Model Ver: <span className="font-semibold text-emerald-300">{focusedDevice.modelVersion || 'N/A'}</span> • Serial: <span className="font-semibold text-amber-300">{focusedDevice.serialCode || 'N/A'}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClearFocus}
            className="flex items-center gap-1.5 rounded-lg bg-cyan-900/80 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-800 hover:text-white border border-cyan-700 transition-all active:scale-95"
          >
            <X className="h-3.5 w-3.5" />
            <span>Clear Focus</span>
          </button>
        </div>
      )}

      {/* Matrix Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-emerald-400">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">Bus Devices at Pointer</h2>
            <p className="text-xs text-slate-400">
              Showing {filteredDevices.length} of {deviceList.length} active CAN devices
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tab Filter */}
          <div className="flex items-center gap-1 bg-slate-900 rounded-lg p-1 border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                activeTab === 'all' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({deviceList.length})
            </button>
            {focusedDevice && (
              <button
                onClick={() => setActiveTab('focused')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  activeTab === 'focused' ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Target Device
              </button>
            )}
            <button
              onClick={() => setActiveTab('claimed')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                activeTab === 'claimed' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Claimed ({deviceList.filter((d) => d.claimStatus === 'claimed').length})
            </button>
            <button
              onClick={() => setActiveTab('issues')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                activeTab === 'issues' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Issues ({deviceList.filter((d) => d.claimStatus !== 'claimed' || (d.heartbeat && d.heartbeat.status !== 0)).length})
            </button>
          </div>

          {/* Search box */}
          <input
            type="text"
            placeholder="Search Model Ver, Serial, Address..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-slate-200 border border-slate-800 focus:outline-none focus:border-cyan-500 w-48 sm:w-64"
          />
        </div>
      </div>

      {/* Device Cards Grid */}
      {filteredDevices.length === 0 ? (
        <div className="p-8 text-center text-slate-400 text-xs bg-slate-950/40 rounded-xl border border-slate-800/60">
          No devices match the current filter criteria at this timestamp.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDevices.map((dev) => {
            const isExpanded = expandedAddr === dev.address;
            const isFocused = focusedDevice?.address === dev.address;
            const name = dev.claimedName;
            const prod = dev.productInfo;
            const hb = dev.heartbeat;

            return (
              <div
                key={dev.address}
                className={`rounded-xl border transition-all relative ${
                  isFocused
                    ? 'bg-cyan-950/40 border-cyan-400/80 ring-2 ring-cyan-400/50 shadow-xl shadow-cyan-950/50'
                    : dev.claimStatus === 'conflict'
                    ? 'bg-rose-950/20 border-rose-800/50 shadow-rose-950/30'
                    : dev.claimStatus === 'claimed'
                    ? 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    : 'bg-amber-950/10 border-amber-800/40'
                }`}
              >
                {/* Main Card Summary */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex items-center justify-center font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-slate-950 text-cyan-400 border border-slate-800 shadow-inner">
                        Addr {dev.address}
                      </span>
                      {dev.claimStatus === 'claimed' ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                          <ShieldCheck className="h-3 w-3" /> Claimed
                        </span>
                      ) : dev.claimStatus === 'conflict' ? (
                        <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-400 border border-rose-800/60">
                          <ShieldAlert className="h-3 w-3" /> Conflict
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-950/80 text-amber-400 border border-amber-800/60">
                          <HelpCircle className="h-3 w-3" /> Unclaimed
                        </span>
                      )}
                      {prod && prod.modelVersion && (
                        <span className="flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-800/60" title={`Model Version: ${prod.modelVersion}`}>
                          v{prod.modelVersion}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => (isFocused ? onClearFocus() : onFocusDevice(dev))}
                        className={`p-1.5 rounded-lg border transition-all ${
                          isFocused
                            ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-cyan-300 hover:border-slate-700'
                        }`}
                        title={isFocused ? 'Clear Target Focus' : 'Focus on this Device (Model Ver & Serial)'}
                      >
                        <Target className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setExpandedAddr(isExpanded ? null : dev.address)}
                        className="p-1.5 rounded-lg bg-slate-950 text-slate-400 border border-slate-800 hover:bg-slate-800 hover:text-white transition-colors"
                        title="Toggle Details"
                      >
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Device Title & Description */}
                  <h3 className="text-sm font-bold text-slate-100 tracking-tight">
                    {name ? name.manufacturerName : 'Unknown Manufacturer'}
                  </h3>
                  <p className="text-xs text-slate-400 mb-3">
                    {name ? `${name.className} • ${name.functionName}` : 'Unassigned ISO Name'}
                  </p>

                  {/* Highlights Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/60">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-sans">Packets Seen</span>
                      <span className="text-slate-200 font-semibold">{dev.packetCount.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-sans">Model ID</span>
                      <span className="text-cyan-400 font-semibold truncate block">
                        {prod ? prod.modelId || 'N/A' : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-sans">Model Version</span>
                      <span className="text-emerald-400 font-semibold truncate block">
                        {prod ? prod.modelVersion || 'N/A' : 'N/A'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase tracking-wider font-sans">Serial Number</span>
                      <span className="text-amber-300 font-semibold truncate block">
                        {prod ? prod.serialCode || 'N/A' : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Expanded Details Drawer */}
                {isExpanded && (
                  <div className="border-t border-slate-800 bg-slate-950/90 p-4 text-xs space-y-4 rounded-b-xl">
                    {/* 64-bit NAME Field Breakdown */}
                    {name && (
                      <div className="space-y-1.5">
                        <h4 className="font-semibold text-cyan-400 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                          <Info className="h-3.5 w-3.5" /> 64-Bit ISO Address Claim NAME
                        </h4>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-slate-900/90 p-3 rounded-lg border border-slate-800 font-mono text-[11px]">
                          <div><span className="text-slate-400">HEX Payload:</span> <span className="text-amber-300 font-bold">{name.rawHex}</span></div>
                          <div><span className="text-slate-400">Unique Number:</span> <span className="text-slate-200">{name.uniqueNumber}</span></div>
                          <div><span className="text-slate-400">Manufacturer Code:</span> <span className="text-slate-200">{name.manufacturerCode}</span></div>
                          <div><span className="text-slate-400">Device Instance:</span> <span className="text-slate-200">{name.deviceInstance}</span></div>
                          <div><span className="text-slate-400">Device Class:</span> <span className="text-slate-200">{name.deviceClass} ({name.className})</span></div>
                          <div><span className="text-slate-400">Device Function:</span> <span className="text-slate-200">{name.deviceFunction} ({name.functionName})</span></div>
                          <div><span className="text-slate-400">Industry Group:</span> <span className="text-slate-200">{name.industryGroup} ({name.industryGroupName})</span></div>
                          <div><span className="text-slate-400">Arbitrary Addr:</span> <span className="text-slate-200">{name.arbitraryAddressCapable ? 'Yes' : 'No'}</span></div>
                        </div>
                      </div>
                    )}

                    {/* Product Information */}
                    {prod && (
                      <div className="space-y-1.5">
                        <h4 className="font-semibold text-cyan-400 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                          <FileText className="h-3.5 w-3.5" /> Product Information (PGN 126996)
                        </h4>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 bg-slate-900/90 p-3 rounded-lg border border-slate-800 font-mono text-[11px]">
                          <div><span className="text-slate-400">Model ID:</span> <span className="text-emerald-400">{prod.modelId}</span></div>
                          <div><span className="text-slate-400">Software Version:</span> <span className="text-slate-200">{prod.softwareVersion}</span></div>
                          <div><span className="text-slate-400">Model Version:</span> <span className="text-emerald-300 font-semibold">{prod.modelVersion}</span></div>
                          <div><span className="text-slate-400">Serial Code:</span> <span className="text-amber-300 font-semibold">{prod.serialCode}</span></div>
                          <div><span className="text-slate-400">Product Code:</span> <span className="text-slate-200">{prod.productCode}</span></div>
                          <div><span className="text-slate-400">N2K Version:</span> <span className="text-slate-200">{prod.n2kVersion}</span></div>
                        </div>
                      </div>
                    )}

                    {/* Transmitted PGN List */}
                    <div className="space-y-1.5">
                      <h4 className="font-semibold text-cyan-400 flex items-center gap-1 text-[11px] uppercase tracking-wider">
                        <Radio className="h-3.5 w-3.5" /> Transmitted PGNs ({dev.txPgnsSeen.length})
                      </h4>
                      <div className="flex flex-wrap gap-1.5 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
                        {dev.txPgnsSeen.map((pgn) => {
                          const desc = getPgnDescription(pgn);
                          return (
                            <span
                              key={pgn}
                              className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                                desc.isHealthRelated
                                  ? 'bg-blue-950 text-blue-300 border-blue-800'
                                  : 'bg-slate-800 text-slate-300 border-slate-700'
                              }`}
                              title={`${pgn}: ${desc.name} (${desc.category})`}
                            >
                              {pgn} ({desc.name})
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
