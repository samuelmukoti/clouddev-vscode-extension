/**
 * Runner Manager
 *
 * Manages WebSocket connections to remote runners.
 * Handles runner registration, heartbeats, and job dispatch.
 */

import { WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import {
    Runner,
    Device,
    Job,
    JobResult,
    WSMessage,
    RunnerHelloMessage,
    RunnerHeartbeatMessage,
    JobRequestMessage,
    RunnerInfo
} from '../types';

export class RunnerManager extends EventEmitter {
    private runners: Map<string, Runner> = new Map();
    private jobs: Map<string, Job> = new Map();
    private pendingJobs: Map<string, { resolve: (result: JobResult) => void; reject: (err: Error) => void }> = new Map();
    private readonly HEARTBEAT_TIMEOUT = 30000; // 30 seconds

    constructor() {
        super();
        // Check for stale runners periodically
        setInterval(() => this.checkHeartbeats(), 10000);
    }

    /**
     * Handle new WebSocket connection from a runner
     */
    handleConnection(ws: WebSocket, token: string): void {
        const runnerId = uuidv4();

        // Wait for hello message
        const timeout = setTimeout(() => {
            console.log(`Runner ${runnerId} did not send hello, closing`);
            ws.close();
        }, 5000);

        ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString()) as WSMessage;
                this.handleMessage(runnerId, ws, token, message, timeout);
            } catch (err) {
                console.error('Invalid message from runner:', err);
            }
        });

        ws.on('close', () => {
            this.handleDisconnect(runnerId);
        });

        ws.on('error', (err) => {
            console.error(`Runner ${runnerId} error:`, err);
        });
    }

    /**
     * Handle incoming message from runner
     */
    private handleMessage(
        runnerId: string,
        ws: WebSocket,
        token: string,
        message: WSMessage,
        helloTimeout?: NodeJS.Timeout
    ): void {
        switch (message.type) {
            case 'runner:hello':
                if (helloTimeout) clearTimeout(helloTimeout);
                this.registerRunner(runnerId, ws, token, message as RunnerHelloMessage);
                break;

            case 'runner:heartbeat':
                this.handleHeartbeat(runnerId, message as RunnerHeartbeatMessage);
                break;

            case 'runner:devices':
                this.updateDevices(runnerId, (message as unknown as { devices: Device[] }).devices);
                break;

            case 'job:result':
                this.handleJobResult(message.jobId, message.result);
                break;

            case 'screenshot:result':
                // Handle as job result
                if (this.pendingJobs.has(message.requestId)) {
                    const pending = this.pendingJobs.get(message.requestId)!;
                    if (message.error) {
                        pending.reject(new Error(message.error));
                    } else {
                        pending.resolve({
                            success: true,
                            screenshots: message.screenshot ? [message.screenshot] : []
                        });
                    }
                    this.pendingJobs.delete(message.requestId);
                }
                break;

            default:
                console.warn('Unknown message type:', (message as { type: string }).type);
        }
    }

    /**
     * Register a new runner
     */
    private registerRunner(
        runnerId: string,
        ws: WebSocket,
        token: string,
        hello: RunnerHelloMessage
    ): void {
        const runner: Runner = {
            id: runnerId,
            name: hello.name,
            token,
            ws,
            platform: hello.platform,
            arch: hello.arch,
            devices: [],
            status: 'online',
            connectedAt: new Date(),
            lastHeartbeat: new Date()
        };

        this.runners.set(runnerId, runner);

        console.log(`Runner registered: ${runner.name} (${runner.platform}/${runner.arch})`);

        // Notify listeners
        this.emit('runner:connected', this.getRunnerInfo(runner));

        // Send acknowledgment
        ws.send(JSON.stringify({
            type: 'coordinator:welcome',
            runnerId,
            message: 'Connected to CloudDev Coordinator'
        }));
    }

    /**
     * Handle runner heartbeat
     */
    private handleHeartbeat(runnerId: string, message: RunnerHeartbeatMessage): void {
        const runner = this.runners.get(runnerId);
        if (runner) {
            runner.lastHeartbeat = new Date();
            runner.devices = message.devices;
            this.emit('runner:heartbeat', this.getRunnerInfo(runner));
        }
    }

    /**
     * Update runner devices
     */
    private updateDevices(runnerId: string, devices: Device[]): void {
        const runner = this.runners.get(runnerId);
        if (runner) {
            runner.devices = devices;
            this.emit('runner:devices', { runnerId, devices });
        }
    }

    /**
     * Handle runner disconnect
     */
    private handleDisconnect(runnerId: string): void {
        const runner = this.runners.get(runnerId);
        if (runner) {
            console.log(`Runner disconnected: ${runner.name}`);
            this.runners.delete(runnerId);
            this.emit('runner:disconnected', runnerId);
        }
    }

    /**
     * Check for stale runners (missed heartbeats)
     */
    private checkHeartbeats(): void {
        const now = Date.now();
        for (const [runnerId, runner] of this.runners.entries()) {
            if (now - runner.lastHeartbeat.getTime() > this.HEARTBEAT_TIMEOUT) {
                console.log(`Runner ${runner.name} timed out`);
                runner.ws.close();
                this.handleDisconnect(runnerId);
            }
        }
    }

    /**
     * Send job to a runner
     */
    async dispatchJob(
        runnerId: string,
        jobType: Job['type'],
        payload: Record<string, unknown>
    ): Promise<JobResult> {
        const runner = this.runners.get(runnerId);
        if (!runner) {
            throw new Error(`Runner ${runnerId} not found`);
        }

        if (runner.status === 'offline') {
            throw new Error(`Runner ${runner.name} is offline`);
        }

        const jobId = uuidv4();
        const job: Job = {
            id: jobId,
            type: jobType,
            runnerId,
            status: 'pending',
            payload,
            createdAt: new Date()
        };

        this.jobs.set(jobId, job);

        // Send job to runner
        const request: JobRequestMessage = {
            type: 'job:request',
            jobId,
            jobType,
            payload
        };

        runner.ws.send(JSON.stringify(request));
        runner.status = 'busy';
        job.status = 'running';
        job.startedAt = new Date();

        // Wait for result
        return new Promise((resolve, reject) => {
            this.pendingJobs.set(jobId, { resolve, reject });

            // Timeout after 5 minutes
            setTimeout(() => {
                if (this.pendingJobs.has(jobId)) {
                    this.pendingJobs.delete(jobId);
                    reject(new Error('Job timed out'));
                }
            }, 5 * 60 * 1000);
        });
    }

    /**
     * Handle job result from runner
     */
    private handleJobResult(jobId: string, result: JobResult): void {
        const job = this.jobs.get(jobId);
        if (job) {
            job.status = result.success ? 'completed' : 'failed';
            job.result = result;
            job.completedAt = new Date();

            const runner = this.runners.get(job.runnerId);
            if (runner) {
                runner.status = 'online';
            }
        }

        const pending = this.pendingJobs.get(jobId);
        if (pending) {
            pending.resolve(result);
            this.pendingJobs.delete(jobId);
        }
    }

    /**
     * Take screenshot on a runner
     */
    async takeScreenshot(runnerId: string, deviceId?: string, name?: string): Promise<JobResult> {
        return this.dispatchJob(runnerId, 'screenshot', { deviceId, name });
    }

    /**
     * Run Maestro flow on a runner
     */
    async runMaestroFlow(
        runnerId: string,
        flowContent: string,
        deviceId?: string
    ): Promise<JobResult> {
        return this.dispatchJob(runnerId, 'maestro', { flowContent, deviceId });
    }

    /**
     * Get runner info (without WebSocket)
     */
    private getRunnerInfo(runner: Runner): RunnerInfo {
        return {
            id: runner.id,
            name: runner.name,
            platform: runner.platform,
            status: runner.status,
            devices: runner.devices
        };
    }

    /**
     * Get all connected runners
     */
    getRunners(): RunnerInfo[] {
        return Array.from(this.runners.values()).map(r => this.getRunnerInfo(r));
    }

    /**
     * Get a specific runner
     */
    getRunner(runnerId: string): RunnerInfo | null {
        const runner = this.runners.get(runnerId);
        return runner ? this.getRunnerInfo(runner) : null;
    }

    /**
     * Get runner by token
     */
    getRunnerByToken(token: string): RunnerInfo | null {
        for (const runner of this.runners.values()) {
            if (runner.token === token) {
                return this.getRunnerInfo(runner);
            }
        }
        return null;
    }

    /**
     * Send raw message to runner
     */
    sendToRunner(runnerId: string, message: object): boolean {
        const runner = this.runners.get(runnerId);
        if (runner && runner.ws.readyState === WebSocket.OPEN) {
            runner.ws.send(JSON.stringify(message));
            return true;
        }
        return false;
    }
}
