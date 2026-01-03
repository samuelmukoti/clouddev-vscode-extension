/**
 * Command Registration
 *
 * Registers all extension commands with VS Code.
 */

import * as vscode from 'vscode';
import { COMMANDS } from '../types/config';
import { ConfigService } from '../services/ConfigService';
import { TerminalManager } from '../services/TerminalManager';
import { WebviewManager } from '../services/WebviewManager';
import { EmulatorService } from '../services/EmulatorService';
import { MaestroService } from '../services/MaestroService';
import { createStartEmulatorHandler } from './startEmulator';
import { createOpenEmulatorViewHandler } from './openEmulatorView';
import { createRunFlutterAppHandler } from './runFlutterApp';
import { createRunExpoAppHandler } from './runExpoApp';
import { createStopEmulatorHandler } from './stopEmulator';
import {
    createRunMaestroFlowHandler,
    createRunAllMaestroFlowsHandler,
    createTakeScreenshotHandler,
    createNewMaestroFlowHandler,
    createInstallMaestroHandler
} from './maestro';

/**
 * Registers all extension commands
 *
 * @param context - The extension context
 * @param configService - The config service instance
 * @param terminalManager - The terminal manager instance
 * @param webviewManager - The webview manager instance
 * @param emulatorService - The emulator service instance
 * @param maestroService - The Maestro service instance
 */
export function registerCommands(
    context: vscode.ExtensionContext,
    configService: ConfigService,
    terminalManager: TerminalManager,
    webviewManager: WebviewManager,
    emulatorService: EmulatorService,
    maestroService: MaestroService
): void {
    const commands = [
        // Emulator commands
        vscode.commands.registerCommand(
            COMMANDS.START_EMULATOR,
            createStartEmulatorHandler(emulatorService)
        ),
        vscode.commands.registerCommand(
            COMMANDS.OPEN_EMULATOR_VIEW,
            createOpenEmulatorViewHandler(configService, webviewManager)
        ),
        vscode.commands.registerCommand(
            COMMANDS.STOP_EMULATOR,
            createStopEmulatorHandler(emulatorService)
        ),

        // App run commands
        vscode.commands.registerCommand(
            COMMANDS.RUN_FLUTTER_APP,
            createRunFlutterAppHandler(configService, terminalManager)
        ),
        vscode.commands.registerCommand(
            COMMANDS.RUN_EXPO_APP,
            createRunExpoAppHandler(configService, terminalManager)
        ),

        // Maestro test automation commands
        vscode.commands.registerCommand(
            'clouddev.runMaestroFlow',
            createRunMaestroFlowHandler(configService, maestroService)
        ),
        vscode.commands.registerCommand(
            'clouddev.runAllMaestroFlows',
            createRunAllMaestroFlowsHandler(configService, maestroService)
        ),
        vscode.commands.registerCommand(
            'clouddev.takeScreenshot',
            createTakeScreenshotHandler(configService, maestroService)
        ),
        vscode.commands.registerCommand(
            'clouddev.newMaestroFlow',
            createNewMaestroFlowHandler(configService, maestroService)
        ),
        vscode.commands.registerCommand(
            'clouddev.installMaestro',
            createInstallMaestroHandler(maestroService)
        )
    ];

    context.subscriptions.push(...commands);
}
