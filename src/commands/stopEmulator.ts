/**
 * Stop Emulator Command Handler
 *
 * Stops the running Android emulator.
 */

import { EmulatorService } from '../services/EmulatorService';

/**
 * Creates the stop emulator command handler
 *
 * @param emulatorService - The emulator service instance
 * @returns The command handler function
 */
export function createStopEmulatorHandler(
    emulatorService: EmulatorService
): () => void {
    return () => {
        emulatorService.stop();
    };
}
