/**
 * CloudDev Helper Extension
 *
 * VS Code extension for cloud-based mobile development with
 * first-class Android emulator support via noVNC.
 */

import * as vscode from 'vscode';
import { ConfigService } from './services/ConfigService';
import { TerminalManager } from './services/TerminalManager';
import { StatusBarService } from './services/StatusBarService';
import { EmulatorService } from './services/EmulatorService';
import { WebviewManager } from './services/WebviewManager';
import { MaestroService } from './services/MaestroService';
import { RemoteRunnerService } from './services/RemoteRunnerService';
import { registerCommands } from './commands';
import { registerRemoteRunnerCommands } from './commands/remoteRunner';

// Service instances
let configService: ConfigService;
let terminalManager: TerminalManager;
let statusBarService: StatusBarService;
let emulatorService: EmulatorService;
let webviewManager: WebviewManager;
let maestroService: MaestroService;
let remoteRunnerService: RemoteRunnerService;

/**
 * Extension activation
 *
 * Called when the extension is activated (via activation events or commands).
 */
export function activate(context: vscode.ExtensionContext): void {
    console.log('CloudDev Helper extension is now active');

    // Initialize services
    configService = new ConfigService();
    terminalManager = new TerminalManager();
    statusBarService = new StatusBarService();
    webviewManager = new WebviewManager(context);
    emulatorService = new EmulatorService(
        configService,
        terminalManager,
        statusBarService
    );

    // Get workspace root for MaestroService
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    maestroService = new MaestroService(terminalManager, workspaceRoot);
    remoteRunnerService = new RemoteRunnerService();

    // Initialize services that need context
    configService.initialize(context);
    terminalManager.initialize(context);
    statusBarService.initialize(context);
    emulatorService.initialize(context);
    remoteRunnerService.initialize(context);

    // Register commands
    registerCommands(
        context,
        configService,
        terminalManager,
        webviewManager,
        emulatorService,
        maestroService
    );

    // Register remote runner commands
    registerRemoteRunnerCommands(context, remoteRunnerService, terminalManager);

    // Show welcome message on first activation
    showWelcomeMessage();
}

/**
 * Extension deactivation
 *
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
    console.log('CloudDev Helper extension is deactivating');

    // Dispose services
    remoteRunnerService?.dispose();
    maestroService?.dispose();
    emulatorService?.dispose();
    webviewManager?.dispose();
    statusBarService?.dispose();
    terminalManager?.dispose();
    configService?.dispose();
}

/**
 * Shows a welcome message with quick actions
 */
async function showWelcomeMessage(): Promise<void> {
    // Check if config file exists
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
        return;
    }

    const configUri = vscode.Uri.joinPath(
        workspaceFolders[0].uri,
        '.clouddev.json'
    );

    try {
        await vscode.workspace.fs.stat(configUri);
        // Config exists - show subtle notification
        vscode.window.setStatusBarMessage(
            '$(device-mobile) CloudDev Helper activated',
            5000
        );
    } catch {
        // Config doesn't exist - offer to create one
        const action = await vscode.window.showInformationMessage(
            'CloudDev Helper: No .clouddev.json found. Create one to get started.',
            'Create Config',
            'Dismiss'
        );

        if (action === 'Create Config') {
            await createSampleConfig(configUri);
        }
    }
}

/**
 * Creates a sample .clouddev.json configuration file
 */
async function createSampleConfig(configUri: vscode.Uri): Promise<void> {
    const sampleConfig = {
        flutter: {
            runCommand: 'flutter run -d emulator-5554'
        },
        expo: {
            runCommand: 'npx expo run:android',
            startCommand: 'npx expo start'
        },
        emulator: {
            startCommand: 'bash scripts/start_emulator.sh',
            port: 6080,
            path: '/vnc.html?autoconnect=1'
        },
        maestro: {
            flowsDir: '.clouddev/flows',
            screenshotsDir: '.clouddev/screenshots',
            reportsDir: '.clouddev/reports',
            deviceId: 'emulator-5554'
        }
    };

    const content = Buffer.from(
        JSON.stringify(sampleConfig, null, 2),
        'utf8'
    );

    await vscode.workspace.fs.writeFile(configUri, content);

    // Open the created file
    const document = await vscode.workspace.openTextDocument(configUri);
    await vscode.window.showTextDocument(document);

    vscode.window.showInformationMessage(
        'CloudDev: Created .clouddev.json. Update the commands for your project.'
    );
}
