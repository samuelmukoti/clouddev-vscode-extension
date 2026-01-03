/**
 * CloudDev Error Handling Utilities
 *
 * Provides custom error types and user-friendly error messages.
 */

import * as vscode from 'vscode';

/**
 * Error codes for CloudDev extension errors
 */
export enum ErrorCode {
    CONFIG_NOT_FOUND = 'CONFIG_NOT_FOUND',
    CONFIG_INVALID = 'CONFIG_INVALID',
    FIELD_MISSING = 'FIELD_MISSING',
    URL_INVALID = 'URL_INVALID',
    TERMINAL_FAILED = 'TERMINAL_FAILED',
    WEBVIEW_FAILED = 'WEBVIEW_FAILED',
    NO_WORKSPACE = 'NO_WORKSPACE'
}

/**
 * Custom error class for CloudDev extension errors
 */
export class CloudDevError extends Error {
    constructor(
        message: string,
        public readonly code: ErrorCode,
        public readonly field?: string
    ) {
        super(message);
        this.name = 'CloudDevError';
    }

    /**
     * Returns a user-friendly error message for display
     */
    get userMessage(): string {
        return this.message;
    }
}

/**
 * Creates a "config not found" error
 */
export function configNotFoundError(): CloudDevError {
    return new CloudDevError(
        'CloudDev: .clouddev.json not found in workspace root',
        ErrorCode.CONFIG_NOT_FOUND
    );
}

/**
 * Creates a "config invalid" error
 */
export function configInvalidError(details?: string): CloudDevError {
    const message = details
        ? `CloudDev: .clouddev.json is invalid - ${details}`
        : 'CloudDev: .clouddev.json contains invalid JSON';
    return new CloudDevError(message, ErrorCode.CONFIG_INVALID);
}

/**
 * Creates a "field missing" error
 */
export function fieldMissingError(field: string): CloudDevError {
    return new CloudDevError(
        `CloudDev: ${field} not defined in .clouddev.json`,
        ErrorCode.FIELD_MISSING,
        field
    );
}

/**
 * Creates a "no workspace" error
 */
export function noWorkspaceError(): CloudDevError {
    return new CloudDevError(
        'CloudDev: No workspace folder open',
        ErrorCode.NO_WORKSPACE
    );
}

/**
 * Handles an error by showing an appropriate VS Code message
 *
 * @param error - The error to handle
 */
export function handleError(error: unknown): void {
    if (error instanceof CloudDevError) {
        vscode.window.showErrorMessage(error.userMessage);
        console.error(`[CloudDev] ${error.code}: ${error.message}`);
    } else if (error instanceof Error) {
        vscode.window.showErrorMessage(`CloudDev: ${error.message}`);
        console.error(`[CloudDev] Unexpected error:`, error);
    } else {
        vscode.window.showErrorMessage('CloudDev: An unexpected error occurred');
        console.error(`[CloudDev] Unknown error:`, error);
    }
}
