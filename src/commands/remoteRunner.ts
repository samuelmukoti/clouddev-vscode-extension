/**
 * Remote Runner Commands
 *
 * VS Code commands for interacting with remote runners.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { RemoteRunnerService } from '../services/RemoteRunnerService';
import { TerminalManager } from '../services/TerminalManager';

/**
 * Register remote runner commands
 */
export function registerRemoteRunnerCommands(
    context: vscode.ExtensionContext,
    remoteRunnerService: RemoteRunnerService,
    terminalManager: TerminalManager
): void {
    // Open Runner Dashboard
    context.subscriptions.push(
        vscode.commands.registerCommand('clouddev.openRunnerDashboard', async () => {
            const isHealthy = await remoteRunnerService.checkHealth();
            if (!isHealthy) {
                const action = await vscode.window.showWarningMessage(
                    'Runner coordinator is not running. Start it first?',
                    'Start Coordinator',
                    'Cancel'
                );
                if (action === 'Start Coordinator') {
                    await vscode.commands.executeCommand('clouddev.startCoordinator');
                }
                return;
            }
            remoteRunnerService.openDashboard();
        })
    );

    // Add Remote Runner
    context.subscriptions.push(
        vscode.commands.registerCommand('clouddev.addRemoteRunner', async () => {
            const isHealthy = await remoteRunnerService.checkHealth();
            if (!isHealthy) {
                const action = await vscode.window.showWarningMessage(
                    'Runner coordinator is not running. Start it first?',
                    'Start Coordinator',
                    'Cancel'
                );
                if (action === 'Start Coordinator') {
                    await vscode.commands.executeCommand('clouddev.startCoordinator');
                    // Wait a moment for coordinator to start
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }

            try {
                const link = await remoteRunnerService.generateMagicLink();

                const panel = vscode.window.createWebviewPanel(
                    'clouddevMagicLink',
                    'Add Remote Runner',
                    vscode.ViewColumn.One,
                    { enableScripts: true }
                );

                panel.webview.html = getMagicLinkHtml(link);

                // Handle copy action
                panel.webview.onDidReceiveMessage(async message => {
                    if (message.command === 'copy') {
                        await vscode.env.clipboard.writeText(link.command);
                        vscode.window.showInformationMessage('Command copied to clipboard!');
                    }
                });
            } catch (err) {
                vscode.window.showErrorMessage(`Failed to generate magic link: ${err}`);
            }
        })
    );

    // List Remote Runners
    context.subscriptions.push(
        vscode.commands.registerCommand('clouddev.listRemoteRunners', async () => {
            try {
                const runners = await remoteRunnerService.getRunners();

                if (runners.length === 0) {
                    vscode.window.showInformationMessage(
                        'No remote runners connected. Use "CloudDev: Add Remote Runner" to add one.'
                    );
                    return;
                }

                const items = runners.map(r => ({
                    label: `$(device-desktop) ${r.name}`,
                    description: `${r.platform} - ${r.status}`,
                    detail: r.devices.length > 0
                        ? `Devices: ${r.devices.map(d => `${d.name} (${d.type})`).join(', ')}`
                        : 'No devices detected'
                }));

                await vscode.window.showQuickPick(items, {
                    placeHolder: `${runners.length} runner(s) connected`,
                    canPickMany: false
                });
            } catch (err) {
                vscode.window.showErrorMessage(`Failed to list runners: ${err}`);
            }
        })
    );

    // Remote Screenshot
    context.subscriptions.push(
        vscode.commands.registerCommand('clouddev.remoteScreenshot', async () => {
            try {
                const runner = await remoteRunnerService.selectRunner();
                if (!runner) return;

                const device = await remoteRunnerService.selectDevice(runner);

                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Taking screenshot...',
                    cancellable: false
                }, async () => {
                    const screenshot = await remoteRunnerService.takeScreenshot(
                        runner.id,
                        device?.id
                    );

                    // Save screenshot
                    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                    if (workspaceRoot) {
                        const screenshotsDir = path.join(workspaceRoot, '.clouddev', 'screenshots');
                        if (!fs.existsSync(screenshotsDir)) {
                            fs.mkdirSync(screenshotsDir, { recursive: true });
                        }

                        const filename = `remote-${Date.now()}.png`;
                        const filepath = path.join(screenshotsDir, filename);

                        fs.writeFileSync(filepath, Buffer.from(screenshot.base64, 'base64'));

                        const openAction = await vscode.window.showInformationMessage(
                            `Screenshot saved: ${filename}`,
                            'Open'
                        );

                        if (openAction === 'Open') {
                            const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(filepath));
                            await vscode.window.showTextDocument(doc);
                        }
                    }
                });
            } catch (err) {
                vscode.window.showErrorMessage(`Screenshot failed: ${err}`);
            }
        })
    );

    // Run Remote Maestro Flow
    context.subscriptions.push(
        vscode.commands.registerCommand('clouddev.runRemoteMaestroFlow', async () => {
            try {
                const runner = await remoteRunnerService.selectRunner();
                if (!runner) return;

                const device = await remoteRunnerService.selectDevice(runner);

                // Find flow files
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                if (!workspaceRoot) {
                    vscode.window.showErrorMessage('No workspace folder open');
                    return;
                }

                const flowsDir = path.join(workspaceRoot, '.clouddev', 'flows');
                if (!fs.existsSync(flowsDir)) {
                    vscode.window.showWarningMessage(
                        'No flows directory found. Create .clouddev/flows/ with YAML flow files.'
                    );
                    return;
                }

                const flowFiles = fs.readdirSync(flowsDir)
                    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

                if (flowFiles.length === 0) {
                    vscode.window.showWarningMessage('No flow files found in .clouddev/flows/');
                    return;
                }

                const selectedFlow = await vscode.window.showQuickPick(
                    flowFiles.map(f => ({
                        label: f,
                        description: path.join(flowsDir, f)
                    })),
                    { placeHolder: 'Select a Maestro flow to run' }
                );

                if (!selectedFlow) return;

                const flowContent = fs.readFileSync(
                    path.join(flowsDir, selectedFlow.label),
                    'utf-8'
                );

                const result = await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: `Running ${selectedFlow.label} on ${runner.name}...`,
                    cancellable: false
                }, async () => {
                    return remoteRunnerService.runMaestroFlow(
                        runner.id,
                        flowContent,
                        device?.id
                    );
                });

                if (result.success) {
                    vscode.window.showInformationMessage(
                        `Flow completed successfully on ${runner.name}`
                    );
                } else {
                    vscode.window.showErrorMessage(
                        `Flow failed: ${result.error || 'Unknown error'}`
                    );
                }

                // Show logs in output channel
                if (result.logs) {
                    const outputChannel = vscode.window.createOutputChannel('Maestro Flow');
                    outputChannel.appendLine(`=== ${selectedFlow.label} on ${runner.name} ===`);
                    outputChannel.appendLine(result.logs);
                    outputChannel.show();
                }
            } catch (err) {
                vscode.window.showErrorMessage(`Failed to run flow: ${err}`);
            }
        })
    );

    // Start Coordinator
    context.subscriptions.push(
        vscode.commands.registerCommand('clouddev.startCoordinator', async () => {
            const config = vscode.workspace.getConfiguration('clouddev.coordinator');
            const port = config.get<number>('port', 7800);
            const externalUrl = config.get<string>('externalUrl', '');

            const terminal = terminalManager.getOrCreateTerminal('CloudDev Coordinator');
            terminal.show();

            // Build command with environment variables
            let command = `cd "${context.extensionPath}/packages/coordinator" && `;
            if (externalUrl) {
                command += `BASE_URL="${externalUrl}" `;
            }
            command += `PORT=${port} node dist/cli.js`;

            terminal.sendText(command);

            vscode.window.showInformationMessage(
                `Starting coordinator on port ${port}...`
            );
        })
    );
}

