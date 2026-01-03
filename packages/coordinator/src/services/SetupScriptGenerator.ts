/**
 * Setup Script Generator
 *
 * Generates bash scripts for easy runner setup on remote machines.
 * The script auto-detects the platform and connects back to the coordinator.
 */

export interface SetupScriptOptions {
    coordinatorUrl: string;
    token: string;
    runnerVersion?: string;
}

export class SetupScriptGenerator {
    /**
     * Generate the bash setup script
     */
    generate(options: SetupScriptOptions): string {
        const { coordinatorUrl, token, runnerVersion = '0.1.0' } = options;

        // Convert HTTP URL to WebSocket URL
        const wsUrl = coordinatorUrl
            .replace('https://', 'wss://')
            .replace('http://', 'ws://');

        return `#!/bin/bash
#
# CloudDev Remote Runner Setup Script
# Generated automatically - this link expires in 10 minutes
#
# This script will:
# 1. Detect your operating system
# 2. Install the CloudDev runner agent
# 3. Connect to your development environment
# 4. Start available emulators/simulators
#

set -e

# Configuration (embedded from magic link)
COORDINATOR_URL="${wsUrl}/ws"
TOKEN="${token}"
RUNNER_VERSION="${runnerVersion}"
COORDINATOR_HTTP="${coordinatorUrl}"

# Colors
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
NC='\\033[0m'

log_info() { echo -e "\${GREEN}✓\${NC} $1"; }
log_warn() { echo -e "\${YELLOW}!\${NC} $1"; }
log_error() { echo -e "\${RED}✗\${NC} $1"; }
log_step() { echo -e "\${BLUE}→\${NC} $1"; }

echo ""
echo -e "\${BLUE}╔══════════════════════════════════════════════╗\${NC}"
echo -e "\${BLUE}║\${NC}     🚀 CloudDev Remote Runner Setup         \${BLUE}║\${NC}"
echo -e "\${BLUE}╚══════════════════════════════════════════════╝\${NC}"
echo ""

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
    Darwin) OS_NAME="macOS" ;;
    Linux)  OS_NAME="Linux" ;;
    MINGW*|MSYS*|CYGWIN*) OS_NAME="Windows" ;;
    *) log_error "Unsupported OS: $OS"; exit 1 ;;
esac

case "$ARCH" in
    x86_64|amd64) ARCH_NAME="x64" ;;
    arm64|aarch64) ARCH_NAME="arm64" ;;
    *) log_error "Unsupported architecture: $ARCH"; exit 1 ;;
esac

log_info "Detected: $OS_NAME ($ARCH_NAME)"

# Check for Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js is required but not installed"
    echo ""
    echo "Install Node.js from: https://nodejs.org/"
    echo "Or use a package manager:"
    echo "  macOS:  brew install node"
    echo "  Linux:  sudo apt install nodejs npm"
    exit 1
fi

NODE_VERSION=$(node -v)
log_info "Node.js: $NODE_VERSION"

# Install runner
log_step "Installing CloudDev Runner..."

# Create temp directory for runner
RUNNER_DIR="\$HOME/.clouddev/runner"
mkdir -p "\$RUNNER_DIR"

# Install ws dependency
cd "\$RUNNER_DIR"
if [ ! -f "package.json" ]; then
    npm init -y > /dev/null 2>&1
fi
npm install ws --silent > /dev/null 2>&1
log_info "Dependencies installed"

# For now, create a simple runner script
# In production, this would install from npm registry
cat > "\$RUNNER_DIR/runner.js" << 'RUNNER_SCRIPT'
${this.getRunnerScript()}
RUNNER_SCRIPT

log_info "Runner installed to \$RUNNER_DIR"

# Get runner name from hostname (read doesn't work in curl|bash context)
RUNNER_NAME=\$(hostname -s 2>/dev/null || hostname)

# Detect available emulators/simulators
log_step "Detecting emulators and simulators..."

ANDROID_AVAILABLE=false
IOS_AVAILABLE=false
DEVICES_FOUND=0

# Check for Android SDK
if [ -n "\$ANDROID_HOME" ] || [ -n "\$ANDROID_SDK_ROOT" ]; then
    ANDROID_SDK="\${ANDROID_HOME:-\$ANDROID_SDK_ROOT}"
    if [ -f "\$ANDROID_SDK/emulator/emulator" ]; then
        AVDS=\$("\$ANDROID_SDK/emulator/emulator" -list-avds 2>/dev/null | head -5)
        if [ -n "\$AVDS" ]; then
            ANDROID_AVAILABLE=true
            log_info "Android SDK found with AVDs:"
            echo "\$AVDS" | while read avd; do echo "      • \$avd"; done
            DEVICES_FOUND=\$((DEVICES_FOUND + \$(echo "\$AVDS" | wc -l)))
        fi
    fi
fi

# Check for iOS Simulator (macOS only)
if [ "\$OS" = "Darwin" ]; then
    if command -v xcrun &> /dev/null; then
        SIMULATORS=\$(xcrun simctl list devices available 2>/dev/null | grep -E "iPhone|iPad" | head -5)
        if [ -n "\$SIMULATORS" ]; then
            IOS_AVAILABLE=true
            log_info "iOS Simulators found:"
            echo "\$SIMULATORS" | while read sim; do echo "      • \$sim"; done
            DEVICES_FOUND=\$((DEVICES_FOUND + \$(echo "\$SIMULATORS" | wc -l)))
        fi
    fi
fi

if [ \$DEVICES_FOUND -eq 0 ]; then
    log_warn "No emulators or simulators found"
    echo "      You can still connect - devices can be added later"
fi

echo ""
log_step "Connecting to CloudDev coordinator..."
echo "      URL: \$COORDINATOR_HTTP"
echo ""

# Start the runner
export CLOUDDEV_COORDINATOR_URL="\$COORDINATOR_URL"
export CLOUDDEV_TOKEN="\$TOKEN"
export CLOUDDEV_RUNNER_NAME="\$RUNNER_NAME"
export CLOUDDEV_ANDROID_ENABLED="\$ANDROID_AVAILABLE"
export CLOUDDEV_IOS_ENABLED="\$IOS_AVAILABLE"

# Run the runner
node "\$RUNNER_DIR/runner.js"
`;
    }

