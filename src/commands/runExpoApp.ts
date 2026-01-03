/**
 * Run Expo App Command Handler
 *
 * Runs an Expo/React Native app on the Android emulator.
 */

import * as vscode from 'vscode';
import { ConfigService } from '../services/ConfigService';
import { TerminalManager } from '../services/TerminalManager';
import { TERMINAL_NAMES } from '../types/config';
import { handleError } from '../utils/errors';

/**
 * Creates the run Expo app command handler
 *
 * @param configService - The config service instance
 * @param terminalManager - The terminal manager instance
 * @returns The command handler function
 */
export function createRunExpoAppHandler(
    configService: ConfigService,
    terminalManager: TerminalManager
): () => Promise<void> {
    return async () => {
        try {
            const config = await configService.loadConfig();
            configService.validateExpoConfig(config);

            terminalManager.runCommand(
                TERMINAL_NAMES.EXPO,
                config.expo!.runCommand
            );

            vscode.window.showInformationMessage(
                'CloudDev: Running Expo app on Android...'
            );
        } catch (error) {
            handleError(error);
        }
    };
}