/**
 * Generate HTML for magic link webview
 */
function getMagicLinkHtml(link: { command: string; expiresAt: string }): string {
    const expiresAt = new Date(link.expiresAt);
    const minutes = Math.round((expiresAt.getTime() - Date.now()) / 60000);

    return `<!DOCTYPE html>
<html>
<head>
    <style>
        body {
            font-family: var(--vscode-font-family);
            padding: 20px;
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
        }
        h1 { margin-bottom: 10px; }
        .subtitle { color: var(--vscode-descriptionForeground); margin-bottom: 20px; }
        .command-box {
            background: var(--vscode-textCodeBlock-background);
            padding: 15px;
            border-radius: 8px;
            font-family: monospace;
            word-break: break-all;
            margin: 20px 0;
        }
        .copy-btn {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        }
        .copy-btn:hover {
            background: var(--vscode-button-hoverBackground);
        }
        .expires {
            color: var(--vscode-descriptionForeground);
            font-size: 12px;
            margin-top: 15px;
        }
        .steps {
            margin-top: 30px;
            padding: 15px;
            background: var(--vscode-textBlockQuote-background);
            border-radius: 8px;
        }
        .steps h3 { margin-top: 0; }
        .steps ol { padding-left: 20px; }
        .steps li { margin: 10px 0; }
    </style>
</head>
<body>
    <h1>Add Remote Runner</h1>
    <p class="subtitle">Run this command on your Mac or PC to connect it as a remote runner:</p>

    <div class="command-box">${link.command}</div>

    <button class="copy-btn" onclick="copyCommand()">Copy Command</button>

    <p class="expires">Link expires in ${minutes} minutes</p>

    <div class="steps">
        <h3>Setup Instructions</h3>
        <ol>
            <li>Open Terminal on your Mac or Command Prompt on your PC</li>
            <li>Paste and run the command above</li>
            <li>The runner will automatically connect to this workspace</li>
            <li>Once connected, you can run Maestro flows and take screenshots remotely</li>
        </ol>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        function copyCommand() {
            vscode.postMessage({ command: 'copy' });
        }
    </script>
</body>
</html>`;
}