    /**
     * Get the embedded runner script
     */
    private getRunnerScript(): string {
        return `
const WebSocket = require('ws');
const { spawn, exec } = require('child_process');
const os = require('os');
const path = require('path');

const COORDINATOR_URL = process.env.CLOUDDEV_COORDINATOR_URL;
const TOKEN = process.env.CLOUDDEV_TOKEN;
const RUNNER_NAME = process.env.CLOUDDEV_RUNNER_NAME || os.hostname();

let ws;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const devices = [];

function log(msg) {
    console.log('\\x1b[32m[Runner]\\x1b[0m ' + msg);
}

function logError(msg) {
    console.error('\\x1b[31m[Runner]\\x1b[0m ' + msg);
}

function connect() {
    log('Connecting to coordinator...');

    ws = new WebSocket(COORDINATOR_URL);

    ws.on('open', () => {
        reconnectAttempts = 0;
        log('Connected! Sending hello...');

        // Send hello
        ws.send(JSON.stringify({
            type: 'runner:hello',
            token: TOKEN,
            name: RUNNER_NAME,
            platform: os.platform(),
            arch: os.arch()
        }));

        // Start heartbeat
        setInterval(sendHeartbeat, 10000);

        // Detect devices
        detectDevices();
    });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            handleMessage(msg);
        } catch (e) {
            logError('Invalid message: ' + e.message);
        }
    });

    ws.on('close', () => {
        log('Disconnected from coordinator');
        attemptReconnect();
    });

    ws.on('error', (err) => {
        logError('WebSocket error: ' + err.message);
    });
}

function attemptReconnect() {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        logError('Max reconnection attempts reached. Exiting.');
        process.exit(1);
    }

    reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
    log('Reconnecting in ' + (delay/1000) + 's (attempt ' + reconnectAttempts + ')');
    setTimeout(connect, delay);
}

function sendHeartbeat() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'runner:heartbeat',
            devices: devices
        }));
    }
}

function detectDevices() {
    devices.length = 0;

    // Detect Android devices
    const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
    if (androidHome) {
        exec(path.join(androidHome, 'platform-tools/adb') + ' devices', (err, stdout) => {
            if (!err) {
                const lines = stdout.split('\\n').slice(1);
                lines.forEach(line => {
                    const match = line.match(/^(\\S+)\\s+(device|emulator)/);
                    if (match) {
                        devices.push({
                            id: match[1],
                            name: match[1],
                            type: 'android',
                            status: 'online'
                        });
                    }
                });
                log('Found ' + devices.filter(d => d.type === 'android').length + ' Android device(s)');
            }
        });
    }

    // Detect iOS simulators (macOS only)
    if (os.platform() === 'darwin') {
        exec('xcrun simctl list devices booted -j', (err, stdout) => {
            if (!err) {
                try {
                    const data = JSON.parse(stdout);
                    Object.values(data.devices || {}).flat().forEach(device => {
                        if (device.state === 'Booted') {
                            devices.push({
                                id: device.udid,
                                name: device.name,
                                type: 'ios',
                                status: 'online'
                            });
                        }
                    });
                    log('Found ' + devices.filter(d => d.type === 'ios').length + ' iOS simulator(s)');
                } catch (e) {}
            }
        });
    }
}

function handleMessage(msg) {
    switch (msg.type) {
        case 'coordinator:welcome':
            log('✓ Registered with coordinator!');
            console.log('');
            console.log('\\x1b[32m╔══════════════════════════════════════════════╗\\x1b[0m');
            console.log('\\x1b[32m║\\x1b[0m  Runner is active and connected!             \\x1b[32m║\\x1b[0m');
            console.log('\\x1b[32m║\\x1b[0m  Press Ctrl+C to disconnect                  \\x1b[32m║\\x1b[0m');
            console.log('\\x1b[32m╚══════════════════════════════════════════════╝\\x1b[0m');
            console.log('');
            break;

        case 'job:request':
            handleJob(msg);
            break;

        case 'screenshot:request':
            handleScreenshot(msg);
            break;

        default:
            log('Unknown message type: ' + msg.type);
    }
}

function handleJob(msg) {
    log('Received job: ' + msg.jobType);

    switch (msg.jobType) {
        case 'screenshot':
            takeScreenshot(msg.jobId, msg.payload);
            break;

        case 'maestro':
            runMaestro(msg.jobId, msg.payload);
            break;

        case 'adb':
            runAdbCommand(msg.jobId, msg.payload);
            break;

        default:
            sendJobResult(msg.jobId, { success: false, error: 'Unknown job type' });
    }
}

function handleScreenshot(msg) {
    log('Screenshot request: ' + msg.requestId);
    takeScreenshot(msg.requestId, { name: msg.name, deviceId: msg.deviceId }, true);
}

function takeScreenshot(jobId, payload, isScreenshotRequest = false) {
    const deviceId = payload.deviceId;

    // Find device type from our devices list
    const device = devices.find(d => d.id === deviceId);
    const isIOS = device ? device.type === 'ios' : deviceId && deviceId.includes('-');

    let cmd;
    if (isIOS) {
        // iOS Simulator screenshot
        const tmpFile = '/tmp/screenshot-' + jobId + '.png';
        cmd = 'xcrun simctl io ' + deviceId + ' screenshot ' + tmpFile + ' && base64 < ' + tmpFile + ' && rm ' + tmpFile;
    } else {
        // Android screenshot
        const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
        const adb = androidHome ? path.join(androidHome, 'platform-tools/adb') : 'adb';
        const androidDeviceId = deviceId || 'emulator-5554';
        cmd = adb + ' -s ' + androidDeviceId + ' exec-out screencap -p | base64';
    }

    log('Taking screenshot: ' + (isIOS ? 'iOS' : 'Android') + ' device ' + deviceId);

    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout) => {
        if (err) {
            logError('Screenshot failed: ' + err.message);
            const result = { success: false, error: err.message };
            if (isScreenshotRequest) {
                ws.send(JSON.stringify({ type: 'screenshot:result', requestId: jobId, error: err.message }));
            } else {
                sendJobResult(jobId, result);
            }
            return;
        }

        const screenshot = {
            name: payload.name || 'screenshot',
            base64: stdout.trim(),
            timestamp: new Date().toISOString()
        };

        if (isScreenshotRequest) {
            ws.send(JSON.stringify({ type: 'screenshot:result', requestId: jobId, screenshot }));
        } else {
            sendJobResult(jobId, { success: true, screenshots: [screenshot] });
        }

        log('Screenshot captured successfully');
    });
}

function runMaestro(jobId, payload) {
    const flowContent = payload.flowContent;
    const tmpFile = '/tmp/clouddev-flow-' + jobId + '.yaml';

    require('fs').writeFileSync(tmpFile, flowContent);

    const maestro = spawn('maestro', ['test', tmpFile], {
        env: { ...process.env, PATH: process.env.PATH + ':' + os.homedir() + '/.maestro/bin' }
    });

    let output = '';
    maestro.stdout.on('data', (data) => { output += data.toString(); });
    maestro.stderr.on('data', (data) => { output += data.toString(); });

    maestro.on('close', (code) => {
        require('fs').unlinkSync(tmpFile);
        sendJobResult(jobId, {
            success: code === 0,
            logs: output,
            error: code !== 0 ? 'Maestro exited with code ' + code : undefined
        });
    });
}

function runAdbCommand(jobId, payload) {
    const androidHome = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
    const adb = androidHome ? path.join(androidHome, 'platform-tools/adb') : 'adb';

    exec(adb + ' ' + payload.command, (err, stdout, stderr) => {
        sendJobResult(jobId, {
            success: !err,
            data: { stdout, stderr },
            error: err ? err.message : undefined
        });
    });
}

function sendJobResult(jobId, result) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'job:result',
            jobId,
            result
        }));
    }
}

// Handle shutdown
process.on('SIGINT', () => {
    log('Shutting down...');
    if (ws) ws.close();
    process.exit(0);
});

// Start
connect();
`;
    }
}
