/**
 * CloudDev Coordinator Server
 *
 * HTTP + WebSocket server that:
 * - Generates magic setup links
 * - Accepts runner connections
 * - Dispatches jobs to runners
 * - Provides API for VS Code extension
 */

import express, { Request, Response, NextFunction } from 'express';
import { createServer, Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { MagicLinkService } from './services/MagicLinkService';
import { RunnerManager } from './services/RunnerManager';
import { SetupScriptGenerator } from './services/SetupScriptGenerator';
import { RunnerInfo } from './types';

export interface CoordinatorOptions {
    port: number;
    baseUrl?: string;
}

export class CoordinatorServer {
    private app: express.Application;
    private server: HttpServer;
    private wss: WebSocketServer;
    private magicLinks: MagicLinkService;
    private runners: RunnerManager;
    private scriptGenerator: SetupScriptGenerator;
    private options: CoordinatorOptions;
    private clientConnections: Set<WebSocket> = new Set();

    constructor(options: CoordinatorOptions) {
        this.options = options;
        this.app = express();
        this.server = createServer(this.app);
        this.wss = new WebSocketServer({ server: this.server });

        this.magicLinks = new MagicLinkService();
        this.runners = new RunnerManager();
        this.scriptGenerator = new SetupScriptGenerator();

        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
        this.setupRunnerEvents();
    }

    private setupMiddleware(): void {
        this.app.use(express.json());

        // CORS for VS Code extension
        this.app.use((req: Request, res: Response, next: NextFunction) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
                return;
            }
            next();
        });
    }

    private setupRoutes(): void {
        // Health check
        this.app.get('/health', (req: Request, res: Response) => {
            res.json({
                status: 'ok',
                runners: this.runners.getRunners().length,
                uptime: process.uptime()
            });
        });

        // Generate magic link
        this.app.post('/api/v1/magic-link', (req: Request, res: Response) => {
            const link = this.magicLinks.generate();
            const baseUrl = this.options.baseUrl || `http://localhost:${this.options.port}`;

            res.json({
                code: link.code,
                url: `${baseUrl}/r/${link.code}`,
                expiresAt: link.expiresAt.toISOString(),
                command: `curl -sL "${baseUrl}/r/${link.code}" | bash`
            });
        });

        // Serve setup script (magic link endpoint)
        this.app.get('/r/:code', (req: Request, res: Response) => {
            const { code } = req.params;

            // Consume the magic link and get the token
            const token = this.magicLinks.consume(code);

            if (!token) {
                res.status(404).send(`#!/bin/bash
echo ""
echo "\\033[0;31m✗ Invalid or expired setup link\\033[0m"
echo ""
echo "This link may have:"
echo "  • Already been used"
echo "  • Expired (links are valid for 10 minutes)"
echo ""
echo "Please generate a new link from VS Code:"
echo "  Cmd+Shift+P → 'CloudDev: Add Remote Runner'"
echo ""
exit 1
`);
                return;
            }

            const baseUrl = this.options.baseUrl || `http://localhost:${this.options.port}`;
            const script = this.scriptGenerator.generate({
                coordinatorUrl: baseUrl,
                token
            });

            res.type('text/plain').send(script);
        });

        // List runners
        this.app.get('/api/v1/runners', (req: Request, res: Response) => {
            res.json({
                runners: this.runners.getRunners()
            });
        });

        // Get specific runner
        this.app.get('/api/v1/runners/:id', (req: Request, res: Response) => {
            const runner = this.runners.getRunner(req.params.id);
            if (!runner) {
                res.status(404).json({ error: 'Runner not found' });
                return;
            }
            res.json(runner);
        });

        // Take screenshot
        this.app.post('/api/v1/runners/:id/screenshot', async (req: Request, res: Response) => {
            const { id } = req.params;
            const { deviceId, name } = req.body;

            try {
                const result = await this.runners.takeScreenshot(id, deviceId, name);
                res.json(result);
            } catch (err) {
                res.status(500).json({ error: (err as Error).message });
            }
        });

        // Run Maestro flow
        this.app.post('/api/v1/runners/:id/maestro', async (req: Request, res: Response) => {
            const { id } = req.params;
            const { flowContent, deviceId } = req.body;

            if (!flowContent) {
                res.status(400).json({ error: 'flowContent is required' });
                return;
            }

            try {
                const result = await this.runners.runMaestroFlow(id, flowContent, deviceId);
                res.json(result);
            } catch (err) {
                res.status(500).json({ error: (err as Error).message });
            }
        });

        // Dispatch generic job
        this.app.post('/api/v1/runners/:id/jobs', async (req: Request, res: Response) => {
            const { id } = req.params;
            const { type, payload } = req.body;

            try {
                const result = await this.runners.dispatchJob(id, type, payload);
                res.json(result);
            } catch (err) {
                res.status(500).json({ error: (err as Error).message });
            }
        });

        // Status page (simple HTML)
        this.app.get('/', (req: Request, res: Response) => {
            const runners = this.runners.getRunners();
            const baseUrl = this.options.baseUrl || `http://localhost:${this.options.port}`;
            res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>CloudDev Runner Coordinator</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 900px;
            margin: 0 auto;
            padding: 40px 20px;
            background: #f8f9fa;
            color: #333;
        }
        h1 { color: #1a1a2e; margin-bottom: 10px; }
        h2 { color: #16213e; margin-top: 30px; border-bottom: 2px solid #e0e0e0; padding-bottom: 10px; }
        .status-bar {
            display: flex;
            gap: 20px;
            margin-bottom: 30px;
        }
        .status-item {
            background: white;
            padding: 15px 25px;
            border-radius: 10px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        .status-item strong { font-size: 24px; color: #4caf50; }

        /* Magic Link Section */
        .magic-link-section {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 15px;
            margin: 20px 0;
        }
        .magic-link-section h2 { color: white; border: none; margin-top: 0; }
        .generate-btn {
            background: white;
            color: #667eea;
            border: none;
            padding: 15px 30px;
            font-size: 16px;
            font-weight: 600;
            border-radius: 8px;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .generate-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 5px 20px rgba(0,0,0,0.2);
        }
        .magic-link-result {
            display: none;
            margin-top: 20px;
            background: rgba(255,255,255,0.15);
            padding: 20px;
            border-radius: 10px;
        }
        .magic-link-result.show { display: block; }
        .command-box {
            background: #1a1a2e;
            color: #4caf50;
            padding: 15px;
            border-radius: 8px;
            font-family: 'Monaco', 'Menlo', monospace;
            font-size: 14px;
            word-break: break-all;
            margin: 15px 0;
            position: relative;
        }
        .copy-btn {
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            background: #4caf50;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 12px;
        }
        .copy-btn:hover { background: #45a049; }
        .qr-code {
            text-align: center;
            margin-top: 20px;
        }
        .qr-code img {
            background: white;
            padding: 10px;
            border-radius: 10px;
        }
        .expires { font-size: 14px; opacity: 0.8; }

        /* Runners */
        .runner {
            background: white;
            padding: 20px;
            margin: 15px 0;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            border-left: 4px solid #4caf50;
        }
        .runner.offline { border-left-color: #f44336; }
        .runner.busy { border-left-color: #ff9800; }
        .runner-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        .runner-name { font-size: 18px; font-weight: 600; }
        .runner-platform { color: #666; font-size: 14px; }
        .runner-status {
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .runner-status.online { background: #e8f5e9; color: #2e7d32; }
        .runner-status.offline { background: #ffebee; color: #c62828; }
        .runner-status.busy { background: #fff3e0; color: #ef6c00; }
        .device {
            background: #f5f5f5;
            padding: 12px 15px;
            margin: 8px 0;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 5px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
        }
        .badge-android { background: #a4c639; color: white; }
        .badge-ios { background: #333; color: white; }
        .no-runners {
            text-align: center;
            padding: 40px;
            color: #666;
        }
        .no-runners-icon { font-size: 48px; margin-bottom: 15px; }

        /* Actions */
        .runner-actions {
            margin-top: 15px;
            display: flex;
            gap: 10px;
        }
        .action-btn {
            background: #667eea;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 13px;
        }
        .action-btn:hover { background: #5a6fd6; }
        .action-btn.secondary { background: #e0e0e0; color: #333; }
    </style>
</head>
<body>
    <h1>🚀 CloudDev Runner Coordinator</h1>

    <div class="status-bar">
        <div class="status-item">
            <div>Status</div>
            <strong style="color: #4caf50;">● Online</strong>
        </div>
        <div class="status-item">
            <div>Connected Runners</div>
            <strong>${runners.length}</strong>
        </div>
    </div>

    <div class="magic-link-section">
        <h2>➕ Add Remote Runner</h2>
        <p>Generate a magic link to connect a Mac or PC as a remote runner.</p>
        <button class="generate-btn" onclick="generateMagicLink()">
            🔗 Generate Setup Link
        </button>

        <div id="magicLinkResult" class="magic-link-result">
            <p><strong>Run this command on your Mac or PC:</strong></p>
            <div class="command-box">
                <span id="commandText"></span>
                <button class="copy-btn" onclick="copyCommand()">📋 Copy</button>
            </div>
            <p class="expires">⏱️ Link expires in <span id="expiresIn">10 minutes</span></p>
            <div class="qr-code">
                <p>Or scan this QR code:</p>
                <img id="qrCode" src="" alt="QR Code" width="150" height="150">
            </div>
        </div>
    </div>

    <h2>📱 Connected Runners</h2>
    ${runners.length === 0 ? `
        <div class="no-runners">
            <div class="no-runners-icon">🖥️</div>
            <p>No runners connected yet.</p>
            <p>Generate a magic link above to add your first runner!</p>
        </div>
    ` : runners.map(r => `
        <div class="runner ${r.status}">
            <div class="runner-header">
                <div>
                    <span class="runner-name">${r.name}</span>
                    <span class="runner-platform">${r.platform}</span>
                </div>
                <span class="runner-status ${r.status}">${r.status}</span>
            </div>
            <div class="devices">
                ${r.devices.length === 0 ? '<p style="color: #999; margin: 0;">No devices detected</p>' : ''}
                ${r.devices.map(d => `
                    <div class="device">
                        <span class="badge badge-${d.type}">${d.type}</span>
                        <span>${d.name}</span>
                        <span style="margin-left: auto; color: ${d.status === 'online' ? '#4caf50' : '#999'};">● ${d.status}</span>
                    </div>
                `).join('')}
            </div>
            <div class="runner-actions">
                <button class="action-btn" onclick="takeScreenshot('${r.id}', '${r.devices[0]?.id || ''}')">📸 Screenshot</button>
                <button class="action-btn" onclick="showFlowModal('${r.id}', '${r.devices[0]?.id || ''}')">🎬 Run Flow</button>
                <button class="action-btn secondary" onclick="disconnectRunner('${r.id}')">Disconnect</button>
            </div>
        </div>
    `).join('')}

    <!-- Flow Modal -->
    <div id="flowModal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:1000;">
        <div style="background:white; max-width:600px; margin:50px auto; padding:25px; border-radius:15px;">
            <h3 style="margin-top:0;">🎬 Run Maestro Flow</h3>
            <textarea id="flowContent" style="width:100%; height:200px; font-family:monospace; padding:10px; border:1px solid #ddd; border-radius:8px;" placeholder="appId: com.apple.Preferences
---
- launchApp
- waitForAnimationToEnd
- takeScreenshot: test"></textarea>
            <div style="margin-top:15px; display:flex; gap:10px;">
                <button onclick="runFlow()" style="background:#667eea; color:white; border:none; padding:12px 25px; border-radius:8px; cursor:pointer;">▶️ Run Flow</button>
                <button onclick="hideFlowModal()" style="background:#eee; border:none; padding:12px 25px; border-radius:8px; cursor:pointer;">Cancel</button>
            </div>
            <div id="flowResult" style="margin-top:15px; display:none; background:#f5f5f5; padding:15px; border-radius:8px; max-height:200px; overflow:auto;">
                <pre id="flowOutput" style="margin:0; white-space:pre-wrap;"></pre>
            </div>
        </div>
    </div>

    <script>
        let currentCommand = '';
        // Use the current page's origin for API calls
        const API_BASE = window.location.origin;

        async function generateMagicLink() {
            const btn = document.querySelector('.generate-btn');
            btn.textContent = '⏳ Generating...';
            btn.disabled = true;

            try {
                const res = await fetch(API_BASE + '/api/v1/magic-link', { method: 'POST' });
                const text = await res.text();
                console.log('Response:', res.status, text);

                if (!res.ok) {
                    throw new Error('Server error: ' + res.status + ' - ' + text);
                }

                const data = JSON.parse(text);
                currentCommand = data.command;
                document.getElementById('commandText').textContent = data.command;

                // Generate QR code using a public API
                const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' +
                    encodeURIComponent(data.command);
                document.getElementById('qrCode').src = qrUrl;

                // Calculate time remaining
                const expiresAt = new Date(data.expiresAt);
                const mins = Math.round((expiresAt - new Date()) / 60000);
                document.getElementById('expiresIn').textContent = mins + ' minutes';

                document.getElementById('magicLinkResult').classList.add('show');
            } catch (err) {
                alert('Failed to generate link: ' + err.message);
            }

            btn.textContent = '🔗 Generate New Link';
            btn.disabled = false;
        }

        function copyCommand() {
            navigator.clipboard.writeText(currentCommand).then(() => {
                const btn = document.querySelector('.copy-btn');
                btn.textContent = '✓ Copied!';
                setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
            });
        }

        async function takeScreenshot(runnerId, deviceId) {
            try {
                const res = await fetch(API_BASE + '/api/v1/runners/' + runnerId + '/screenshot', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ deviceId: deviceId || undefined })
                });
                const data = await res.json();
                if (data.error) {
                    alert('Screenshot failed: ' + data.error);
                    return;
                }
                if (data.screenshots && data.screenshots[0]) {
                    // Open screenshot in new tab
                    const img = 'data:image/png;base64,' + data.screenshots[0].base64;
                    const win = window.open();
                    win.document.write('<img src="' + img + '" style="max-width:100%;">');
                }
            } catch (err) {
                alert('Screenshot failed: ' + err.message);
            }
        }

        // Flow modal
        let currentFlowRunner = '';
        let currentFlowDevice = '';

        function showFlowModal(runnerId, deviceId) {
            currentFlowRunner = runnerId;
            currentFlowDevice = deviceId;
            document.getElementById('flowModal').style.display = 'block';
            document.getElementById('flowResult').style.display = 'none';
        }

        function hideFlowModal() {
            document.getElementById('flowModal').style.display = 'none';
        }

        async function runFlow() {
            const flowContent = document.getElementById('flowContent').value;
            if (!flowContent.trim()) {
                alert('Please enter a flow');
                return;
            }

            document.getElementById('flowResult').style.display = 'block';
            document.getElementById('flowOutput').textContent = 'Running flow...';

            try {
                const res = await fetch(API_BASE + '/api/v1/runners/' + currentFlowRunner + '/maestro', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ flowContent, deviceId: currentFlowDevice || undefined })
                });
                const data = await res.json();
                if (data.error) {
                    document.getElementById('flowOutput').textContent = '❌ Error: ' + data.error;
                } else if (data.success) {
                    document.getElementById('flowOutput').textContent = '✅ Flow completed!\\n\\n' + (data.logs || '');
                } else {
                    document.getElementById('flowOutput').textContent = '❌ Flow failed\\n\\n' + (data.logs || data.error || 'Unknown error');
                }
            } catch (err) {
                document.getElementById('flowOutput').textContent = '❌ Error: ' + err.message;
            }
        }

        function disconnectRunner(runnerId) {
            if (confirm('Disconnect this runner?')) {
                // TODO: Implement disconnect
                alert('Disconnect not implemented yet');
            }
        }

        // Auto-refresh runners every 5 seconds
        setInterval(() => {
            fetch(API_BASE + '/api/v1/runners')
                .then(r => r.json())
                .then(data => {
                    if (data.runners.length !== ${runners.length}) {
                        location.reload();
                    }
                });
        }, 5000);
    </script>
</body>
</html>
            `);
        });
    }

    private setupWebSocket(): void {
        this.wss.on('connection', (ws: WebSocket, req) => {
            const url = new URL(req.url || '/', `http://localhost`);

            // Runner connection (from setup script)
            if (url.pathname === '/ws') {
                // Token is sent in the hello message
                this.runners.handleConnection(ws, '');
                return;
            }

            // Client connection (from VS Code extension)
            if (url.pathname === '/client') {
                this.handleClientConnection(ws);
                return;
            }

            ws.close();
        });
    }

    private handleClientConnection(ws: WebSocket): void {
        console.log('Client connected');
        this.clientConnections.add(ws);

        // Send current status
        ws.send(JSON.stringify({
            type: 'coordinator:status',
            runners: this.runners.getRunners()
        }));

        ws.on('close', () => {
            this.clientConnections.delete(ws);
        });

        ws.on('message', (data) => {
            // Handle client requests (e.g., take screenshot)
            try {
                const msg = JSON.parse(data.toString());
                this.handleClientMessage(ws, msg);
            } catch (e) {
                console.error('Invalid client message');
            }
        });
    }

    private handleClientMessage(ws: WebSocket, msg: { type: string; [key: string]: unknown }): void {
        switch (msg.type) {
            case 'screenshot':
                this.runners.takeScreenshot(msg.runnerId as string, msg.deviceId as string)
                    .then(result => {
                        ws.send(JSON.stringify({ type: 'screenshot:result', ...result }));
                    })
                    .catch(err => {
                        ws.send(JSON.stringify({ type: 'screenshot:error', error: err.message }));
                    });
                break;
        }
    }

    private setupRunnerEvents(): void {
        // Broadcast runner events to all connected clients
        this.runners.on('runner:connected', (runner: RunnerInfo) => {
            this.broadcastToClients({
                type: 'runner:connected',
                runner
            });
        });

        this.runners.on('runner:disconnected', (runnerId: string) => {
            this.broadcastToClients({
                type: 'runner:disconnected',
                runnerId
            });
        });

        this.runners.on('runner:heartbeat', (runner: RunnerInfo) => {
            this.broadcastToClients({
                type: 'runner:updated',
                runner
            });
        });
    }

    private broadcastToClients(message: object): void {
        const data = JSON.stringify(message);
        for (const client of this.clientConnections) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(data);
            }
        }
    }

    /**
     * Start the server
     */
    start(): Promise<void> {
        return new Promise((resolve) => {
            this.server.listen(this.options.port, () => {
                console.log(`CloudDev Coordinator running on port ${this.options.port}`);
                resolve();
            });
        });
    }

    /**
     * Stop the server
     */
    stop(): Promise<void> {
        return new Promise((resolve) => {
            this.wss.close();
            this.server.close(() => resolve());
        });
    }

    /**
     * Get runner manager (for programmatic access)
     */
    getRunnerManager(): RunnerManager {
        return this.runners;
    }

    /**
     * Get magic link service
     */
    getMagicLinkService(): MagicLinkService {
        return this.magicLinks;
    }
}
