import React, { useState } from 'react';
import { Navbar } from './components/Navbar';
import { TimelineControls } from './components/TimelineControls';
import { ToolbarSettings } from './components/ToolbarSettings';
import { DeviceMatrix } from './components/DeviceMatrix';
import { AnomalyDashboard } from './components/AnomalyDashboard';
import { PacketInspector } from './components/PacketInspector';
import { parseLogContent } from './services/logParser';
import { runBusAnalysis, AnalysisResult } from './services/analysisEngine';
import { saveDataset } from './services/storage';
import { CanPacket, DeviceFocusTarget, N2kDevice } from './types/n2k';
import { Activity, Cpu, AlertTriangle, Layers, Sparkles, Upload } from 'lucide-react';

export const App: React.FC = () => {
  const [selectedFileName, setSelectedFileName] = useState<string>('');
  const [rawLogText, setRawLogText] = useState<string>('');
  const [parsedPackets, setParsedPackets] = useState<CanPacket[]>([]);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult>(() =>
    runBusAnalysis([], '', 0, 20),
  );
  const [currentMs, setCurrentMs] = useState<number>(0);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<'matrix' | 'anomalies' | 'stream'>('matrix');

  // Device target focus & traffic warning threshold & time window region states
  const [focusedDevice, setFocusedDevice] = useState<DeviceFocusTarget | null>(null);
  const [trafficThresholdPct, setTrafficThresholdPct] = useState<number>(20);
  const [timeWindow, setTimeWindow] = useState<{ startMs: number; endMs: number } | null>(null);

  // Re-run bus analysis when trafficThresholdPct, focusedDevice, or timeWindow changes
  const updateBusAnalysis = (
    allPackets: CanPacket[],
    fileName: string,
    size: number,
    thresholdPct: number,
    focusedAddr?: number,
    window?: { startMs: number; endMs: number } | null
  ) => {
    const activeWindow = window !== undefined ? window : timeWindow;
    const result = runBusAnalysis(allPackets, fileName, size, thresholdPct, focusedAddr, activeWindow);
    setAnalysisResult(result);
    return result;
  };

  const handleFileUpload = async (file: File) => {
    setIsAnalyzing(true);
    setSelectedFileName(file.name);
    setTimeWindow(null);
    try {
      const rawText = await file.text();
      setRawLogText(rawText);

      const packets = parseLogContent(rawText);
      setParsedPackets(packets);

      const result = updateBusAnalysis(packets, file.name, file.size, trafficThresholdPct, focusedDevice?.address, null);
      if (result.packets.length > 0) {
        setCurrentMs(result.packets[0].timestampMs);
      }

      await saveDataset(`user_${Date.now()}`, file.name, file.size, rawText, result);
    } catch (err) {
      console.error('Error parsing uploaded file:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle traffic threshold percentage change
  const handleChangeTrafficThresholdPct = (newPct: number) => {
    setTrafficThresholdPct(newPct);
    if (parsedPackets.length > 0) {
      updateBusAnalysis(parsedPackets, selectedFileName, rawLogText.length, newPct, focusedDevice?.address, timeWindow);
    }
  };

  // Handle region time window selection
  const handleSelectTimeWindow = (newWindow: { startMs: number; endMs: number } | null) => {
    setTimeWindow(newWindow);
    if (parsedPackets.length > 0) {
      updateBusAnalysis(parsedPackets, selectedFileName, rawLogText.length, trafficThresholdPct, focusedDevice?.address, newWindow);
    }
  };

  // Compute active devices at current timeline pointer
  const getActiveDevicesAtPointer = () => {
    if (!analysisResult || analysisResult.deviceHistory.length === 0) return {};
    let matchedIndex = 0;
    for (let i = 0; i < analysisResult.deviceHistory.length; i++) {
      if (analysisResult.deviceHistory[i].timestampMs <= currentMs) {
        matchedIndex = i;
      } else {
        break;
      }
    }
    return analysisResult.deviceHistory[matchedIndex]?.devices || {};
  };

  const activeDevices = getActiveDevicesAtPointer();

  // Single device target focus handlers
  const handleFocusDevice = (dev: N2kDevice) => {
    const prod = dev.productInfo;
    const name = dev.claimedName;
    const modelVersion = prod?.modelVersion || '';
    const serialCode = prod?.serialCode || '';
    const modelId = prod?.modelId || name?.manufacturerName || 'Device';

    const target: DeviceFocusTarget = {
      key: `addr_${dev.address}`,
      address: dev.address,
      modelVersion,
      serialCode,
      modelId,
      label: `${modelId} [Ver: ${modelVersion || 'N/A'}, SN: ${serialCode || 'N/A'}] (Addr ${dev.address})`,
    };

    setFocusedDevice(target);
    if (parsedPackets.length > 0) {
      updateBusAnalysis(parsedPackets, selectedFileName, rawLogText.length, trafficThresholdPct, dev.address, timeWindow);
    }
  };

  const handleSelectFocusDeviceKey = (key: string) => {
    if (!key) {
      handleClearFocus();
      return;
    }
    const addr = parseInt(key.replace('addr_', ''), 10);
    const dev = activeDevices[addr];
    if (dev) {
      handleFocusDevice(dev);
    }
  };

  const handleClearFocus = () => {
    setFocusedDevice(null);
    if (parsedPackets.length > 0) {
      updateBusAnalysis(parsedPackets, selectedFileName, rawLogText.length, trafficThresholdPct, undefined, timeWindow);
    }
  };

  const handleNextAnomaly = () => {
    if (!analysisResult || analysisResult.anomalies.length === 0) return;
    const next = analysisResult.anomalies.find((a) => a.timestampMs > currentMs + 50);
    if (next) {
      setCurrentMs(next.timestampMs);
    } else {
      setCurrentMs(analysisResult.anomalies[0].timestampMs);
    }
  };

  const handlePrevAnomaly = () => {
    if (!analysisResult || analysisResult.anomalies.length === 0) return;
    const rev = [...analysisResult.anomalies].reverse();
    const prev = rev.find((a) => a.timestampMs < currentMs - 50);
    if (prev) {
      setCurrentMs(prev.timestampMs);
    } else {
      setCurrentMs(rev[0].timestampMs);
    }
  };

  // Full dataset start and end timestamps
  const fullStartMs = parsedPackets[0]?.timestampMs || 0;
  const fullEndMs = parsedPackets[parsedPackets.length - 1]?.timestampMs || 1000;
  const hasData = parsedPackets.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      <Navbar
        summary={hasData ? analysisResult.summary : null}
        onFileUpload={handleFileUpload}
        isAnalyzing={isAnalyzing}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Loading Spinner State */}
        {isAnalyzing && (
          <div className="glass-panel rounded-2xl p-12 text-center shadow-2xl animate-pulse">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-600/20 text-cyan-400 mb-4 ring-1 ring-cyan-500/30">
              <Activity className="h-6 w-6 animate-spin" />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-1">Analyzing NMEA 2000 Log...</h3>
            <p className="text-xs text-slate-400">Parsing ISO Address Claims, FastPackets, and bus health events</p>
          </div>
        )}

        {!isAnalyzing && (
          <>
            {!hasData && (
              <section className="glass-panel rounded-2xl border border-cyan-900/50 p-6 text-center shadow-2xl">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-950/80 text-cyan-400 ring-1 ring-cyan-800/70">
                  <Upload className="h-6 w-6" />
                </div>
                <h2 className="text-lg font-bold text-slate-100">No CAN log loaded</h2>
                <p className="mx-auto mt-1 max-w-2xl text-sm text-slate-400">
                  Use <span className="font-semibold text-cyan-300">Open Log File</span> above to analyze a
                  candump, CSV, or text capture. The analyzer controls remain visible below and will populate
                  when packet data is loaded.
                </p>
              </section>
            )}

            {/* Interactive Timeline Scrubber Bar with Drag-to-Select Region Window */}
            <TimelineControls
              buckets={analysisResult.buckets}
              anomalies={analysisResult.anomalies}
              startMs={fullStartMs}
              endMs={fullEndMs}
              currentMs={currentMs}
              focusedDevice={focusedDevice}
              timeWindow={timeWindow}
              onSeek={setCurrentMs}
              onSelectTimeWindow={handleSelectTimeWindow}
              onNextAnomaly={handleNextAnomaly}
              onPrevAnomaly={handlePrevAnomaly}
              disabled={!hasData}
            />

            {/* Single Device Focus & Bus Rate Warning Threshold Bar */}
            <ToolbarSettings
              devices={activeDevices}
              focusedDevice={focusedDevice}
              trafficThresholdPct={trafficThresholdPct}
              onSelectFocusDeviceKey={handleSelectFocusDeviceKey}
              onClearFocus={handleClearFocus}
              onChangeTrafficThresholdPct={handleChangeTrafficThresholdPct}
            />

            {/* View Switcher Tabs */}
            <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
                <button
                  onClick={() => setActiveView('matrix')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeView === 'matrix'
                      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Cpu className="h-4 w-4" />
                  <span>Device Matrix ({Object.keys(activeDevices).length})</span>
                </button>
                <button
                  onClick={() => setActiveView('anomalies')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeView === 'anomalies'
                      ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <AlertTriangle className="h-4 w-4" />
                  <span>Health Anomalies ({analysisResult.anomalies.length})</span>
                </button>
                <button
                  onClick={() => setActiveView('stream')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeView === 'stream'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  <span>Packet Stream</span>
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-400">
                <Sparkles className="h-4 w-4 text-cyan-400" />
                <span>Move timeline scrubber above to inspect bus state changes</span>
              </div>
            </div>

            {/* Active View Display */}
            {activeView === 'matrix' && (
              <DeviceMatrix
                devices={activeDevices}
                currentMs={currentMs}
                focusedDevice={focusedDevice}
                onFocusDevice={handleFocusDevice}
                onClearFocus={handleClearFocus}
              />
            )}
            {activeView === 'anomalies' && (
              <AnomalyDashboard
                anomalies={analysisResult.anomalies}
                focusedDevice={focusedDevice}
                onSeekToTimestamp={(ts) => {
                  setCurrentMs(ts);
                  setActiveView('matrix');
                }}
              />
            )}
            {activeView === 'stream' && (
              <PacketInspector
                packets={analysisResult.packets}
                currentMs={currentMs}
                focusedDevice={focusedDevice}
                onSelectPacket={(pkt) => setCurrentMs(pkt.timestampMs)}
              />
            )}
          </>
        )}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        CanAnalysis NMEA 2000 Analyzer • ISO 11783 Address Claim & Management Diagnostics
      </footer>
    </div>
  );
};

export default App;
