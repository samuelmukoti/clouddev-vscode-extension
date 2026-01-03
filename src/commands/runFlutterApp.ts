/**
 * Run Flutter App Command Handler
 *
 * Runs a Flutter app on the Android emulator.
 */

import * as vscode from 'vscode';
import { ConfigService } from '../services/ConfigService';
import { TerminalManager } from '../services/TerminalManager';
import { TERMINAL_NAMES } from '../types/config';
import { handleError } from '../utils/errors';

/**
 * Creates the run Flutter app command handler
 *
 * @param configService - The config service instance
 * @param terminalManager - The terminal manager instance
 * @returns The command handler function
 */
export function createRunFlutterAppHandler(
    configService: ConfigService,
    terminalManager: TerminalManager
): () => Promise<void> {
    return async () => {
        try {
            const config = await configService.loadConfig();
            configService.validateFlutterConfig(config);

            terminalManager.runCommand(
                TERMINAL_NAMES.FLUTTER,
                config.flutter!.runCommand
            );

            vscode.window.showInformationMessage(
                'CloudDev: Running Flutter app...'
            );
        } catch (error) {
            handleError(error);
        }
    };
}
