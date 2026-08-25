import React, { useState } from 'react';
import { Terminal, Search, Filter, Hash, Eye, Target, List } from 'lucide-react';
import { CanPacket, DeviceFocusTarget } from '../types/n2k';
import { getPgnDescription } from '../services/n2kDatabase';

interface PacketInspectorProps {
  packets: CanPacket[];
  currentMs: number;
  focusedDevice: DeviceFocusTarget | null;
  onSelectPacket: (packet: CanPacket) => void;
}

export const PacketInspector: React.FC<PacketInspectorProps> = ({
  packets,
  currentMs,
  focusedDevice,
  onSelectPacket,
}) => {
  const [filterPgn, setFilterPgn] = useState<string>('');
  const [filterAddress, setFilterAddress] = useState<string>('');
  const [healthOnly, setHealthOnly] = useState<boolean>(false);
  const [focusOnly, setFocusOnly] = useState<boolean>(false);
  const [showAllPackets, setShowAllPackets] = useState<boolean>(false);
  const [selectedPkt, setSelectedPkt] = useState<CanPacket | null>(null);

  // Find index closest to currentMs
  let nearestIdx = packets.findIndex((p) => p.timestampMs >= currentMs);
  if (nearestIdx === -1) nearestIdx = packets.length - 1;

  // Take window around pointer (100 packets)
  const windowStart = Math.max(0, nearestIdx - 50);
  const windowEnd = Math.min(packets.length, nearestIdx + 50);
  const packetWindow = packets.slice(windowStart, windowEnd);

  const activeSourcePackets = showAllPackets ? packets : packetWindow;

  const filteredPackets = activeSourcePackets.filter((pkt) => {
    if (focusOnly && focusedDevice) {
      if (pkt.src !== focusedDevice.address && pkt.dst !== focusedDevice.address) return false;
    }
    if (filterPgn && !pkt.pgn.toString().includes(filterPgn)) return false;
    if (filterAddress && pkt.src.toString() !== filterAddress && pkt.dst.toString() !== filterAddress) return false;
    if (healthOnly) {
      const desc = getPgnDescription(pkt.pgn);
      if (!desc.isHealthRelated) return false;
    }
    return true;
  });

  return (
    <div className="glass-panel rounded-2xl p-5 shadow-2xl mb-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-cyan-400">
            <Terminal className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-100">
              {showAllPackets ? 'All CAN Packets Stream' : 'Live CAN Packet Stream'}
            </h2>
            <p className="text-xs text-slate-400">
              {showAllPackets
                ? `Showing all ${filteredPackets.length} of ${packets.length} packets in active window`
                : `Showing ${filteredPackets.length} packets centered around timeline pointer`}
            </p>
          </div>
        </div>

        {/* Filter & Toggle Inputs */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowAllPackets(!showAllPackets)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showAllPackets
                ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:border-slate-700'
            }`}
            title={showAllPackets ? 'Switch to live stream around pointer' : 'Show all packets in region window'}
          >
            <List className="h-3.5 w-3.5" />
            <span>{showAllPackets ? 'Live Pointer View' : `Show All Packets (${packets.length})`}</span>
          </button>

          {focusedDevice && (
            <button
              onClick={() => setFocusOnly(!focusOnly)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                focusOnly
                  ? 'bg-cyan-600 text-white border-cyan-400 shadow-sm'
                  : 'bg-slate-900 text-cyan-400 border-slate-800 hover:text-white'
              }`}
            >
              <Target className="h-3.5 w-3.5" />
              <span>Addr {focusedDevice.address} Only</span>
            </button>
          )}
          <button
            onClick={() => setHealthOnly(!healthOnly)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              healthOnly
                ? 'bg-cyan-600 text-white border-cyan-500'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Health PGNs Only
          </button>
          <input
            type="text"
            placeholder="Filter PGN..."
            value={filterPgn}
            onChange={(e) => setFilterPgn(e.target.value)}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-slate-200 border border-slate-800 focus:outline-none focus:border-cyan-500 w-28"
          />
          <input
            type="text"
            placeholder="Addr..."
            value={filterAddress}
            onChange={(e) => setFilterAddress(e.target.value)}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-slate-200 border border-slate-800 focus:outline-none focus:border-cyan-500 w-20"
          />
        </div>
      </div>

      {/* Packet Table */}
      <div className="overflow-x-auto max-h-80 rounded-xl border border-slate-800 bg-slate-950/80">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-900 text-slate-400 uppercase text-[10px] tracking-wider sticky top-0 border-b border-slate-800">
            <tr>
              <th className="py-2.5 px-3">#</th>
              <th className="py-2.5 px-3">Timestamp</th>
              <th className="py-2.5 px-3">Pri</th>
              <th className="py-2.5 px-3">PGN</th>
              <th className="py-2.5 px-3">Description</th>
              <th className="py-2.5 px-3">Src</th>
              <th className="py-2.5 px-3">Dst</th>
              <th className="py-2.5 px-3">Payload Hex</th>
              <th className="py-2.5 px-3 text-right">Inspect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900 text-slate-300">
            {filteredPackets.map((pkt) => {
              const desc = getPgnDescription(pkt.pgn);
              const isPointerMatch = Math.abs(pkt.timestampMs - currentMs) < 100;
              const isSelected = selectedPkt?.id === pkt.id;
              const isFocusedPkt = focusedDevice && (pkt.src === focusedDevice.address || pkt.dst === focusedDevice.address);

              return (
                <tr
                  key={pkt.id}
                  onClick={() => {
                    setSelectedPkt(isSelected ? null : pkt);
                    onSelectPacket(pkt);
                  }}
                  className={`cursor-pointer transition-colors hover:bg-slate-900/80 ${
                    isSelected
                      ? 'bg-cyan-950/60 text-cyan-200'
                      : isFocusedPkt
                      ? 'bg-cyan-950/30'
                      : isPointerMatch
                      ? 'bg-slate-800/60'
                      : ''
                  }`}
                >
                  <td className="py-2 px-3 text-slate-500">{pkt.id}</td>
                  <td className="py-2 px-3 text-slate-400">{pkt.timestamp}</td>
                  <td className="py-2 px-3 text-slate-400">{pkt.priority}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`font-semibold px-1.5 py-0.5 rounded text-[11px] ${
                        desc.isHealthRelated ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'text-slate-200'
                      }`}
                    >
                      {pkt.pgn}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-300 truncate max-w-[200px]">{desc.name}</td>
                  <td className={`py-2 px-3 font-semibold ${pkt.src === focusedDevice?.address ? 'text-cyan-300 font-bold' : 'text-cyan-400'}`}>
                    {pkt.src}
                  </td>
                  <td className="py-2 px-3 text-slate-400">{pkt.dst === 255 ? 'Broadcast' : pkt.dst}</td>
                  <td className="py-2 px-3 text-slate-400 truncate max-w-[260px]">
                    {pkt.bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}
                  </td>
                  <td className="py-2 px-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPkt(isSelected ? null : pkt);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-cyan-400"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Drawer for Selected Packet */}
      {selectedPkt && (
        <div className="mt-4 p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="font-bold text-cyan-400">Packet #{selectedPkt.id} Details</span>
            <span className="text-slate-400">{selectedPkt.timestamp}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800">
            <div><span className="text-slate-400 block text-[10px]">PGN</span><span className="text-cyan-400 font-bold">{selectedPkt.pgn} ({getPgnDescription(selectedPkt.pgn).name})</span></div>
            <div><span className="text-slate-400 block text-[10px]">Priority</span><span className="text-slate-200 font-bold">{selectedPkt.priority}</span></div>
            <div><span className="text-slate-400 block text-[10px]">Source Address</span><span className="text-emerald-400 font-bold">{selectedPkt.src}</span></div>
            <div><span className="text-slate-400 block text-[10px]">Destination Address</span><span className="text-slate-200 font-bold">{selectedPkt.dst}</span></div>
          </div>

          <div>
            <span className="text-slate-400 block mb-1 text-[10px] uppercase">Raw Log Line</span>
            <div className="p-2.5 rounded bg-slate-950 text-slate-300 border border-slate-800 select-all overflow-x-auto">
              {selectedPkt.rawLine}
            </div>
          </div>

          <div>
            <span className="text-slate-400 block mb-1 text-[10px] uppercase">Hex Bytes ({selectedPkt.len} bytes)</span>
            <div className="p-2.5 rounded bg-slate-950 text-amber-300 font-bold tracking-widest border border-slate-800 select-all overflow-x-auto">
              {selectedPkt.bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
