/**
 * CloudDev Configuration Types
 *
 * These interfaces define the structure of .clouddev.json and VS Code settings.
 */

/**
 * Flutter configuration for running Flutter apps on the emulator
 */
export interface FlutterConfig {
    /** Command to run the Flutter app (e.g., "flutter run -d emulator-5554") */
    runCommand: string;
}

/**
 * Expo/React Native configuration for running Expo apps on the emulator
 */
export interface ExpoConfig {
    /** Command to run the Expo app on Android (e.g., "npx expo run:android") */
    runCommand: string;
    /** Optional command to start Expo dev server (e.g., "npx expo start") */
    startCommand?: string;
}

/**
 * Android emulator configuration for the graphics stack (Xvfb + VNC + noVNC)
 */
export interface EmulatorConfig {
    /** Command to start the emulator stack (e.g., "bash scripts/start_emulator.sh") */
    startCommand: string;
    /** Port where noVNC is exposed (e.g., 6080) */
    port: number;
    /** Optional path appended to the noVNC URL (e.g., "/vnc.html?autoconnect=1") */
    path?: string;
    /** URL template for cloud environments (e.g., "https://preview-%PORT%.devbox.ondx.net%PATH%") */
    urlTemplate?: string;
}

/**
 * Maestro test automation configuration
 */
export interface MaestroConfig {
    /** Directory containing Maestro flow files */
    flowsDir: string;
    /** Directory to save screenshots */
    screenshotsDir?: string;
    /** Directory to save test reports */
    reportsDir?: string;
    /** Default device ID (e.g., "emulator-5554") */
    deviceId?: string;
}

/**
 * Web configuration (reserved for future use, handled by devbox-port-exposer)
 */
export interface WebConfig {
    /** Command to start the web dev server */
    startCommand: string;
    /** Port where the dev server listens */
    port: number;
}

/**
 * Main configuration from .clouddev.json
 */
export interface CloudDevConfig {
    /** Flutter app configuration */
    flutter?: FlutterConfig;
    /** Expo/React Native app configuration */
    expo?: ExpoConfig;
    /** Android emulator configuration */
    emulator?: EmulatorConfig;
    /** Web app configuration (reserved) */
    web?: WebConfig;
    /** Maestro test automation configuration */
    maestro?: MaestroConfig;
}

/**
 * Emulator state for status bar tracking
 */
export enum EmulatorState {
    Stopped = 'stopped',
    Starting = 'starting',
    Running = 'running',
    Error = 'error'
}

/**
 * Default URL template for emulator preview
 */
export const DEFAULT_EMULATOR_URL_TEMPLATE = 'http://localhost:%PORT%%PATH%';

/**
 * Terminal names used by the extension
 */
export const TERMINAL_NAMES = {
    EMULATOR: 'CloudDev: Android Emulator',
    FLUTTER: 'CloudDev: Flutter',
    EXPO: 'CloudDev: Expo'
} as const;

/**
 * Command IDs for the extension
 */
export const COMMANDS = {
    START_EMULATOR: 'clouddev.startEmulator',
    OPEN_EMULATOR_VIEW: 'clouddev.openEmulatorView',
    RUN_FLUTTER_APP: 'clouddev.runFlutterApp',
    RUN_EXPO_APP: 'clouddev.runExpoApp',
    STOP_EMULATOR: 'clouddev.stopEmulator'
} as const;
