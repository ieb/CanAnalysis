import { CanPacket } from '../types/n2k';

export interface FastPacketAssembly {
  pgn: number;
  src: number;
  sequenceId: number;
  totalLen: number;
  bytes: number[];
  receivedFrames: number;
  complete: boolean;
  firstTimestampMs: number;
  firstTimestampStr: string;
}

export class FastPacketTracker {
  private buffers: Map<string, FastPacketAssembly> = new Map();

  /**
   * Process a CAN packet. If it's a FastPacket frame or single frame, returns reassembled payload bytes.
   * If single frame (8 bytes or less and not fastpacket PGN), returns raw bytes.
   */
  public processPacket(pkt: CanPacket, isFastpacketPgn: boolean = true): { completed: boolean; bytes: number[] } {
    // If not fastpacket PGN and bytes len <= 8, single frame
    if (!isFastpacketPgn && pkt.bytes.length <= 8) {
      return { completed: true, bytes: pkt.bytes };
    }

    if (pkt.bytes.length < 2) {
      return { completed: true, bytes: pkt.bytes };
    }

    const header = pkt.bytes[0];
    const sequenceId = (header >> 5) & 0x07;
    const frameIndex = header & 0x1f;

    const key = `${pkt.src}_${pkt.pgn}_${sequenceId}`;

    if (frameIndex === 0) {
      // First frame
      const totalLen = pkt.bytes[1];
      const initialPayload = pkt.bytes.slice(2);

      const assembly: FastPacketAssembly = {
        pgn: pkt.pgn,
        src: pkt.src,
        sequenceId,
        totalLen,
        bytes: initialPayload,
        receivedFrames: 1,
        complete: initialPayload.length >= totalLen,
        firstTimestampMs: pkt.timestampMs,
        firstTimestampStr: pkt.timestamp,
      };

      if (assembly.complete) {
        return { completed: true, bytes: assembly.bytes.slice(0, totalLen) };
      }

      this.buffers.set(key, assembly);
      return { completed: false, bytes: [] };
    } else {
      // Consecutive frame
      const existing = this.buffers.get(key);
      if (!existing) {
        // Frame missed or orphan, treat as raw if frame 0 missed
        return { completed: true, bytes: pkt.bytes };
      }

      const framePayload = pkt.bytes.slice(1);
      existing.bytes.push(...framePayload);
      existing.receivedFrames++;

      if (existing.bytes.length >= existing.totalLen) {
        existing.complete = true;
        this.buffers.delete(key);
        return { completed: true, bytes: existing.bytes.slice(0, existing.totalLen) };
      }

      return { completed: false, bytes: [] };
    }
  }

  public clear() {
    this.buffers.clear();
  }
}
