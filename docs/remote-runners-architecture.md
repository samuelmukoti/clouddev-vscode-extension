# CloudDev Remote Runners Architecture

## Overview

Remote runners allow offloading Android/iOS emulator workloads to dedicated machines, solving:
- **Hardware constraints** on development VPS
- **iOS testing** (requires macOS)
- **Parallel testing** across multiple devices
- **Dedicated GPU resources** for smooth emulator performance

Similar to GitHub Actions self-hosted runners, but specialized for mobile emulators.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CloudDev Development VPS                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────┐ │
│  │   VS Code Ext    │  │  Maestro Client  │  │   Runner Coordinator   │ │
│  │  (clouddev-ext)  │  │                  │  │      (optional)        │ │
│  └────────┬─────────┘  └────────┬─────────┘  └───────────┬────────────┘ │
│           │                     │                        │              │
└───────────┼─────────────────────┼────────────────────────┼──────────────┘
            │                     │                        │
            │    WebSocket/HTTP   │   ADB over TCP         │  gRPC/HTTP
            │                     │                        │
┌───────────┼─────────────────────┼────────────────────────┼──────────────┐
│           ▼                     ▼                        ▼              │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     Remote Runner Agent                          │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│  │  │ ADB Server  │  │ VNC Proxy   │  │    Job Executor         │  │   │
│  │  │ (TCP:5555)  │  │ (TCP:5900)  │  │ (Maestro, Screenshots)  │  │   │
│  │  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │   │
│  │         │                │                     │                 │   │
│  │         ▼                ▼                     ▼                 │   │
│  │  ┌─────────────────────────────────────────────────────────────┐│   │
│  │  │              Android Emulator / iOS Simulator               ││   │
│  │  │                    (Local to Runner)                        ││   │
│  │  └─────────────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                     Remote Machine (PC/Mac)                             │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Runner Agent (`clouddev-runner`)

A lightweight daemon that runs on remote machines with emulators.

**Responsibilities:**
- Register with coordinator (or work standalone)
- Manage local emulators/simulators
- Expose ADB over TCP (port 5555)
- Proxy VNC for remote viewing
- Execute Maestro tests locally
- Stream results back (screenshots, logs, reports)

**Supported Platforms:**
- Linux (Android emulators)
- macOS (Android emulators + iOS simulators)
- Windows (Android emulators)

### 2. Runner Coordinator (Optional)

Central service for managing multiple runners.

**Features:**
- Runner registration and health checks
- Job queue and dispatch
- Load balancing
- Result aggregation
- Web dashboard

**Can be:**
- Self-hosted (Docker container)
- Cloud-hosted (CloudDev service)
- Skipped (direct connection mode)

### 3. VS Code Extension Updates

**New Configuration:**
```json
{
  "emulator": {
    "mode": "remote",
    "runner": {
      "host": "192.168.1.100",
      "port": 7800,
      "token": "runner-auth-token"
    }
  }
}
```

**New Commands:**
- `CloudDev: Connect to Remote Runner`
- `CloudDev: List Available Runners`
- `CloudDev: Run Tests on Remote`

### 4. Connection Modes

#### Mode A: Direct Connection (Simple)
```
VS Code ──ADB-TCP──> Remote Runner ──> Emulator
```
- No coordinator needed
- Configure runner IP directly
- Good for single runner setups

#### Mode B: Coordinated (Scalable)
```
VS Code ──HTTP──> Coordinator ──gRPC──> Runner Pool ──> Emulators
```
- Multiple runners
- Automatic failover
- Job queuing

## Runner Agent Design

### CLI Interface

```bash
# Start runner agent
clouddev-runner start --port 7800 --token <auth-token>

# Register with coordinator
clouddev-runner register --coordinator https://coordinator.example.com

# List local devices
clouddev-runner devices

# Health check
clouddev-runner status
```

### API Endpoints

```
POST /api/v1/auth          # Authenticate client
GET  /api/v1/devices       # List available devices
POST /api/v1/connect       # Connect to device (returns ADB port)
POST /api/v1/screenshot    # Take screenshot
POST /api/v1/maestro/run   # Run Maestro flow
GET  /api/v1/maestro/status/:jobId
GET  /api/v1/vnc           # WebSocket VNC proxy
```

### Runner Configuration

```yaml
# ~/.clouddev/runner.yaml
port: 7800
auth:
  token: "secure-random-token"

devices:
  android:
    enabled: true
    adb_port: 5555
    avd_name: "Pixel_4_API_34"
  ios:
    enabled: true  # macOS only
    simulator: "iPhone 15 Pro"

coordinator:
  url: "https://coordinator.example.com"  # optional

vnc:
  enabled: true
  port: 5900
  password: ""  # optional
```

## Implementation Plan

### Phase 1: Direct Connection Mode
1. Create `clouddev-runner` Node.js agent
2. Implement ADB-over-TCP proxy
3. Add VNC WebSocket proxy
4. Update VS Code extension for remote config
5. Test with Android emulator on remote Linux

### Phase 2: Maestro Remote Execution
1. Add job execution endpoint
2. Implement Maestro flow runner
3. Screenshot transfer (base64 or file upload)
4. Result streaming via WebSocket

### Phase 3: iOS Support
1. Add xcrun simctl integration
2. iOS simulator management
3. Maestro iOS support
4. Remote iOS VNC

### Phase 4: Coordinator (Optional)
1. Runner registration API
2. Job queue (Redis/SQLite)
3. Load balancing
4. Web dashboard
5. GitHub Actions integration

## Security Considerations

1. **Authentication**: Token-based auth for all connections
2. **Encryption**: TLS for all traffic
3. **Network**: Runner should be on private network or VPN
4. **Isolation**: Each job runs in clean emulator state

## Example Usage

### Setup Remote Runner (on Mac Mini)

```bash
# Install runner
npm install -g @clouddev/runner

# Start with Android + iOS
clouddev-runner start \
  --port 7800 \
  --token "my-secure-token" \
  --android-avd "Pixel_4_API_34" \
  --ios-simulator "iPhone 15 Pro"
```

### Configure VS Code Extension

```json
// .clouddev.json
{
  "emulator": {
    "mode": "remote",
    "runner": {
      "host": "mac-mini.local",
      "port": 7800,
      "token": "my-secure-token"
    }
  },
  "maestro": {
    "flowsDir": ".clouddev/flows",
    "device": "remote"
  }
}
```

### Run Tests

```bash
# From VS Code command palette
CloudDev: Run Maestro Flow on Remote Runner

# Or CLI
maestro --device remote test .clouddev/flows/login-test.yaml
```

## Benefits

| Feature | Local Emulator | Remote Runner |
|---------|---------------|---------------|
| Hardware requirements | High (VPS) | Low (VPS) |
| iOS support | ❌ | ✅ (macOS runner) |
| Parallel testing | Limited | ✅ Multiple runners |
| GPU acceleration | Depends | ✅ Dedicated |
| Cost | VPS CPU/RAM | Separate machine |
| Latency | None | Network (~50-200ms) |
