/**
 * CloudDev Coordinator Types
 */

import { WebSocket } from 'ws';

export interface MagicLink {
    code: string;
    token: string;
    createdAt: Date;
    expiresAt: Date;
    used: boolean;
}

export interface Runner {
    id: string;
    name: string;
    token: string;
    ws: WebSocket;
    platform: string;
    arch: string;
    devices: Device[];
    status: 'connecting' | 'online' | 'busy' | 'offline';
    connectedAt: Date;
    lastHeartbeat: Date;
}

export interface Device {
    id: string;
    name: string;
    type: 'android' | 'ios';
    status: 'booting' | 'online' | 'offline' | 'busy';
    platform?: string;
    model?: string;
}

export interface Job {
    id: string;
    type: 'screenshot' | 'maestro' | 'adb' | 'simctl';
    runnerId: string;
    deviceId?: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    payload: Record<string, unknown>;
    result?: JobResult;
    createdAt: Date;
    startedAt?: Date;
    completedAt?: Date;
}

export interface JobResult {
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
    screenshots?: ScreenshotData[];
    logs?: string;
}

export interface ScreenshotData {
    name: string;
    base64: string;
    width?: number;
    height?: number;
    timestamp: Date;
}

// WebSocket Messages
export type WSMessage =
    | RunnerHelloMessage
    | RunnerHeartbeatMessage
    | RunnerDevicesMessage
    | JobRequestMessage
    | JobResultMessage
    | ScreenshotRequestMessage
    | ScreenshotResultMessage
    | VNCRequestMessage
    | ErrorMessage;

export interface RunnerHelloMessage {
    type: 'runner:hello';
    token: string;
    name: string;
    platform: string;
    arch: string;
}

export interface RunnerHeartbeatMessage {
    type: 'runner:heartbeat';
    devices: Device[];
}

export interface RunnerDevicesMessage {
    type: 'runner:devices';
    devices: Device[];
}

export interface JobRequestMessage {
    type: 'job:request';
    jobId: string;
    jobType: Job['type'];
    payload: Record<string, unknown>;
}

export interface JobResultMessage {
    type: 'job:result';
    jobId: string;
    result: JobResult;
}

export interface ScreenshotRequestMessage {
    type: 'screenshot:request';
    requestId: string;
    deviceId?: string;
    name?: string;
}

export interface ScreenshotResultMessage {
    type: 'screenshot:result';
    requestId: string;
    screenshot?: ScreenshotData;
    error?: string;
}

export interface VNCRequestMessage {
    type: 'vnc:request';
    deviceId: string;
}

export interface ErrorMessage {
    type: 'error';
    message: string;
    code?: string;
}

// Coordinator -> Client messages
export interface CoordinatorStatusMessage {
    type: 'coordinator:status';
    runners: RunnerInfo[];
}

export interface RunnerInfo {
    id: string;
    name: string;
    platform: string;
    status: Runner['status'];
    devices: Device[];
}

export interface RunnerConnectedMessage {
    type: 'runner:connected';
    runner: RunnerInfo;
}

export interface RunnerDisconnectedMessage {
    type: 'runner:disconnected';
    runnerId: string;
}
