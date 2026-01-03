# CloudDev Helper

Run and preview mobile apps (Flutter, Expo/React Native) on cloud-based Android emulators with remote runner support for iOS simulators.

## Features

- **Android Emulator via noVNC**: View and interact with Android emulators directly in VS Code
- **Remote Runners**: Connect Mac/PC machines as remote runners for iOS and Android testing
- **Maestro Test Automation**: Run Maestro flows locally or on remote runners
- **Flutter & Expo Support**: One-click app launching for Flutter and Expo projects
- **Screenshot Capture**: Take screenshots from local or remote devices

## Getting Started

1. Create a `.clouddev.json` file in your project root (or let the extension create one)
2. Start the Android emulator with `CloudDev: Start Android Emulator`
3. Open the emulator view with `CloudDev: Open Emulator View`

## Remote Runners

CloudDev supports remote runners for offloading emulator/simulator workloads to dedicated machines:

1. Run `CloudDev: Start Runner Coordinator` to start the coordination service
2. Run `CloudDev: Add Remote Runner` to get a setup link
3. Paste the command on your Mac/PC to connect it as a runner
4. Use `CloudDev: Take Remote Screenshot` or `CloudDev: Run Maestro Flow on Remote Runner`

### Benefits

- **iOS Testing**: Run iOS simulators on remote Macs
- **Better Performance**: Dedicate GPU resources on remote machines
- **Parallel Testing**: Connect multiple runners for parallel test execution

## Commands

| Command | Description |
|---------|-------------|
| `CloudDev: Start Android Emulator` | Start the Android emulator |
| `CloudDev: Open Emulator View` | Open noVNC emulator view in VS Code |
| `CloudDev: Run Flutter App` | Run Flutter app on emulator |
| `CloudDev: Run Expo App` | Run Expo app on emulator |
| `CloudDev: Run Maestro Flow` | Run a Maestro test flow |
| `CloudDev: Take Screenshot` | Capture screenshot from emulator |
| `CloudDev: Open Runner Dashboard` | Open the remote runner dashboard |
| `CloudDev: Add Remote Runner` | Generate setup link for remote runner |
| `CloudDev: Take Remote Screenshot` | Capture screenshot from remote device |
| `CloudDev: Run Maestro Flow on Remote Runner` | Run Maestro flow on remote runner |

## Configuration

Add a `.clouddev.json` file to your project:

```json
{
  "flutter": {
    "runCommand": "flutter run -d emulator-5554"
  },
  "expo": {
    "runCommand": "npx expo run:android",
    "startCommand": "npx expo start"
  },
  "emulator": {
    "startCommand": "bash scripts/start_emulator.sh",
    "port": 6080,
    "path": "/vnc.html?autoconnect=1"
  },
  "maestro": {
    "flowsDir": ".clouddev/flows",
    "screenshotsDir": ".clouddev/screenshots",
    "deviceId": "emulator-5554"
  }
}
```

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `clouddev.preview.emulator.urlTemplate` | `http://localhost:%PORT%%PATH%` | URL template for noVNC preview |
| `clouddev.coordinator.port` | `7800` | Port for runner coordinator |
| `clouddev.coordinator.externalUrl` | `""` | External URL for coordinator |

## Requirements

- Android SDK with emulator (for local Android testing)
- [Maestro](https://maestro.mobile.dev/) (for test automation)
- Node.js 18+ (for remote runner functionality)

## License

GPL-3.0 - See [LICENSE](LICENSE) for details.

## Author

Samuel Mukoti - [Melivo](https://www.melivo.com)
