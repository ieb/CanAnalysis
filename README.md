# CanAnalysis - NMEA 2000 Technical CAN Bus Analyzer

**CanAnalysis** is a single-page web application designed to analyze NMEA 2000 (N2K) CAN bus packet captures. The utility focuses on technical bus health, ISO address claim resolution, device interactions, ISO request/response tracking, and bus activity over time using an interactive timeline pointer.

---

## Key Features

- **Dual Log Format Parsing**:
  - **`candump2analyse` CSV Format**: `timestamp,priority,pgn,src,dst,len,byte0,byte1,...` (e.g. `2026-08-15-16:33:55.364,2,129026,30,255,8,02,fc,...`).
  - **`candump` Raw Log Format**: Standard Linux SocketCAN logs (e.g. `can0 18EEFF32 [8] 05 00 C0 FF 00 82 F0 C0`).
- **NMEA 2000 Protocol & Address Claim Decoders**:
  - **PGN 60928 (ISO Address Claim)**: Complete 64-bit NAME bitfield decoding into Unique Number, Manufacturer Code, Device Function, Device Class, System Instance, Industry Group, and Arbitrary Address Capable status.
  - **PGN 59904 (ISO Request)**: Unpacks requested PGNs and tracks unicast/broadcast response status.
  - **PGN 126464 (PGN List)**: Decodes transmitted (TX) and received (RX) PGN lists per device.
  - **PGN 126996 (Product Information)**: Reassembles FastPackets to extract Model ID, Software Version, Model Version, and Serial Code.
  - **PGN 126993 (Heartbeat)**: Monitors device status and sequence counters.
- **Single Device Target Focus**:
  - Focus on a single target device identified by **Model Version** and **Serial Number** (from PGN 126996 Product Info).
  - Isolates and highlights target device state in the Device Matrix, filters live packet streams, and highlights device-specific traffic.
- **Drag-to-Select Timeline Region Window**:
  - Click and drag across the timeline canvas to select a custom time region/window (e.g., `16:33:54.100` to `16:33:58.500`).
  - Restricts all summary statistics, device matrix states, health warnings, and live packet stream views to that exact time range while respecting any active single device target focus.
- **Configurable Bus Rate Warning Threshold (% of Max Capacity)**:
  - Express traffic warning thresholds as a percentage (%) of maximum theoretical NMEA 2000 CAN bus capacity (2500 pkts/sec at 250 kbps).
  - Configurable selector (5% to 100%, e.g., 5% = 125 pkts/s, 20% = 500 pkts/s) that dynamically recalculates traffic rate warnings across the log duration.
- **Interactive Web UI**:
  - **Visual Timeline & Scrubber**: Canvas histogram displaying packet rate over time, event markers for address claims and anomalies, and playback controls (Play, Pause, Speed multiplier).
  - **Device Matrix at Pointer**: View active CAN devices and their exact status at any selected point in time, with Model Version, Serial Number, and 64-bit NAME breakdown.
  - **Anomaly Dashboard**: List of detected bus health issues with single-click "Seek to Timestamp" buttons.
  - **Live Packet Inspector**: Inspect raw CAN ID bits and payload bytes synced to the timeline.
- **Offline & Browser Storage**: Uses IndexedDB to persist uploaded logs locally for instant reloads.

---

## Getting Started

### Prerequisites

- **Node.js**: Version 18+ (tested on Node v23)
- **NPM**: Version 9+

### Installation

1. Clone or navigate to the repository directory:
   ```bash
   cd /Users/ieb/timefields/PlatformIO/Projects/CanAnalysis
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

---

## Running the Application

### Development Server

To launch the application in development mode with live hot reloading:

```bash
npm run dev
```

Open your browser and navigate to `http://localhost:5173`.

### Production Build

To typecheck and compile the application for production:

```bash
npm run build
```

To preview the built production bundle locally:

```bash
npm run preview
```

---

## User Guide

### 1. Loading Datasets

- **Preloaded Datasets**: Click **startup3.log (CSV)** or **startup2.log (Raw)** in the top navigation bar to instantly load included sample captures.
- **Custom Log Files**: Click **Open Log File** to load your own CAN bus capture file (`.log`, `.txt`, or `.csv`).

### 2. Timeline Scrubbing & Playback

- **Scrubbing**: Click or drag anywhere along the visual histogram at the top of the app to move the timeline pointer.
- **Playback**: Click **Play Timeline** to automatically play through the log. Adjust playback speed using the **1x / 2x / 5x / 10x** toggles.
- **Jump to Issues**: Use **Prev Issue** and **Next Issue** buttons to jump directly to timestamps where technical anomalies were detected.

### 3. Device Matrix

- Switch to the **Device Matrix** tab to see all active devices on the CAN bus at the exact timestamp of the timeline pointer.
- Expand any device card to inspect:
  - **64-bit ISO Address Claim NAME**: Bitfield breakdown (Manufacturer, Class, Function, Unique ID).
  - **Product Information**: Model ID, Software Version, Serial Number.
  - **Transmitted PGNs**: List of PGNs emitted by this device.
  - **ISO Requests**: History of ISO requests sent and received.

### 4. Anomaly Dashboard

- Switch to the **Health Anomalies** tab to view all address claim disputes, unanswered ISO requests, heartbeat warnings, and traffic spikes.
- Click the timestamp button next to any anomaly to seek the timeline pointer directly to that event.

---

## Project Structure

```
CanAnalysis/
├── datasets/             # Sample CAN bus log datasets (startup2.log, startup3.log)
├── docs/                 # Initial specification & N2K reference HTML
├── public/               # Static assets & preloaded datasets
├── src/
│   ├── components/       # React UI components
│   │   ├── Navbar.tsx            # Navigation bar & dataset controls
│   │   ├── TimelineControls.tsx  # Interactive canvas timeline scrubber
│   │   ├── DeviceMatrix.tsx      # Device state grid & 64-bit NAME inspector
│   │   ├── AnomalyDashboard.tsx  # Health alert feed
│   │   └── PacketInspector.tsx   # Raw CAN packet stream viewer
│   ├── services/         # Core logic & decoders
│   │   ├── logParser.ts          # candump & candump2analyse line parsers
│   │   ├── fastPacket.ts         # FastPacket protocol reassembler
│   │   ├── n2kDecoder.ts         # 64-bit NAME, ISO Request, Product Info decoders
│   │   ├── n2kDatabase.ts        # N2K Manufacturers, Classes, Functions & PGN list
│   │   ├── analysisEngine.ts     # Bus anomaly detection & time-series indexer
│   │   └── storage.ts            # IndexedDB local storage manager
│   ├── types/            # TypeScript type definitions (n2k.ts)
│   ├── App.tsx           # Main application shell
│   └── main.tsx          # React entrypoint
├── index.html            # HTML template
├── vite.config.ts        # Vite build configuration
├── tailwind.config.js    # TailwindCSS configuration
└── package.json          # Project dependencies and scripts
```
