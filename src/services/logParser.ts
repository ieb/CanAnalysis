import { CanPacket } from '../types/n2k';

/**
 * Parses raw CAN ID into Priority, PGN, Source Address, and Destination Address
 */
export function parseCanId(canIdHex: string): { priority: number; pgn: number; src: number; dst: number } {
  const canId = parseInt(canIdHex, 16);
  if (isNaN(canId)) {
    return { priority: 0, pgn: 0, src: 0, dst: 255 };
  }

  const priority = (canId >> 26) & 0x07;
  const edp = (canId >> 25) & 0x01;
  const dp = (canId >> 24) & 0x01;
  const pf = (canId >> 16) & 0xff;
  const ps = (canId >> 8) & 0xff;
  const src = canId & 0xff;

  let pgn: number;
  let dst: number;

  if (pf < 240) {
    // PDU1 format (unicast to specific destination)
    pgn = (edp << 17) | (dp << 16) | (pf << 8);
    dst = ps;
  } else {
    // PDU2 format (broadcast)
    pgn = (edp << 17) | (dp << 16) | (pf << 8) | ps;
    dst = 255;
  }

  return { priority, pgn, src, dst };
}

/**
 * Parses timestamp string into milliseconds since reference/epoch
 */
export function parseTimestampMs(tsStr: string, lineIndex: number): number {
  if (!tsStr) return lineIndex * 10; // fallback relative time

  // Format: 2026-08-15-16:33:55.364
  const matchIso = tsStr.match(/^(\d{4})-(\d{2})-(\d{2})[-T](\d{2}):(\d{2}):(\d{2})\.?(\d{0,3})/);
  if (matchIso) {
    const [_, y, m, d, hh, mm, ss, msStr] = matchIso;
    const ms = msStr ? parseInt(msStr.padEnd(3, '0'), 10) : 0;
    const date = new Date(
      Date.UTC(
        parseInt(y, 10),
        parseInt(m, 10) - 1,
        parseInt(d, 10),
        parseInt(hh, 10),
        parseInt(mm, 10),
        parseInt(ss, 10),
        ms
      )
    );
    return date.getTime();
  }

  // Format: (1692117235.364) or float seconds
  const matchSeconds = tsStr.match(/^\(?(\d+\.\d+)\)?$/);
  if (matchSeconds) {
    return Math.round(parseFloat(matchSeconds[1]) * 1000);
  }

  return lineIndex * 10;
}

/**
 * Parses a single line of log into a CanPacket object
 */
export function parseLogLine(line: string, index: number, defaultBaseTimestampMs?: number): CanPacket | null {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) {
    return null;
  }

  // Format 1: candump2analyse CSV
  // 2026-08-15-16:33:55.364,2,129026,30,255,8,02,fc,ff,ff,ff,ff,ff,ff
  if (trimmed.includes(',')) {
    const parts = trimmed.split(',');
    if (parts.length >= 6) {
      const timestampStr = parts[0].trim();
      const priority = parseInt(parts[1], 10) || 0;
      const pgn = parseInt(parts[2], 10) || 0;
      const src = parseInt(parts[3], 10) || 0;
      const dst = parseInt(parts[4], 10) || 255;
      const len = parseInt(parts[5], 10) || (parts.length - 6);

      const bytes: number[] = [];
      for (let i = 6; i < parts.length; i++) {
        const hex = parts[i].trim();
        if (hex) {
          bytes.push(parseInt(hex, 16) || 0);
        }
      }

      const timestampMs = parseTimestampMs(timestampStr, index);

      return {
        id: index,
        timestamp: timestampStr,
        timestampMs,
        priority,
        pgn,
        src,
        dst,
        len,
        bytes,
        rawLine: trimmed,
      };
    }
  }

  // Format 2: Raw candump format
  // Example 2a: can0  18EEFF32   [8]  05 00 C0 FF 00 82 F0 C0
  // Example 2b: (1692117235.364) can0 18EEFF32#0500C0FF0082F0C0
  // Example 2c:   can0       536   [6]  remote request
  if (trimmed.includes('remote request')) {
    return null; // Skip CAN remote request frames
  }

  const rawCandumpMatch = trimmed.match(/^(?:\(([\d.]+)\)\s+)?\w+\s+([0-9A-Fa-f]{3,8})(?:#|(?:\s+\[\d+\]\s+))(.*)$/);
  if (rawCandumpMatch) {
    const [_, tsStr, canIdHex, hexPayloadStr] = rawCandumpMatch;
    const { priority, pgn, src, dst } = parseCanId(canIdHex);

    const bytes: number[] = [];
    const cleanPayload = hexPayloadStr.replace(/\s+/g, '');
    for (let i = 0; i < cleanPayload.length; i += 2) {
      const byteHex = cleanPayload.substring(i, i + 2);
      if (byteHex.length === 2) {
        bytes.push(parseInt(byteHex, 16));
      }
    }

    const timestampMs = tsStr
      ? parseTimestampMs(tsStr, index)
      : (defaultBaseTimestampMs || 0) + index * 10;

    const formattedTs = tsStr
      ? new Date(timestampMs).toISOString().replace('T', ' ').replace('Z', '')
      : `+${(index * 10 / 1000).toFixed(3)}s`;

    return {
      id: index,
      timestamp: formattedTs,
      timestampMs,
      priority,
      pgn,
      src,
      dst,
      len: bytes.length,
      bytes,
      rawLine: trimmed,
    };
  }

  return null;
}

/**
 * Parses raw text content of log file into CanPacket list
 */
export function parseLogContent(content: string): CanPacket[] {
  const lines = content.split(/\r?\n/);
  const packets: CanPacket[] = [];
  const baseMs = Date.now();

  for (let i = 0; i < lines.length; i++) {
    const pkt = parseLogLine(lines[i], packets.length + 1, baseMs);
    if (pkt) {
      packets.push(pkt);
    }
  }

  return packets;
}
