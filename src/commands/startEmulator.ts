/**
 * Start Emulator Command Handler
 *
 * Starts the Android emulator using the configured command.
 */

import { EmulatorService } from '../services/EmulatorService';

/**
 * Creates the start emulator command handler
 *
 * @param emulatorService - The emulator service instance
 * @returns The command handler function
 */
export function createStartEmulatorHandler(
    emulatorService: EmulatorService
): () => Promise<void> {
    return async () => {
        await emulatorService.start();
    };
}
