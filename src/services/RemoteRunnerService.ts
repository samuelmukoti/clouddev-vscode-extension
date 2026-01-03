/**
 * Remote Runner Service
 *
 * Manages communication with the CloudDev coordinator for remote runners.
 * Handles runner discovery, screenshot capture, and Maestro flow execution.
 */

import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';

export interface Runner {
    id: string;
    name: string;
    platform: string;
    status: 'online' | 'offline' | 'busy';
    devices: Device[];
}

export interface Device {
    id: string;
    name: string;
    type: 'android' | 'ios';
    status: 'online' | 'offline';
}

export interface MagicLink {
    code: string;
    url: string;
    expiresAt: string;
    command: string;
}

export class RemoteRunnerService {
    private coordinatorUrl: string = '';
    private outputChannel: vscode.OutputChannel;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('CloudDev Remote Runners');
    }

    /**
     * Initialize the service with coordinator URL
     */
    initialize(context: vscode.ExtensionContext): void {
        this.updateCoordinatorUrl();

        // Listen for configuration changes
        context.subscriptions.push(
            vscode.workspace.onDidChangeConfiguration(e => {
                if (e.affectsConfiguration('clouddev.coordinator')) {
                    this.updateCoordinatorUrl();
                }
            })
        );
    }

    /**
     * Update coordinator URL from settings
     */
    private updateCoordinatorUrl(): void {
        const config = vscode.workspace.getConfiguration('clouddev.coordinator');
        const externalUrl = config.get<string>('externalUrl', '');
        const port = config.get<number>('port', 7800);

        if (externalUrl) {
            this.coordinatorUrl = externalUrl;
        } else {
            this.coordinatorUrl = `http://localhost:${port}`;
        }

        this.log(`Coordinator URL: ${this.coordinatorUrl}`);
    }

    /**
     * Log message to output channel
     */
    private log(message: string): void {
        const timestamp = new Date().toLocaleTimeString();
        this.outputChannel.appendLine(`[${timestamp}] ${message}`);
    }

    /**
     * Make HTTP request to coordinator
     */
    private async request<T>(
        method: 'GET' | 'POST' | 'DELETE',
        path: string,
        body?: object
    ): Promise<T> {
        return new Promise((resolve, reject) => {
            const url = new URL(path, this.coordinatorUrl);
            const isHttps = url.protocol === 'https:';
            const httpModule = isHttps ? https : http;

            const options: http.RequestOptions = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            const req = httpModule.request(options, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        const json = JSON.parse(data);
                        if (res.statusCode && res.statusCode >= 400) {
                            reject(new Error(json.error || `HTTP ${res.statusCode}`));
                        } else {
                            resolve(json);
                        }
                    } catch {
                        reject(new Error(`Invalid JSON response: ${data.substring(0, 100)}`));
                    }
                });
            });

            req.on('error', reject);
            req.setTimeout(30000, () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (body) {
                req.write(JSON.stringify(body));
            }
            req.end();
        });
    }

    /**
     * Check if coordinator is running
     */
    async checkHealth(): Promise<boolean> {
        try {
            await this.request<{ status: string }>('GET', '/health');
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get list of connected runners
     */
    async getRunners(): Promise<Runner[]> {
        const response = await this.request<{ runners: Runner[] }>('GET', '/api/v1/runners');
        return response.runners;
    }

    /**
     * Generate a magic link for runner setup
     */
    async generateMagicLink(): Promise<MagicLink> {
        return this.request<MagicLink>('POST', '/api/v1/magic-link');
    }

    /**
     * Take screenshot on a remote runner
     */
    async takeScreenshot(runnerId: string, deviceId?: string): Promise<{ base64: string; name: string }> {
        const result = await this.request<{
            screenshots?: Array<{ base64: string; name: string }>;
            error?: string;
        }>('POST', `/api/v1/runners/${runnerId}/screenshot`, { deviceId });

        if (result.error) {
            throw new Error(result.error);
        }

        if (!result.screenshots || result.screenshots.length === 0) {
            throw new Error('No screenshot captured');
        }

        return result.screenshots[0];
    }

    /**
     * Run Maestro flow on a remote runner
     */
    async runMaestroFlow(
        runnerId: string,
        flowContent: string,
        deviceId?: string
    ): Promise<{ success: boolean; logs?: string; error?: string }> {
        return this.request('POST', `/api/v1/runners/${runnerId}/maestro`, {
            flowContent,
            deviceId
        });
    }

    /**
     * Open runner dashboard in browser
     */
    openDashboard(): void {
        vscode.env.openExternal(vscode.Uri.parse(this.coordinatorUrl));
    }

    /**
     * Show runner selection quick pick
     */
    async selectRunner(): Promise<Runner | undefined> {
        const runners = await this.getRunners();

        if (runners.length === 0) {
            vscode.window.showWarningMessage(
                'No remote runners connected. Use "CloudDev: Add Remote Runner" to add one.'
            );
            return undefined;
        }

        const items = runners.map(r => ({
            label: r.name,
            description: `${r.platform} - ${r.status}`,
            detail: r.devices.length > 0
                ? `Devices: ${r.devices.map(d => d.name).join(', ')}`
                : 'No devices',
            runner: r
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a remote runner'
        });

        return selected?.runner;
    }

    /**
     * Show device selection quick pick
     */
    async selectDevice(runner: Runner): Promise<Device | undefined> {
        if (runner.devices.length === 0) {
            vscode.window.showWarningMessage(`No devices available on ${runner.name}`);
            return undefined;
        }

        if (runner.devices.length === 1) {
            return runner.devices[0];
        }

        const items = runner.devices.map(d => ({
            label: d.name,
            description: `${d.type} - ${d.status}`,
            device: d
        }));

        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: 'Select a device'
        });

        return selected?.device;
    }

    /**
     * Get coordinator URL
     */
    getCoordinatorUrl(): string {
        return this.coordinatorUrl;
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.outputChannel.dispose();
    }
}
