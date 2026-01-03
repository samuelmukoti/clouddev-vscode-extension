/**
 * Maestro Service
 *
 * Provides mobile test automation using Maestro, including:
 * - Running test flows
 * - Capturing screenshots
 * - Generating test reports
 *
 * Maestro is a mobile UI testing framework that works with any app
 * (Flutter, React Native, native Android/iOS).
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { CloudDevConfig, MaestroConfig } from '../types/config';
import { TerminalManager } from './TerminalManager';

export interface TestResult {
    flowName: string;
    status: 'passed' | 'failed' | 'skipped';
    duration: number;
    screenshots: string[];
    error?: string;
}

export interface TestReport {
    timestamp: string;
    device: string;
    totalFlows: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
    results: TestResult[];
}

export class MaestroService {
    private outputChannel: vscode.OutputChannel;

    constructor(
        private terminalManager: TerminalManager,
        private workspaceRoot: string
    ) {
        this.outputChannel = vscode.window.createOutputChannel('CloudDev: Maestro');
    }

    /**
     * Check if Maestro is installed
     */
    async isInstalled(): Promise<boolean> {
        return new Promise((resolve) => {
            const { exec } = require('child_process');
            exec('maestro --version', (error: Error | null) => {
                resolve(!error);
            });
        });
    }

    /**
     * Install Maestro CLI
     */
    async install(): Promise<void> {
        const terminal = this.terminalManager.getOrCreateTerminal('CloudDev: Maestro Setup');
        terminal.show();
        terminal.sendText('curl -Ls "https://get.maestro.mobile.dev" | bash');

        vscode.window.showInformationMessage(
            'Installing Maestro CLI... Follow the terminal for progress.'
        );
    }

    /**
     * Run a single Maestro flow
     */
    async runFlow(
        flowPath: string,
        config: MaestroConfig,
        options: { screenshot?: boolean; deviceId?: string } = {}
    ): Promise<void> {
        const deviceId = options.deviceId || config.deviceId || 'emulator-5554';
        const screenshotsDir = config.screenshotsDir || '.clouddev/screenshots';

        let command = `maestro --device ${deviceId} test "${flowPath}"`;

        if (options.screenshot) {
            const screenshotPath = path.join(
                this.workspaceRoot,
                screenshotsDir,
                `${path.basename(flowPath, '.yaml')}-${Date.now()}.png`
            );
            command += ` && maestro --device ${deviceId} screenshot "${screenshotPath}"`;
        }

        this.terminalManager.runCommand('CloudDev: Maestro', command);
        this.outputChannel.appendLine(`Running flow: ${flowPath}`);
    }

    /**
     * Run all flows in the flows directory
     */
    async runAllFlows(config: MaestroConfig): Promise<void> {
        const flowsDir = path.join(this.workspaceRoot, config.flowsDir);
        const deviceId = config.deviceId || 'emulator-5554';
        const reportsDir = config.reportsDir || '.clouddev/reports';

        const reportPath = path.join(
            this.workspaceRoot,
            reportsDir,
            `report-${Date.now()}.html`
        );

        const command = `maestro --device ${deviceId} test "${flowsDir}" --format html --output "${reportPath}"`;

        this.terminalManager.runCommand('CloudDev: Maestro', command);

        vscode.window.showInformationMessage(
            `Running all Maestro flows from ${config.flowsDir}`
        );
    }

    /**
     * Take a screenshot of the current device state
     */
    async takeScreenshot(
        config: MaestroConfig,
        name?: string
    ): Promise<string> {
        const deviceId = config.deviceId || 'emulator-5554';
        const screenshotsDir = config.screenshotsDir || '.clouddev/screenshots';
        const screenshotName = name || `screenshot-${Date.now()}`;
        const screenshotPath = path.join(
            this.workspaceRoot,
            screenshotsDir,
            `${screenshotName}.png`
        );

        // Ensure directory exists
        const { exec } = require('child_process');
        await new Promise<void>((resolve) => {
            exec(`mkdir -p "${path.dirname(screenshotPath)}"`, () => resolve());
        });

        const command = `maestro --device ${deviceId} screenshot "${screenshotPath}"`;
        this.terminalManager.runCommand('CloudDev: Maestro', command);

        this.outputChannel.appendLine(`Screenshot saved: ${screenshotPath}`);
        return screenshotPath;
    }

    /**
     * Take a screenshot using ADB (alternative when Maestro not available)
     */
    async takeAdbScreenshot(
        deviceId: string = 'emulator-5554',
        outputPath?: string
    ): Promise<string> {
        const screenshotsDir = '.clouddev/screenshots';
        const screenshotPath = outputPath || path.join(
            this.workspaceRoot,
            screenshotsDir,
            `screenshot-${Date.now()}.png`
        );

        const { exec } = require('child_process');

        // Ensure directory exists
        await new Promise<void>((resolve) => {
            exec(`mkdir -p "${path.dirname(screenshotPath)}"`, () => resolve());
        });

        return new Promise((resolve, reject) => {
            const command = `adb -s ${deviceId} exec-out screencap -p > "${screenshotPath}"`;
            exec(command, (error: Error | null) => {
                if (error) {
                    reject(error);
                } else {
                    this.outputChannel.appendLine(`ADB Screenshot saved: ${screenshotPath}`);
                    resolve(screenshotPath);
                }
            });
        });
    }

    /**
     * Generate a simple flow file for testing a screen
     */
    generateFlowTemplate(
        flowName: string,
        steps: string[]
    ): string {
        const yamlSteps = steps.map(step => `  - ${step}`).join('\n');

        return `# Maestro Flow: ${flowName}
# Generated by CloudDev Extension
# Documentation: https://maestro.mobile.dev/

appId: \${APP_ID}

---

${yamlSteps}

# Take a screenshot at the end
- takeScreenshot: ${flowName}-result
`;
    }

    /**
     * Create a new flow file
     */
    async createFlow(
        config: MaestroConfig,
        flowName: string,
        steps: string[]
    ): Promise<string> {
        const flowsDir = path.join(this.workspaceRoot, config.flowsDir);
        const flowPath = path.join(flowsDir, `${flowName}.yaml`);

        const content = this.generateFlowTemplate(flowName, steps);

        const { promises: fs } = require('fs');
        await fs.mkdir(flowsDir, { recursive: true });
        await fs.writeFile(flowPath, content);

        this.outputChannel.appendLine(`Created flow: ${flowPath}`);

        // Open the file in editor
        const doc = await vscode.workspace.openTextDocument(flowPath);
        await vscode.window.showTextDocument(doc);

        return flowPath;
    }

    /**
     * Generate a markdown test report
     */
    async generateMarkdownReport(
        results: TestResult[],
        config: MaestroConfig
    ): Promise<string> {
        const reportsDir = config.reportsDir || '.clouddev/reports';
        const reportPath = path.join(
            this.workspaceRoot,
            reportsDir,
            `report-${Date.now()}.md`
        );

        const passed = results.filter(r => r.status === 'passed').length;
        const failed = results.filter(r => r.status === 'failed').length;
        const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

        let content = `# Mobile Test Report

**Generated:** ${new Date().toISOString()}
**Total Tests:** ${results.length}
**Passed:** ${passed}
**Failed:** ${failed}
**Duration:** ${(totalDuration / 1000).toFixed(2)}s

## Results

| Flow | Status | Duration | Screenshots |
|------|--------|----------|-------------|
`;

        for (const result of results) {
            const status = result.status === 'passed' ? '✅ Passed' :
                          result.status === 'failed' ? '❌ Failed' : '⏭️ Skipped';
            const screenshots = result.screenshots.length > 0
                ? result.screenshots.map(s => `[View](${s})`).join(', ')
                : '-';
            content += `| ${result.flowName} | ${status} | ${result.duration}ms | ${screenshots} |\n`;
        }

        if (failed > 0) {
            content += `\n## Failures\n\n`;
            for (const result of results.filter(r => r.status === 'failed')) {
                content += `### ${result.flowName}\n\n`;
                content += `\`\`\`\n${result.error || 'No error details'}\n\`\`\`\n\n`;
            }
        }

        const { promises: fs } = require('fs');
        await fs.mkdir(path.dirname(reportPath), { recursive: true });
        await fs.writeFile(reportPath, content);

        this.outputChannel.appendLine(`Report generated: ${reportPath}`);

        // Open the report
        const doc = await vscode.workspace.openTextDocument(reportPath);
        await vscode.window.showTextDocument(doc);

        return reportPath;
    }

    /**
     * Quick validation - takes screenshots before and after an action
     */
    async validateFeature(
        config: MaestroConfig,
        featureName: string,
        actionCallback: () => Promise<void>
    ): Promise<{ before: string; after: string }> {
        const before = await this.takeAdbScreenshot(
            config.deviceId,
            path.join(
                this.workspaceRoot,
                config.screenshotsDir || '.clouddev/screenshots',
                `${featureName}-before.png`
            )
        );

        await actionCallback();

        // Wait for UI to settle
        await new Promise(resolve => setTimeout(resolve, 2000));

        const after = await this.takeAdbScreenshot(
            config.deviceId,
            path.join(
                this.workspaceRoot,
                config.screenshotsDir || '.clouddev/screenshots',
                `${featureName}-after.png`
            )
        );

        return { before, after };
    }

    /**
     * Show the output channel
     */
    showOutput(): void {
        this.outputChannel.show();
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.outputChannel.dispose();
    }
}
