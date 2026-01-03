/**
 * Open Emulator View Command Handler
 *
 * Opens the noVNC webview to view the Android emulator.
 */

import { ConfigService } from '../services/ConfigService';
import { WebviewManager } from '../services/WebviewManager';
import { handleError } from '../utils/errors';

/**
 * Creates the open emulator view command handler
 *
 * @param configService - The config service instance
 * @param webviewManager - The webview manager instance
 * @returns The command handler function
 */
export function createOpenEmulatorViewHandler(
    configService: ConfigService,
    webviewManager: WebviewManager
): () => Promise<void> {
    return async () => {
        try {
            const config = await configService.loadConfig();
            configService.validateEmulatorConfig(config);

            // Build URL with auto-detection for cloud environments
            const url = configService.buildEmulatorUrl(config);

            await webviewManager.openEmulatorView(url);
        } catch (error) {
            handleError(error);
        }
    };
}
