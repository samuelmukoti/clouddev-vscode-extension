/**
 * Status Bar Service
 *
 * Manages the status bar item showing emulator state.
 */

import * as vscode from 'vscode';
import { EmulatorState, COMMANDS } from '../types/config';

export class StatusBarService {
    private statusBarItem: vscode.StatusBarItem | null = null;
    private currentState: EmulatorState = EmulatorState.Stopped;

    /**
     * Initialize the status bar service
     */
    initialize(context: vscode.ExtensionContext): void {
        // Create status bar item with high priority (shows on the left)
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            100
        );

        this.updateStatusBar();
        this.statusBarItem.show();

        context.subscriptions.push(this.statusBarItem);
    }

    /**
     * Gets the current emulator state
     */
    getState(): EmulatorState {
        return this.currentState;
    }

    /**
     * Sets the emulator state and updates the status bar
     *
     * @param state - The new emulator state
     */
    setState(state: EmulatorState): void {
        this.currentState = state;
        this.updateStatusBar();
    }

    /**
     * Updates the status bar appearance based on current state
     */
    private updateStatusBar(): void {
        if (!this.statusBarItem) {
            return;
        }

        switch (this.currentState) {
            case EmulatorState.Stopped:
                this.statusBarItem.text = '$(device-mobile) CloudDev: Stopped';
                this.statusBarItem.tooltip = 'Click to start Android emulator';
                this.statusBarItem.command = COMMANDS.START_EMULATOR;
                this.statusBarItem.backgroundColor = undefined;
                break;

            case EmulatorState.Starting:
                this.statusBarItem.text = '$(sync~spin) CloudDev: Starting...';
                this.statusBarItem.tooltip = 'Android emulator is starting...';
                this.statusBarItem.command = undefined;
                this.statusBarItem.backgroundColor = undefined;
                break;

            case EmulatorState.Running:
                this.statusBarItem.text = '$(device-mobile) CloudDev: Running';
                this.statusBarItem.tooltip = 'Click to open emulator view';
                this.statusBarItem.command = COMMANDS.OPEN_EMULATOR_VIEW;
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.prominentBackground'
                );
                break;

            case EmulatorState.Error:
                this.statusBarItem.text = '$(error) CloudDev: Error';
                this.statusBarItem.tooltip = 'Click to restart emulator';
                this.statusBarItem.command = COMMANDS.START_EMULATOR;
                this.statusBarItem.backgroundColor = new vscode.ThemeColor(
                    'statusBarItem.errorBackground'
                );
                break;
        }
    }

    /**
     * Shows the status bar item
     */
    show(): void {
        this.statusBarItem?.show();
    }

    /**
     * Hides the status bar item
     */
    hide(): void {
        this.statusBarItem?.hide();
    }

    /**
     * Disposes of resources
     */
    dispose(): void {
        this.statusBarItem?.dispose();
        this.statusBarItem = null;
    }
}
