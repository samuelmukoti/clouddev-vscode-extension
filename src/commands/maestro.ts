/**
 * Maestro Command Handlers
 *
 * Commands for mobile test automation using Maestro.
 */

import * as vscode from 'vscode';
import { ConfigService } from '../services/ConfigService';
import { MaestroService } from '../services/MaestroService';
import { handleError } from '../utils/errors';

/**
 * Run a Maestro flow selected by the user
 */
export function createRunMaestroFlowHandler(
    configService: ConfigService,
    maestroService: MaestroService
): () => Promise<void> {
    return async () => {
        try {
            const config = await configService.loadConfig();
            configService.validateMaestroConfig(config);

            // Find all flow files
            const flowFiles = await vscode.workspace.findFiles(
                `${config.maestro!.flowsDir}/**/*.yaml`,
                '**/node_modules/**'
            );

            if (flowFiles.length === 0) {
                vscode.window.showWarningMessage(
                    `No flow files found in ${config.maestro!.flowsDir}`
                );
                return;
            }

            // Let user pick a flow
            const items = flowFiles.map(f => ({
                label: vscode.workspace.asRelativePath(f),
                uri: f
            }));

            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Select a Maestro flow to run'
            });

            if (selected) {
                await maestroService.runFlow(
                    selected.uri.fsPath,
                    config.maestro!,
                    { screenshot: true }
                );
            }
        } catch (error) {
            handleError(error);
        }
    };
}

/**
 * Run all Maestro flows in the configured directory
 */
export function createRunAllMaestroFlowsHandler(
    configService: ConfigService,
    maestroService: MaestroService
): () => Promise<void> {
    return async () => {
        try {
            const config = await configService.loadConfig();
            configService.validateMaestroConfig(config);

            await maestroService.runAllFlows(config.maestro!);
        } catch (error) {
            handleError(error);
        }
    };
}

/**
 * Take a screenshot of the current emulator state
 */
export function createTakeScreenshotHandler(
    configService: ConfigService,
    maestroService: MaestroService
): () => Promise<void> {
    return async () => {
        try {
            const config = await configService.loadConfig();

            // Prompt for screenshot name
            const name = await vscode.window.showInputBox({
                prompt: 'Enter screenshot name (optional)',
                placeHolder: 'screenshot-name'
            });

            const deviceId = config.maestro?.deviceId || 'emulator-5554';
            const screenshotPath = await maestroService.takeAdbScreenshot(
                deviceId,
                name ? undefined : undefined // Use default path
            );

            vscode.window.showInformationMessage(
                `Screenshot saved: ${screenshotPath}`
            );

            // Open the screenshot
            const uri = vscode.Uri.file(screenshotPath);
            await vscode.commands.executeCommand('vscode.open', uri);
        } catch (error) {
            handleError(error);
        }
    };
}

/**
 * Create a new Maestro flow file
 */
export function createNewMaestroFlowHandler(
    configService: ConfigService,
    maestroService: MaestroService
): () => Promise<void> {
    return async () => {
        try {
            const config = await configService.loadConfig();

            // If no maestro config, create default
            const maestroConfig = config.maestro || {
                flowsDir: '.clouddev/flows',
                screenshotsDir: '.clouddev/screenshots',
                reportsDir: '.clouddev/reports'
            };

            // Prompt for flow name
            const flowName = await vscode.window.showInputBox({
                prompt: 'Enter flow name',
                placeHolder: 'login-test',
                validateInput: (value) => {
                    if (!value || !/^[a-zA-Z0-9_-]+$/.test(value)) {
                        return 'Flow name must contain only letters, numbers, dashes, and underscores';
                    }
                    return null;
                }
            });

            if (!flowName) {
                return;
            }

            // Default steps template
            const defaultSteps = [
                'launchApp',
                'assertVisible: "Welcome"',
                'takeScreenshot: initial-state'
            ];

            await maestroService.createFlow(maestroConfig, flowName, defaultSteps);

            vscode.window.showInformationMessage(
                `Created Maestro flow: ${flowName}.yaml`
            );
        } catch (error) {
            handleError(error);
        }
    };
}

/**
 * Install Maestro CLI
 */
export function createInstallMaestroHandler(
    maestroService: MaestroService
): () => Promise<void> {
    return async () => {
        try {
            const isInstalled = await maestroService.isInstalled();

            if (isInstalled) {
                const reinstall = await vscode.window.showQuickPick(
                    ['Update Maestro', 'Cancel'],
                    { placeHolder: 'Maestro is already installed' }
                );

                if (reinstall !== 'Update Maestro') {
                    return;
                }
            }

            await maestroService.install();
        } catch (error) {
            handleError(error);
        }
    };
}

/**
 * Show Maestro output channel
 */
export function createShowMaestroOutputHandler(
    maestroService: MaestroService
): () => void {
    return () => {
        maestroService.showOutput();
    };
}
