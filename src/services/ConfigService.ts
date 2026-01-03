/**
 * Configuration Service
 *
 * Handles loading and validation of .clouddev.json and VS Code settings.
 */

import * as vscode from 'vscode';
import {
    CloudDevConfig,
    DEFAULT_EMULATOR_URL_TEMPLATE
} from '../types/config';
import {
    configNotFoundError,
    configInvalidError,
    fieldMissingError,
    noWorkspaceError
} from '../utils/errors';

export class ConfigService {
    private cachedConfig: CloudDevConfig | null = null;
    private configWatcher: vscode.FileSystemWatcher | null = null;

    /**
     * Initialize the config service with a file watcher
     */
    initialize(context: vscode.ExtensionContext): void {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            return;
        }

        // Watch for config file changes
        this.configWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceFolders[0], '.clouddev.json')
        );

        this.configWatcher.onDidChange(() => {
            this.cachedConfig = null; // Invalidate cache
        });

        this.configWatcher.onDidDelete(() => {
            this.cachedConfig = null;
        });

        context.subscriptions.push(this.configWatcher);
    }

    /**
     * Loads and parses .clouddev.json from the workspace root
     *
     * @returns The parsed configuration
     * @throws CloudDevError if config is missing or invalid
     */
    async loadConfig(): Promise<CloudDevConfig> {
        // Return cached config if available
        if (this.cachedConfig) {
            return this.cachedConfig;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw noWorkspaceError();
        }

        const configUri = vscode.Uri.joinPath(
            workspaceFolders[0].uri,
            '.clouddev.json'
        );

        try {
            const content = await vscode.workspace.fs.readFile(configUri);
            const configText = Buffer.from(content).toString('utf8');

            try {
                const config = JSON.parse(configText) as CloudDevConfig;
                this.cachedConfig = config;
                return config;
            } catch {
                throw configInvalidError();
            }
        } catch (error) {
            if (error instanceof vscode.FileSystemError) {
                throw configNotFoundError();
            }
            throw error;
        }
    }

    /**
     * Gets the emulator URL template from VS Code settings or environment
     *
     * @returns The URL template with %PORT% and %PATH% placeholders
     */
    getEmulatorUrlTemplate(): string {
        const config = vscode.workspace.getConfiguration('clouddev');
        const settingsTemplate = config.get<string>('preview.emulator.urlTemplate');

        if (settingsTemplate) {
            return settingsTemplate;
        }

        // Auto-detect cloud environment
        const cloudTemplate = this.detectCloudUrlTemplate();
        if (cloudTemplate) {
            return cloudTemplate;
        }

        return DEFAULT_EMULATOR_URL_TEMPLATE;
    }

    /**
     * Detects cloud environment and returns appropriate URL template
     */
    private detectCloudUrlTemplate(): string | null {
        // Check for devbox.ondx.net environment
        const domain = process.env.DOMAIN;
        if (domain?.includes('devbox.ondx.net')) {
            return 'https://preview-%PORT%.devbox.ondx.net%PATH%';
        }

        // Check for VS Code proxy URI pattern (Codespaces, Gitpod, etc.)
        const proxyUri = process.env.VSCODE_PROXY_URI;
        if (proxyUri) {
            // Pattern like "https://example.com/proxy/{{port}}/"
            return proxyUri.replace('{{port}}', '%PORT%') + '%PATH%';
        }

        return null;
    }

    /**
     * Builds the complete emulator URL from config
     *
     * @param config - The CloudDev config
     * @returns The complete URL to access the emulator
     */
    buildEmulatorUrl(config: CloudDevConfig): string {
        if (!config.emulator) {
            throw fieldMissingError('emulator');
        }

        // Use config urlTemplate if specified, otherwise auto-detect
        let template = config.emulator.urlTemplate || this.getEmulatorUrlTemplate();

        const port = config.emulator.port.toString();
        const path = config.emulator.path || '/vnc.html?autoconnect=1';

        return template
            .replace('%PORT%', port)
            .replace(/%PORT%/g, port)
            .replace('%PATH%', path)
            .replace(/%PATH%/g, path);
    }

    /**
     * Validates that emulator configuration is complete
     *
     * @param config - The config to validate
     * @throws CloudDevError if required fields are missing
     */
    validateEmulatorConfig(config: CloudDevConfig): void {
        if (!config.emulator) {
            throw fieldMissingError('emulator');
        }
        if (!config.emulator.startCommand) {
            throw fieldMissingError('emulator.startCommand');
        }
        if (typeof config.emulator.port !== 'number') {
            throw fieldMissingError('emulator.port');
        }
    }

    /**
     * Validates that Flutter configuration is complete
     *
     * @param config - The config to validate
     * @throws CloudDevError if required fields are missing
     */
    validateFlutterConfig(config: CloudDevConfig): void {
        if (!config.flutter) {
            throw fieldMissingError('flutter');
        }
        if (!config.flutter.runCommand) {
            throw fieldMissingError('flutter.runCommand');
        }
    }

    /**
     * Validates that Expo configuration is complete
     *
     * @param config - The config to validate
     * @throws CloudDevError if required fields are missing
     */
    validateExpoConfig(config: CloudDevConfig): void {
        if (!config.expo) {
            throw fieldMissingError('expo');
        }
        if (!config.expo.runCommand) {
            throw fieldMissingError('expo.runCommand');
        }
    }

    /**
     * Validates that Maestro configuration is complete
     *
     * @param config - The config to validate
     * @throws CloudDevError if required fields are missing
     */
    validateMaestroConfig(config: CloudDevConfig): void {
        if (!config.maestro) {
            throw fieldMissingError('maestro');
        }
        if (!config.maestro.flowsDir) {
            throw fieldMissingError('maestro.flowsDir');
        }
    }

    /**
     * Clears the cached configuration
     */
    clearCache(): void {
        this.cachedConfig = null;
    }

    /**
     * Disposes of resources
     */
    dispose(): void {
        this.configWatcher?.dispose();
        this.cachedConfig = null;
    }
}
