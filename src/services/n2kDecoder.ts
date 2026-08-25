import { NameFields, ProductInfo, PgnList, HeartbeatState } from '../types/n2k';
import {
  getManufacturerName,
  getDeviceClassName,
  getDeviceFunctionName,
  getIndustryGroupName,
  getPgnDescription,
  getEquipmentStatus,
  getControllerState,
} from './n2kDatabase';

/**
 * Decodes 64-bit ISO Address Claim NAME (PGN 60928)
 */
export function decodeName(bytes: number[]): NameFields {
  const padBytes = [...bytes];
  while (padBytes.length < 8) padBytes.push(0);

  let raw64 = 0n;
  for (let i = 0; i < 8; i++) {
    raw64 |= BigInt(padBytes[i] & 0xff) << BigInt(i * 8);
  }

  const hexStr = padBytes
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .reverse()
    .join('');

  const uniqueNumber = Number(raw64 & 0x1fffffn);
  const manufacturerCode = Number((raw64 >> 21n) & 0x7ffn);
  const deviceInstanceLower = Number((raw64 >> 32n) & 0x7n);
  const deviceInstanceUpper = Number((raw64 >> 35n) & 0x1fn);
  const deviceInstance = (deviceInstanceUpper << 3) | deviceInstanceLower;
  const deviceFunction = Number((raw64 >> 40n) & 0xffn);
  const deviceClass = Number((raw64 >> 49n) & 0x7fn);
  const systemInstance = Number((raw64 >> 56n) & 0xfn);
  const industryGroup = Number((raw64 >> 60n) & 0x7n);
  const arbitraryAddressCapable = Number((raw64 >> 63n) & 0x1n) === 1;

  const manufacturerName = getManufacturerName(manufacturerCode);
  const className = getDeviceClassName(deviceClass);
  const functionName = getDeviceFunctionName(deviceClass, deviceFunction);
  const industryGroupName = getIndustryGroupName(industryGroup);

  return {
    rawHex: hexStr,
    uniqueNumber,
    manufacturerCode,
    manufacturerName,
    deviceInstanceLower,
    deviceInstanceUpper,
    deviceInstance,
    deviceFunction,
    functionName,
    deviceClass,
    className,
    systemInstance,
    industryGroup,
    industryGroupName,
    arbitraryAddressCapable,
  };
}

/**
 * Decodes ISO Request payload (PGN 59904)
 */
export function decodeIsoRequest(bytes: number[]): { requestedPgn: number; requestedPgnName: string } {
  if (bytes.length < 3) return { requestedPgn: 0, requestedPgnName: 'Unknown' };
  const requestedPgn = bytes[0] | (bytes[1] << 8) | (bytes[2] << 16);
  const desc = getPgnDescription(requestedPgn);
  return { requestedPgn, requestedPgnName: desc.name };
}

/**
 * Decodes PGN List payload (PGN 126464)
 */
export function decodePgnList(bytes: number[]): { isTx: boolean; pgns: number[] } {
  if (bytes.length < 1) return { isTx: true, pgns: [] };
  const isTx = bytes[0] === 0;
  const pgns: number[] = [];

  for (let i = 1; i + 2 < bytes.length; i += 3) {
    const pgn = bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16);
    if (pgn > 0) {
      pgns.push(pgn);
    }
  }

  return { isTx, pgns };
}

/**
 * Cleans string from byte payload (strips trailing 0xFF / nulls)
 */
function cleanAscii(bytes: number[]): string {
  let str = '';
  for (const b of bytes) {
    if (b === 0x00 || b === 0xff) break;
    if (b >= 32 && b <= 126) {
      str += String.fromCharCode(b);
    }
  }
  return str.trim();
}

/**
 * Decodes Product Information payload (PGN 126996)
 */
export function decodeProductInfo(bytes: number[]): ProductInfo {
  const n2kVersion = bytes.length >= 2 ? bytes[0] | (bytes[1] << 8) : 0;
  const productCode = bytes.length >= 4 ? bytes[2] | (bytes[3] << 8) : 0;

  const modelId = bytes.length >= 36 ? cleanAscii(bytes.slice(4, 36)) : '';
  const softwareVersion = bytes.length >= 68 ? cleanAscii(bytes.slice(36, 68)) : '';
  const modelVersion = bytes.length >= 100 ? cleanAscii(bytes.slice(68, 100)) : '';
  const serialCode = bytes.length >= 132 ? cleanAscii(bytes.slice(100, 132)) : '';

  const certLevel = bytes.length >= 133 ? bytes[132] : 0;
  const loadEquivalence = bytes.length >= 134 ? bytes[133] : 0;

  return {
    n2kVersion,
    productCode,
    modelId,
    softwareVersion,
    modelVersion,
    serialCode,
    certLevel,
    loadEquivalence,
  };
}

/**
 * Decodes Heartbeat payload (PGN 126993)
 */
export function decodeHeartbeat(bytes: number[], timestampMs: number): HeartbeatState {
  const updateIntervalMs = bytes.length >= 2 ? (bytes[0] | (bytes[1] << 8)) * 10 : 1000;
  const sequence = bytes.length >= 3 ? bytes[2]: 0;
  const status = bytes.length >= 4 ? bytes[3] : 0;
  const controllerState1 = status & 0x03;
  const controllerState2 = (status & 0x0C) >> 2;
  const equipmentStatus = (status & 0x30) >> 4;


  const controllerState1Text = getControllerState(controllerState1);
  const controllerState2Text = getControllerState(controllerState2);
  const equipmentStatusText = getEquipmentStatus(equipmentStatus);
  const error = (controllerState1Text !== '-' || controllerState2Text !== '-' || equipmentStatusText !== '-');


  return {
    updateIntervalMs,
    status,
    error,
    controllerState1,
    controllerState2,
    equipmentStatus,
    controllerState1Text,
    controllerState2Text,
    equipmentStatusText,
    sequence,
    lastHeartbeatMs: timestampMs,
  };
}
