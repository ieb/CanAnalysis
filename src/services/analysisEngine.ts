import {
  CanPacket,
  N2kDevice,
  BusAnomaly,
  TimelineBucket,
  AnalysisSummary,
  IsoRequestLog,
} from '../types/n2k';
import { FastPacketTracker } from './fastPacket';
import {
  decodeName,
  decodeIsoRequest,
  decodePgnList,
  decodeProductInfo,
  decodeHeartbeat,
} from './n2kDecoder';

export interface AnalysisResult {
  summary: AnalysisSummary;
  packets: CanPacket[];
  buckets: TimelineBucket[];
  anomalies: BusAnomaly[];
  deviceHistory: Array<{ timestampMs: number; devices: Record<number, N2kDevice> }>;
}

export const MAX_CAN_BUS_RATE_PKTS_PER_SEC = 2500; // 250 kbps NMEA 2000 bus theoretical max

export function runBusAnalysis(
  allPackets: CanPacket[],
  fileName: string,
  fileSizeBytes: number,
  trafficThresholdPct: number = 20,
  focusedAddress?: number,
  timeWindow?: { startMs: number; endMs: number } | null
): AnalysisResult {
  if (!allPackets || allPackets.length === 0) {
    return {
      summary: {
        fileName,
        fileSizeBytes,
        totalPackets: 0,
        durationMs: 0,
        startTime: '',
        endTime: '',
        uniqueDevicesCount: 0,
        totalAnomaliesCount: 0,
        pgnCounts: {},
        trafficThresholdPct,
        maxBusRatePktsSec: MAX_CAN_BUS_RATE_PKTS_PER_SEC,
      },
      packets: [],
      buckets: [],
      anomalies: [],
      deviceHistory: [],
    };
  }

  const fullStartMs = allPackets[0].timestampMs;
  const fullEndMs = allPackets[allPackets.length - 1].timestampMs;

  const winStartMs = timeWindow ? timeWindow.startMs : fullStartMs;
  const winEndMs = timeWindow ? timeWindow.endMs : fullEndMs;
  const winDurationMs = Math.max(1, winEndMs - winStartMs);

  const startTime = new Date(winStartMs).toISOString().replace('T', ' ').replace('Z', '');
  const endTime = new Date(winEndMs).toISOString().replace('T', ' ').replace('Z', '');

  const pgnCounts: Record<number, number> = {};
  const allAnomalies: BusAnomaly[] = [];
  const windowPackets: CanPacket[] = [];
  const fastPacketTracker = new FastPacketTracker();

  // Current active devices map (address 0..255)
  const currentDevices: Record<number, N2kDevice> = {};

  // Track ISO requests pending response: key = `${src}_${dst}_${requestedPgn}`
  const pendingRequests: Map<string, IsoRequestLog> = new Map();

  // Timeline buckets (100 buckets spanning winStartMs to winEndMs)
  const BUCKET_COUNT = 100;
  const bucketDurationMs = winDurationMs / BUCKET_COUNT;
  const buckets: TimelineBucket[] = Array.from({ length: BUCKET_COUNT }, (_, i) => {
    const bucketStartMs = winStartMs + i * bucketDurationMs;
    return {
      timestampMs: bucketStartMs,
      timestamp: new Date(bucketStartMs).toISOString().replace('T', ' ').replace('Z', ''),
      packetCount: 0,
      packetRate: 0,
      anomalyCount: 0,
      hasAddressClaim: false,
      hasIsoRequest: false,
    };
  });

  const deviceHistory: Array<{ timestampMs: number; devices: Record<number, N2kDevice> }> = [];

  // Track claim counts per address to detect claiming loops
  const addressClaimCounts: Record<number, { count: number; firstMs: number; lastMs: number }> = {};

  // Traffic warning threshold in packets/sec
  const warningRateThreshold = Math.round(MAX_CAN_BUS_RATE_PKTS_PER_SEC * (trafficThresholdPct / 100));

  // Track recent traffic for spike detection
  let lastSecondBucket = Math.floor(winStartMs / 1000);
  let packetsInCurrentSecond = 0;
  let focusedPacketsInCurrentSecond = 0;

  // Helper to clone snapshot of current devices
  const makeDevicesSnapshot = () => {
    const snapshotDevices: Record<number, N2kDevice> = {};
    for (const [addrStr, dev] of Object.entries(currentDevices)) {
      const addr = parseInt(addrStr, 10);
      snapshotDevices[addr] = {
        ...dev,
        txPgnsSeen: [...dev.txPgnsSeen],
        isoRequestsSent: [...dev.isoRequestsSent],
        isoRequestsReceived: [...dev.isoRequestsReceived],
      };
    }
    return snapshotDevices;
  };

  let hasPushedInitialWindowSnapshot = false;

  for (let i = 0; i < allPackets.length; i++) {
    const pkt = allPackets[i];

    // Stop processing packets beyond window end
    if (pkt.timestampMs > winEndMs) {
      break;
    }

    const inWindow = pkt.timestampMs >= winStartMs && pkt.timestampMs <= winEndMs;

    // Push initial snapshot at or right before start of window if not pushed yet
    if (!hasPushedInitialWindowSnapshot && pkt.timestampMs >= winStartMs) {
      deviceHistory.push({
        timestampMs: winStartMs,
        devices: makeDevicesSnapshot(),
      });
      hasPushedInitialWindowSnapshot = true;
    }

    if (inWindow) {
      windowPackets.push(pkt);
      pgnCounts[pkt.pgn] = (pgnCounts[pkt.pgn] || 0) + 1;
    }

    const isRelatedToFocus = focusedAddress === undefined || pkt.src === focusedAddress || pkt.dst === focusedAddress;

    // Timeline bucket assignment for window
    let bucketIdx = -1;
    if (inWindow) {
      bucketIdx = Math.floor((pkt.timestampMs - winStartMs) / bucketDurationMs);
      if (bucketIdx < 0) bucketIdx = 0;
      if (bucketIdx >= BUCKET_COUNT) bucketIdx = BUCKET_COUNT - 1;

      if (isRelatedToFocus) {
        buckets[bucketIdx].packetCount++;
      }
    }

    // Traffic rate spike detection (only inside window)
    if (inWindow) {
      const secBucket = Math.floor(pkt.timestampMs / 1000);
      if (secBucket === lastSecondBucket) {
        packetsInCurrentSecond++;
        if (isRelatedToFocus) focusedPacketsInCurrentSecond++;
      } else {
        const checkRate = focusedAddress !== undefined ? focusedPacketsInCurrentSecond : packetsInCurrentSecond;
        if (checkRate > warningRateThreshold) {
          allAnomalies.push({
            id: `spike_${pkt.id}`,
            timestamp: pkt.timestamp,
            timestampMs: pkt.timestampMs,
            type: 'traffic_spike',
            severity: 'warning',
            address: focusedAddress !== undefined ? focusedAddress : pkt.src,
            title: 'High Traffic Warning',
            description: `Traffic burst of ${checkRate} pkts/sec exceeds configured warning threshold of ${trafficThresholdPct}% max bus capacity (${warningRateThreshold} pkts/sec)`,
            packetId: pkt.id,
          });
        }
        lastSecondBucket = secBucket;
        packetsInCurrentSecond = 1;
        focusedPacketsInCurrentSecond = isRelatedToFocus ? 1 : 0;
      }
    }

    // Ensure device entry exists in accumulated currentDevices map
    if (!currentDevices[pkt.src]) {
      currentDevices[pkt.src] = {
        address: pkt.src,
        claimStatus: 'unclaimed',
        firstSeenMs: pkt.timestampMs,
        lastSeenMs: pkt.timestampMs,
        packetCount: 0,
        txPgnsSeen: [],
        isoRequestsSent: [],
        isoRequestsReceived: [],
      };
    }

    const device = currentDevices[pkt.src];
    device.lastSeenMs = pkt.timestampMs;
    device.packetCount++;
    if (!device.txPgnsSeen.includes(pkt.pgn)) {
      device.txPgnsSeen.push(pkt.pgn);
    }

    // Process FastPackets vs Single Packets
    const isFast = pkt.pgn === 126464 || pkt.pgn === 126996 || pkt.pgn >= 128000;
    const { completed, bytes } = fastPacketTracker.processPacket(pkt, isFast);

    // ----------------------------------------------------
    // PGN SPECIFIC DECODING & HEALTH CHECKS
    // ----------------------------------------------------

    // 1. ISO Address Claim (PGN 60928)
    if (pkt.pgn === 60928 && completed && bytes.length >= 8) {
      if (inWindow && isRelatedToFocus && bucketIdx >= 0) {
        buckets[bucketIdx].hasAddressClaim = true;
      }
      const name = decodeName(bytes);

      if (!addressClaimCounts[pkt.src]) {
        addressClaimCounts[pkt.src] = { count: 0, firstMs: pkt.timestampMs, lastMs: pkt.timestampMs };
      }
      const claimInfo = addressClaimCounts[pkt.src];
      claimInfo.count++;
      claimInfo.lastMs = pkt.timestampMs;

      if (device.claimedName && device.claimedName.rawHex !== name.rawHex) {
        device.claimStatus = 'conflict';
        if (inWindow) {
          allAnomalies.push({
            id: `claim_conflict_${pkt.id}`,
            timestamp: pkt.timestamp,
            timestampMs: pkt.timestampMs,
            type: 'address_conflict',
            severity: 'critical',
            address: pkt.src,
            pgn: 60928,
            title: `Address Claim Dispute at Address ${pkt.src}`,
            description: `Multiple devices (${name.manufacturerName} vs ${device.claimedName.manufacturerName}) contending for address ${pkt.src}`,
            packetId: pkt.id,
          });
        }
      } else {
        device.claimedName = name;
        device.claimStatus = 'claimed';
      }

      if (claimInfo.count > 5 && claimInfo.lastMs - claimInfo.firstMs < 10000) {
        if (inWindow) {
          allAnomalies.push({
            id: `claim_loop_${pkt.id}`,
            timestamp: pkt.timestamp,
            timestampMs: pkt.timestampMs,
            type: 'claiming_loop',
            severity: 'warning',
            address: pkt.src,
            pgn: 60928,
            title: `Address Claim Instability at Address ${pkt.src}`,
            description: `Device at address ${pkt.src} (${name.manufacturerName}) has broadcasted ${claimInfo.count} address claims in under 10s`,
            packetId: pkt.id,
          });
        }
      }
    }

    // Unclaimed data transmission check
    if (pkt.pgn > 60928 && device.claimStatus === 'unclaimed' && pkt.src !== 254 && pkt.src !== 255) {
      if (device.packetCount === 5 && inWindow) {
        allAnomalies.push({
          id: `unclaimed_tx_${pkt.id}`,
          timestamp: pkt.timestamp,
          timestampMs: pkt.timestampMs,
          type: 'unclaimed_tx',
          severity: 'warning',
          address: pkt.src,
          pgn: pkt.pgn,
          title: `Transmission Without Address Claim (Addr ${pkt.src})`,
          description: `Device at address ${pkt.src} transmitting PGN ${pkt.pgn} without completing ISO address claim`,
          packetId: pkt.id,
        });
      }
    }

    // 2. ISO Request (PGN 59904)
    if (pkt.pgn === 59904 && completed && bytes.length >= 3) {
      if (inWindow && isRelatedToFocus && bucketIdx >= 0) {
        buckets[bucketIdx].hasIsoRequest = true;
      }
      const req = decodeIsoRequest(bytes);
      const reqLog: IsoRequestLog = {
        id: `req_${pkt.id}`,
        timestamp: pkt.timestamp,
        timestampMs: pkt.timestampMs,
        requestedPgn: req.requestedPgn,
        requestedPgnName: req.requestedPgnName,
        src: pkt.src,
        dst: pkt.dst,
        responded: false,
      };

      device.isoRequestsSent.push(reqLog);

      if (currentDevices[pkt.dst]) {
        currentDevices[pkt.dst].isoRequestsReceived.push(reqLog);
      }

      if (pkt.dst !== 255) {
        const key = `${pkt.src}_${pkt.dst}_${req.requestedPgn}`;
        pendingRequests.set(key, reqLog);
      }
    }

    // Check responses to pending ISO Requests
    if (pkt.dst === 255 || pkt.dst in currentDevices) {
      for (const [key, reqLog] of pendingRequests.entries()) {
        const [reqSrc, reqDst, reqPgnStr] = key.split('_');
        const reqPgn = parseInt(reqPgnStr, 10);
        if (pkt.src === parseInt(reqDst, 10) && pkt.pgn === reqPgn) {
          reqLog.responded = true;
          reqLog.responseTimestampMs = pkt.timestampMs;
          pendingRequests.delete(key);
        }
      }
    }

    // 3. PGN List (PGN 126464)
    if (pkt.pgn === 126464 && completed) {
      const pgnList = decodePgnList(bytes);
      if (!device.pgnList) {
        device.pgnList = { txPgns: [], rxPgns: [] };
      }
      if (pgnList.isTx) {
        device.pgnList.txPgns = pgnList.pgns;
      } else {
        device.pgnList.rxPgns = pgnList.pgns;
      }
    }

    // 4. Product Info (PGN 126996)
    if (pkt.pgn === 126996 && completed) {
      device.productInfo = decodeProductInfo(bytes);
    }

    // 5. Heartbeat (PGN 126993)
    if (pkt.pgn === 126993 && completed) {
      const hb = decodeHeartbeat(bytes, pkt.timestampMs);
      device.heartbeat = hb;


      if (hb.error && inWindow) {
        allAnomalies.push({
          id: `hb_err_${pkt.id}`,
          timestamp: pkt.timestamp,
          timestampMs: pkt.timestampMs,
          type: 'missing_heartbeat',
          severity: 'warning',
          address: pkt.src,
          pgn: 126993,
          title: `Heartbeat Warning/Error at Address ${pkt.src}`,
          description: `Device at address ${pkt.src} reported heartbeat status: ${hb.equipmentStatusText}  controller 1:${hb.controllerState1Text} controller 2: ${hb.controllerState2Text}`,
          packetId: pkt.id,
        });
      }
    }

    // Store snapshots at bucket interval boundaries inside window
    if (inWindow) {
      const isLastInWindow = i === allPackets.length - 1 || (i < allPackets.length - 1 && allPackets[i + 1].timestampMs > winEndMs);
      const isBucketBoundary = i > 0 && Math.floor((pkt.timestampMs - winStartMs) / bucketDurationMs) !== Math.floor((allPackets[i - 1].timestampMs - winStartMs) / bucketDurationMs);

      if (isLastInWindow || isBucketBoundary) {
        deviceHistory.push({
          timestampMs: pkt.timestampMs,
          devices: makeDevicesSnapshot(),
        });
      }
    }
  }

  // If loop finished without pushing initial window snapshot (e.g. no packets inside window), push initial snapshot
  if (!hasPushedInitialWindowSnapshot) {
    deviceHistory.push({
      timestampMs: winStartMs,
      devices: makeDevicesSnapshot(),
    });
  }

  // Check unanswered ISO requests within window
  for (const [key, reqLog] of pendingRequests.entries()) {
    const timeElapsed = winEndMs - reqLog.timestampMs;
    if (reqLog.timestampMs >= winStartMs && reqLog.timestampMs <= winEndMs && timeElapsed > 2000 && !reqLog.responded) {
      allAnomalies.push({
        id: `unanswered_req_${reqLog.id}`,
        timestamp: reqLog.timestamp,
        timestampMs: reqLog.timestampMs,
        type: 'unanswered_iso_request',
        severity: 'info',
        address: reqLog.dst,
        pgn: reqLog.requestedPgn,
        title: `Unanswered ISO Request for ${reqLog.requestedPgnName}`,
        description: `ISO Request sent from address ${reqLog.src} to address ${reqLog.dst} for PGN ${reqLog.requestedPgn} (${reqLog.requestedPgnName}) received no response`,
      });
    }
  }

  // Filter anomalies if a device focus address is set
  const anomalies = focusedAddress === undefined
    ? allAnomalies
    : allAnomalies.filter((a) => a.address === focusedAddress);

  // Finalize bucket rates and anomaly counts
  const bucketSec = Math.max(0.1, bucketDurationMs / 1000);
  for (const bucket of buckets) {
    bucket.packetRate = Math.round(bucket.packetCount / bucketSec);
    bucket.anomalyCount = anomalies.filter(
      (a) => a.timestampMs >= bucket.timestampMs && a.timestampMs < bucket.timestampMs + bucketDurationMs
    ).length;
  }

  const uniqueDevicesCount = Object.keys(currentDevices).length;

  return {
    summary: {
      fileName,
      fileSizeBytes,
      totalPackets: windowPackets.length,
      durationMs: winDurationMs,
      startTime,
      endTime,
      uniqueDevicesCount,
      totalAnomaliesCount: anomalies.length,
      pgnCounts,
      trafficThresholdPct,
      maxBusRatePktsSec: MAX_CAN_BUS_RATE_PKTS_PER_SEC,
    },
    packets: windowPackets,
    buckets,
    anomalies,
    deviceHistory,
  };
}
