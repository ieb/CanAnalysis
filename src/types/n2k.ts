export interface CanPacket {
  id: number;
  timestamp: string;
  timestampMs: number;
  priority: number;
  pgn: number;
  src: number;
  dst: number;
  len: number;
  bytes: number[];
  rawLine: string;
}

export interface NameFields {
  rawHex: string;
  uniqueNumber: number;
  manufacturerCode: number;
  manufacturerName: string;
  deviceInstanceLower: number;
  deviceInstanceUpper: number;
  deviceInstance: number;
  deviceFunction: number;
  functionName: string;
  deviceClass: number;
  className: string;
  systemInstance: number;
  industryGroup: number;
  industryGroupName: string;
  arbitraryAddressCapable: boolean;
}

export interface ProductInfo {
  n2kVersion: number;
  productCode: number;
  modelId: string;
  softwareVersion: string;
  modelVersion: string;
  serialCode: string;
  certLevel: number;
  loadEquivalence: number;
}

export interface PgnList {
  txPgns: number[];
  rxPgns: number[];
}

export interface HeartbeatState {
  updateIntervalMs: number;
  status: number;
  error: boolean;
  controllerState1: number;
  controllerState2: number;
  equipmentStatus: number;
  controllerState1Text: string;
  controllerState2Text: string;
  equipmentStatusText: string;
  sequence: number;
  lastHeartbeatMs: number;
}

export interface IsoRequestLog {
  id: string;
  timestamp: string;
  timestampMs: number;
  requestedPgn: number;
  requestedPgnName: string;
  src: number;
  dst: number;
  responded: boolean;
  responseTimestampMs?: number;
}

export type DeviceClaimStatus = 'claimed' | 'claiming' | 'conflict' | 'unclaimed' | 'lost';

export interface N2kDevice {
  address: number;
  claimedName?: NameFields;
  claimStatus: DeviceClaimStatus;
  productInfo?: ProductInfo;
  pgnList?: PgnList;
  heartbeat?: HeartbeatState;
  firstSeenMs: number;
  lastSeenMs: number;
  packetCount: number;
  txPgnsSeen: number[];
  isoRequestsSent: IsoRequestLog[];
  isoRequestsReceived: IsoRequestLog[];
}

export interface DeviceFocusTarget {
  key: string;
  address: number;
  modelVersion?: string;
  serialCode?: string;
  modelId?: string;
  manufacturerName?: string;
  label: string;
}

export type AnomalySeverity = 'critical' | 'warning' | 'info';

export type AnomalyType = 
  | 'address_conflict'
  | 'unclaimed_tx'
  | 'unanswered_iso_request'
  | 'missing_heartbeat'
  | 'traffic_spike'
  | 'claiming_loop';

export interface BusAnomaly {
  id: string;
  timestamp: string;
  timestampMs: number;
  type: AnomalyType;
  severity: AnomalySeverity;
  address?: number;
  pgn?: number;
  title: string;
  description: string;
  packetId?: number;
}

export interface TimelineBucket {
  timestampMs: number;
  timestamp: string;
  packetCount: number;
  focusedPacketCount?: number;
  packetRate: number; // packets/sec
  anomalyCount: number;
  hasAddressClaim: boolean;
  hasIsoRequest: boolean;
}

export interface AnalysisSummary {
  fileName: string;
  fileSizeBytes: number;
  totalPackets: number;
  durationMs: number;
  startTime: string;
  endTime: string;
  uniqueDevicesCount: number;
  totalAnomaliesCount: number;
  pgnCounts: Record<number, number>;
  trafficThresholdPct: number;
  maxBusRatePktsSec: number;
}
