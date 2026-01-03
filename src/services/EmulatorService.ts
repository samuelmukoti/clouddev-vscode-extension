/**
 * Emulator Service
 *
 * Manages the Android emulator lifecycle, including starting, stopping,
 * and tracking state.
 */

import * as vscode from 'vscode';
import { EmulatorState, TERMINAL_NAMES } from '../types/config';
import { TerminalManager } from './TerminalManager';
import { StatusBarService } from './StatusBarService';
import { ConfigService } from './ConfigService';
import { handleError } from '../utils/errors';

export class EmulatorService {
    private startTimeout: NodeJS.Timeout | null = null;

    constructor(
        private configService: ConfigService,
        private terminalManager: TerminalManager,
        private statusBarService: StatusBarService
    ) {}

    /**
     * Initialize the emulator service
     */
    initialize(_context: vscode.ExtensionContext): void {
        // Check if emulator terminal already exists (from previous session)
        if (this.terminalManager.hasTerminal(TERMINAL_NAMES.EMULATOR)) {
            // Assume it's running if the terminal exists
            this.statusBarService.setState(EmulatorState.Running);
        }
    }

    /**
     * Starts the Android emulator using the configured command
     */
    async start(): Promise<void> {
        try {
            const config = await this.configService.loadConfig();
            this.configService.validateEmulatorConfig(config);

            // Update state to starting
            this.statusBarService.setState(EmulatorState.Starting);

            // Run the emulator start command
            this.terminalManager.runCommand(
                TERMINAL_NAMES.EMULATOR,
                config.emulator!.startCommand
            );

            // Set a timeout to transition to "running" state
            // In v0.1, we assume the emulator is ready after a delay
            // Future: implement health checks
            this.startTimeout = setTimeout(() => {
                this.statusBarService.setState(EmulatorState.Running);
                vscode.window.showInformationMessage(
                    'CloudDev: Android emulator is ready'
                );
            }, 10000); // 10 seconds startup time

            vscode.window.showInformationMessage(
                'CloudDev: Starting Android emulator...'
            );
        } catch (error) {
            this.statusBarService.setState(EmulatorState.Error);
            handleError(error);
        }
    }

    /**
     * Stops the Android emulator
     */
    stop(): void {
        // Clear any pending timeout
        if (this.startTimeout) {
            clearTimeout(this.startTimeout);
            this.startTimeout = null;
        }

        // Dispose the emulator terminal
        const disposed = this.terminalManager.disposeTerminal(TERMINAL_NAMES.EMULATOR);

        if (disposed) {
            this.statusBarService.setState(EmulatorState.Stopped);
            vscode.window.showInformationMessage(
                'CloudDev: Emulator stopped'
            );
        } else {
            vscode.window.showWarningMessage(
                'CloudDev: No emulator terminal found'
            );
        }
    }

    /**
     * Checks if the emulator is currently running
     */
    isRunning(): boolean {
        return this.statusBarService.getState() === EmulatorState.Running;
    }

    /**
     * Checks if the emulator is currently starting
     */
    isStarting(): boolean {
        return this.statusBarService.getState() === EmulatorState.Starting;
    }

    /**
     * Sets the emulator state to error
     */
    setError(): void {
        if (this.startTimeout) {
            clearTimeout(this.startTimeout);
            this.startTimeout = null;
        }
        this.statusBarService.setState(EmulatorState.Error);
    }

    /**
     * Disposes of resources
     */
    dispose(): void {
        if (this.startTimeout) {
            clearTimeout(this.startTimeout);
            this.startTimeout = null;
        }
    }
}
