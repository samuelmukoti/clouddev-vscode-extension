/**
 * CloudDev Runner Types
 */

export interface RunnerConfig {
    port: number;
    token: string;
    android?: AndroidConfig;
    ios?: IOSConfig;
    vnc?: VNCConfig;
    coordinator?: CoordinatorConfig;
}

export interface AndroidConfig {
    enabled: boolean;
    adbPath?: string;
    avdName?: string;
    adbPort: number;
}

export interface IOSConfig {
    enabled: boolean;
    simulator?: string;
    xcrunPath?: string;
}

export interface VNCConfig {
    enabled: boolean;
    port: number;
    password?: string;
}

export interface CoordinatorConfig {
    url: string;
    heartbeatInterval: number;
}

export interface Device {
    id: string;
    name: string;
    type: 'android' | 'ios';
    status: 'online' | 'offline' | 'busy';
    platform?: string;
    model?: string;
}

export interface Job {
    id: string;
    type: 'maestro' | 'screenshot' | 'command';
    status: 'pending' | 'running' | 'completed' | 'failed';
    deviceId: string;
    payload: MaestroJobPayload | ScreenshotJobPayload | CommandJobPayload;
    result?: JobResult;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
}

export interface MaestroJobPayload {
    flowContent: string;
    flowName: string;
    env?: Record<string, string>;
}

export interface ScreenshotJobPayload {
    name?: string;
}

export interface CommandJobPayload {
    command: string;
    args?: string[];
}

export interface JobResult {
    success: boolean;
    output?: string;
    error?: string;
    screenshots?: Screenshot[];
    artifacts?: Artifact[];
}

export interface Screenshot {
    name: string;
    data: string; // base64
    timestamp: Date;
}

export interface Artifact {
    name: string;
    path: string;
    size: number;
}

export interface RunnerStatus {
    id: string;
    name: string;
    version: string;
    platform: NodeJS.Platform;
    uptime: number;
    devices: Device[];
    activeJobs: number;
    completedJobs: number;
}
