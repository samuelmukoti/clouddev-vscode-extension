# CloudDev VS Code Extension – Product Requirements Document (PRD)

## 1. Overview

**Product name (working):** CloudDev Helper (VS Code / code-server extension)  
**Owner:** Samuel Mukoti (and collaborators)  
**Version:** v0.1 (Draft)  
**Status:** Initial PRD

CloudDev Helper is a **VS Code / code-server extension** that makes it easy to **build, run, and debug applications directly in a cloud-based development environment**, regardless of whether code-server is running on:

- A VM (e.g. on a cloud provider)
- Inside a Docker container
- Bare metal (on-prem)

The extension is **environment-agnostic**: it does not care whether the host is Docker or a VM. Instead, it relies on **configurable commands and ports** to orchestrate:

1. **Web application development** – run dev servers (e.g. Node/Vite/Next.js) and preview them via a browser or an in-editor tab.
2. **Mobile application development (Flutter)** – run Flutter apps on an **Android emulator running in the cloud**, visualized via **VNC/noVNC** in a tab inside VS Code or the code-server UI.

The underlying assumption is that wherever code-server runs, it can access the necessary tooling (Node, Flutter, Android SDK, emulator, Xvfb, VNC, noVNC, etc.). The extension provides a **unified UX** to control and preview all of that from within the editor.

---

## 2. Goals & Objectives

### 2.1 Primary Goals

1. **Environment-agnostic orchestration**
   - Provide a single extension that works the same way whether code-server runs in a VM, a Docker container, or bare metal.
   - Avoid hard-coded assumptions about OS, containerization, or specific paths.

2. **First-class web app development in the cloud**
   - Allow users to:
     - Start their web application dev server using a **configurable command**.
     - Automatically open a preview of the running web app, either:
       - In the local browser (for desktop VS Code users), or
       - In a VS Code / code-server webview tab (for browser-based use).
   - Reuse VS Code built-in port forwarding / proxying as much as possible.

3. **First-class mobile (Flutter + Android) development in the cloud**
   - Provide commands to:
     - Start an **Android emulator + graphics stack** (Xvfb + VNC + noVNC) via a configurable command.
     - Open a **noVNC-based emulator view** in a VS Code tab.
     - Run a Flutter app against that emulator via a configurable Flutter command.

4. **Consistent UX across environments**
   - The user should experience the same workflows and commands even when running in different hosting environments (VM vs Docker, different clouds, etc.).
   - Port exposure specifics are abstracted via configurable URL templates (`urlTemplate`), so the extension logic stays identical.

### 2.2 Secondary Goals

- Provide a **simple, declarative project configuration** (`.clouddev.json`) to describe how to run web and mobile targets.
- Offer extension settings to adapt to different **code-server proxy schemes**, e.g. plain `http://localhost:PORT` vs `https://server/proxy/PORT`.
- Keep the extension small and focused, allowing future enhancements without breaking the core design.

### 2.3 Non-goals

- The extension **does not**:
  - Install or manage Android SDK, Flutter, or Node.js.
  - Configure or manage Docker/VM networking or firewalls.
  - Implement its own SSH tunnels or HTTP reverse proxies (it relies on VS Code / code-server capabilities and environment configuration).
- The extension is not a full CI/CD or deployment platform—its focus is **dev & debug** in cloud-hosted dev environments.

---

## 3. Target Users & Personas

1. **Cloud Developer / Indie Hacker**
   - Develops in a remote Linux box (VM or container) with code-server.
   - Wants to run web/dev servers in the cloud and view them seamlessly.
   - Builds both web and mobile (Flutter) applications.

2. **Team Developer using shared dev environments**
   - Uses shared cloud environments for heavier workloads (emulators, multi-service stacks).
   - Needs reproducible, documented commands for running web and mobile targets.
   - Wants the same experience regardless of whether the environment runs in Kubernetes, plain Docker, or VMs.

3. **DevOps / Platform Engineer**
   - Prepares base images or templates (Dockerfiles, cloud images).
   - Ensures that required tooling is installed and writes helper scripts (e.g. `start_emulator.sh`).
   - Wants developers to use a standardized extension to control the environment.

---

## 4. Use Cases

### 4.1 Web Application

- As a developer, I open a project in VS Code / code-server.
- I run **“CloudDev: Run Web App”**.
- The extension:
  - Reads `.clouddev.json` for the `web.startCommand` and `web.port`.
  - Starts a terminal running the configured command (e.g. `npm run dev`).
- I run **“CloudDev: Open Web Preview”**.
  - The extension reads the `clouddev.preview.web.urlTemplate` config and replaces `%PORT%` with the configured port (e.g. `5173`).
  - It opens the resulting URL in either:
    - The user’s local browser (desktop VS Code), or
    - A webview tab with an `<iframe>` inside VS Code / code-server.

### 4.2 Flutter Application + Android Emulator

- As a developer, I open a Flutter project in VS Code / code-server.
- I run **“CloudDev: Start Android Emulator”**.
  - The extension:
    - Reads `.clouddev.json` for `emulator.startCommand` and `emulator.port`.
    - Starts a terminal running `emulator.startCommand` (e.g. `bash scripts/start_emulator.sh`).
- Once the stack is up (Xvfb + emulator + VNC + noVNC), I run **“CloudDev: Open Emulator View”**.
  - The extension:
    - Uses `emulator.port` and `emulator.path` along with `clouddev.preview.emulator.urlTemplate` to construct a noVNC URL.
    - Opens a VS Code webview tab embedding that URL via `<iframe>`.
- I then run **“CloudDev: Run Flutter App”**.
  - The extension:
    - Reads `.clouddev.json` for `flutter.runCommand` (e.g. `flutter run -d emulator-5554`).
    - Starts a terminal running that command.
  - The Flutter app appears in the emulator inside the webview tab.

### 4.3 Environment Switching (VM vs Docker)

- I have two environments:
  - A Dockerized code-server environment.
  - A VM running code-server directly.
- Both environments:
  - Have `.clouddev.json` in the repo.
  - Have scripts and tools installed (Android, Flutter, Node, Xvfb, VNC, noVNC).
- The **only thing that differs** is their port exposure / proxying, configured via `clouddev.preview.*.urlTemplate` settings.
- The same extension UI and commands work seamlessly in both environments.

---

## 5. Functional Requirements

### 5.1 Configuration

**FR-1: Workspace-level project config (`.clouddev.json`)**

- The extension must look for `.clouddev.json` in the workspace root.
- Schema (v0.1 proposal):

```jsonc
{
  "web": {
    "startCommand": "npm run dev",
    "port": 5173
  },
  "flutter": {
    "runCommand": "flutter run -d emulator-5554"
  },
  "emulator": {
    "startCommand": "bash scripts/start_emulator.sh",
    "port": 6080,
    "path": "/vnc.html?autoconnect=1"
  }
}
```

Fields:

- `web.startCommand`: String, required if web support is used.
- `web.port`: Number (port where web dev server listens).
- `flutter.runCommand`: String, required if Flutter support is used.
- `emulator.startCommand`: String, required if emulator support is used.
- `emulator.port`: Number (HTTP port where noVNC is exposed).
- `emulator.path`: Optional string appended to the base URL (e.g. `/vnc.html?autoconnect=1`).

**FR-2: Extension settings for URL templates**

- Add VS Code settings under the `clouddev.preview` namespace:

```jsonc
{
  "clouddev.preview.web.urlTemplate": "http://localhost:%PORT%/",
  "clouddev.preview.emulator.urlTemplate": "http://localhost:%PORT%%PATH%"
}
```

- `%PORT%` **must** be replaced with the configured port.
- `%PATH%` **must** be replaced with the configured path (or empty string if not provided).
- The template can be changed by the user / environment maintainers to support custom proxying schemes, such as:

```jsonc
"clouddev.preview.web.urlTemplate": "https://my-code-server.example.com/proxy/%PORT%/"
```

### 5.2 Commands

The extension will expose the following commands:

1. **`clouddev.runWebApp`** – “CloudDev: Run Web App”
   - Reads `.clouddev.json`.
   - Starts a terminal in workspace root.
   - Runs `web.startCommand`.

2. **`clouddev.openWebPreview`** – “CloudDev: Open Web Preview”
   - Reads `.clouddev.json` → `web.port`.
   - Reads `clouddev.preview.web.urlTemplate`.
   - Constructs URL by replacing `%PORT%`.
   - Opens the URL:
     - First version: in external browser via `vscode.env.openExternal`.
     - Optionally (configurable in future): in a webview tab with an `<iframe>`.

3. **`clouddev.startEmulator`** – “CloudDev: Start Android Emulator”
   - Reads `.clouddev.json` → `emulator.startCommand`.
   - Starts a terminal in workspace root.
   - Runs `emulator.startCommand`.

4. **`clouddev.openEmulatorView`** – “CloudDev: Open Emulator View”
   - Reads `.clouddev.json` → `emulator.port`, `emulator.path`.
   - Reads `clouddev.preview.emulator.urlTemplate`.
   - Constructs URL with `%PORT%` and `%PATH%`.
   - Opens a webview tab named “Android Emulator” embedding the URL in an `<iframe>`.

5. **`clouddev.runFlutterApp`** – “CloudDev: Run Flutter App (Emulator)”
   - Reads `.clouddev.json` → `flutter.runCommand`.
   - Starts a terminal in workspace root.
   - Runs `flutter.runCommand`.

### 5.3 Error Handling

- If `.clouddev.json` is missing:
  - Show an error: “CloudDev: .clouddev.json not found in workspace root”.
- If a required field is missing (e.g. `web.port` while running `openWebPreview`):
  - Show a specific error: “CloudDev: web.port not defined in .clouddev.json”.
- If URL templates are missing:
  - Use sensible defaults (e.g. `http://localhost:%PORT%/` and `http://localhost:%PORT%%PATH%`).

### 5.4 Environment Assumptions

- The extension assumes:
  - It runs in the **same environment** as code-server or VS Code.
  - It can start terminals that have access to:
    - Node tooling for web commands.
    - Flutter SDK & Android SDK for mobile commands.
    - Any scripts referenced in `.clouddev.json`.

- The extension **does not**:
  - Check for the existence of Node/Flutter/emulator binaries (initial version).
  - Validate whether ports are reachable.
  - Manage permissions or firewall rules.

---

## 6. Non-functional Requirements

1. **Environment-agnostic**
   - No use of Docker-specific or VM-specific APIs.
   - Purely uses VS Code APIs and shell commands.

2. **Performance**
   - Extension activation should be fast (< 100ms perceived).
   - Command execution overhead minimal (most work delegated to terminals).

3. **Security**
   - Webviews should:
     - Only embed URLs configured via templates.
     - Not allow arbitrary script injection beyond what is required by the remote page.
   - Extension does not store secrets or credentials.

4. **Maintainability**
   - Clear separation between:
     - Config parsing.
     - Command registration.
     - Webview rendering.
   - Written in TypeScript with type-safe config interfaces.

5. **Extensibility**
   - Future support for other platforms (e.g. iOS simulators via remote Mac hosting) should not require large structural changes.
   - Potential for additional commands (e.g. “CloudDev: Stop Web App”, “CloudDev: Stop Emulator”) without redesign.

---

## 7. Proposed Architecture

### 7.1 High-Level Components

1. **Config Loader**
   - Responsible for:
     - Finding `.clouddev.json` in workspace root.
     - Parsing and mapping to a `CloudDevConfig` interface.
   - Handles config-related errors.

2. **Command Handlers**
   - One handler per command:
     - `runWebAppHandler`
     - `openWebPreviewHandler`
     - `startEmulatorHandler`
     - `openEmulatorViewHandler`
     - `runFlutterAppHandler`
   - Each uses the config loader and VS Code APIs (`createTerminal`, `env.openExternal`, `window.createWebviewPanel`).

3. **Preview URL Builder**
   - Utility to construct URLs:
     - Reads VS Code settings (`clouddev.preview.*.urlTemplate`).
     - Replaces `%PORT%` and `%PATH%` placeholders.

4. **Webview Renderer**
   - For emulator view (and optionally web app preview):
     - Creates HTML skeleton with a full-screen `<iframe>`.
     - Embeds generated URL.

### 7.2 Sequence Flows

#### 7.2.1 Run Web App

1. User triggers `clouddev.runWebApp` command.
2. Extension:
   - Loads config.
   - Validates `web.startCommand`.
   - Creates a terminal and sends `web.startCommand`.

#### 7.2.2 Open Web Preview

1. User triggers `clouddev.openWebPreview`.
2. Extension:
   - Loads config.
   - Validates `web.port`.
   - Reads `clouddev.preview.web.urlTemplate` from settings.
   - Constructs URL and opens it via `vscode.env.openExternal` or a webview.

#### 7.2.3 Start Emulator

1. User triggers `clouddev.startEmulator`.
2. Extension:
   - Loads config.
   - Validates `emulator.startCommand`.
   - Creates a terminal and sends `emulator.startCommand`.

#### 7.2.4 Open Emulator View

1. User triggers `clouddev.openEmulatorView`.
2. Extension:
   - Loads config.
   - Validates `emulator.port`.
   - Reads `clouddev.preview.emulator.urlTemplate`.
   - Generates URL with `%PORT%` and `%PATH%`.
   - Creates webview tab with `<iframe src="URL">`.

#### 7.2.5 Run Flutter App

1. User triggers `clouddev.runFlutterApp`.
2. Extension:
   - Loads config.
   - Validates `flutter.runCommand`.
   - Creates a terminal and sends `flutter.runCommand`.

---

## 8. Tech Stack

### 8.1 Extension

- **Language:** TypeScript
- **Target:** VS Code extension API (compatible with VS Code and code-server / VS Code Server)
- **Build tooling:**
  - `typescript` (tsc)
  - `vsce` or `@vscode/vsce` for packaging
- **Key VS Code APIs used:**
  - `vscode.commands.registerCommand`
  - `vscode.window.createTerminal`
  - `vscode.window.createWebviewPanel`
  - `vscode.env.openExternal`
  - `vscode.workspace.getConfiguration`
  - `vscode.workspace.workspaceFolders`

### 8.2 Cloud Environment (Out of Scope but Required)

> Note: The extension does **not** provision or install these; they must exist in the environment where code-server runs.

- Web:
  - Node.js, package manager (npm / yarn / pnpm)
  - Any framework-specific tooling (Vite, Next.js, etc.)

- Flutter + Android:
  - Flutter SDK
  - Android SDK & AVD manager
  - At least one AVD configured (e.g. `Pixel_4_API_34`)
  - X11 display system (e.g. `Xvfb`)
  - Window manager (e.g. `openbox`)
  - VNC server (e.g. `x11vnc`)
  - noVNC + websockify

- Custom scripts (example):
  - `scripts/start_emulator.sh` to start:
    - Xvfb
    - Window manager
    - VNC server
    - noVNC HTTP service on `emulator.port`
    - Android emulator binary

### 8.3 Configuration & Settings

- Project config:
  - `.clouddev.json` in repo root.
- VS Code/config server settings:
  - `clouddev.preview.web.urlTemplate`
  - `clouddev.preview.emulator.urlTemplate`

---

## 9. Example Files

### 9.1 Example `.clouddev.json`

```json
{
  "web": {
    "startCommand": "npm run dev",
    "port": 5173
  },
  "flutter": {
    "runCommand": "flutter run -d emulator-5554"
  },
  "emulator": {
    "startCommand": "bash scripts/start_emulator.sh",
    "port": 6080,
    "path": "/vnc.html?autoconnect=1"
  }
}
```

### 9.2 Example extension `package.json` (core parts)

```json
{
  "name": "clouddev-helper",
  "displayName": "CloudDev Helper",
  "description": "Run and preview web and mobile apps on a cloud code-server instance.",
  "version": "0.0.1",
  "engines": {
    "vscode": "^1.95.0"
  },
  "categories": ["Other"],
  "activationEvents": [
    "onCommand:clouddev.runWebApp",
    "onCommand:clouddev.openWebPreview",
    "onCommand:clouddev.startEmulator",
    "onCommand:clouddev.openEmulatorView",
    "onCommand:clouddev.runFlutterApp"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "clouddev.runWebApp",
        "title": "CloudDev: Run Web App"
      },
      {
        "command": "clouddev.openWebPreview",
        "title": "CloudDev: Open Web Preview"
      },
      {
        "command": "clouddev.startEmulator",
        "title": "CloudDev: Start Android Emulator"
      },
      {
        "command": "clouddev.openEmulatorView",
        "title": "CloudDev: Open Emulator View"
      },
      {
        "command": "clouddev.runFlutterApp",
        "title": "CloudDev: Run Flutter App (Emulator)"
      }
    ],
    "configuration": {
      "type": "object",
      "title": "CloudDev Preview Settings",
      "properties": {
        "clouddev.preview.web.urlTemplate": {
          "type": "string",
          "default": "http://localhost:%PORT%/",
          "description": "URL template for web app preview. Use %PORT% placeholder for the dev server port."
        },
        "clouddev.preview.emulator.urlTemplate": {
          "type": "string",
          "default": "http://localhost:%PORT%%PATH%",
          "description": "URL template for emulator (noVNC) preview. Use %PORT% for port and %PATH% for the path from .clouddev.json."
        }
      }
    }
  }
}
```

---

## 10. Future Enhancements (Backlog)

1. **Process Management**
   - Add commands to stop dev server / emulator (e.g. tracking PIDs, using a helper daemon).

2. **Health Checks**
   - Automatically detect when the web app or emulator is ready before opening previews.

3. **Config Wizard**
   - Provide a command to generate `.clouddev.json` interactively based on detected frameworks (e.g. “Is this a Flutter project?” / “Is this a Vite app?”).

4. **Per-project Profiles**
   - Support multiple profiles per project (e.g. `dev`, `staging`) with different commands/ports.

5. **Integration with Debug Configurations**
   - Auto-generate `launch.json` for additional debugging workflows (Chrome, Dart/Flutter debug sessions, etc.).

6. **Multi-root Workspace Support**
   - Support more than one project/folder per workspace.

---

## 11. Acceptance Criteria (v0.1)

- [ ] Extension can be installed and activated in VS Code and code-server.
- [ ] Given a valid `.clouddev.json` with `web` config:
  - [ ] `CloudDev: Run Web App` starts the defined command in a terminal.
  - [ ] `CloudDev: Open Web Preview` opens the correct URL based on `web.port` and `clouddev.preview.web.urlTemplate`.
- [ ] Given a valid `.clouddev.json` with `emulator` and `flutter` configs:
  - [ ] `CloudDev: Start Android Emulator` runs the defined `emulator.startCommand`.
  - [ ] `CloudDev: Open Emulator View` opens a webview embedding the URL built from `emulator.port`, `emulator.path`, and `clouddev.preview.emulator.urlTemplate`.
  - [ ] `CloudDev: Run Flutter App` runs the defined `flutter.runCommand` in a terminal.
- [ ] The extension behaves identically whether code-server is running in a VM or a Docker container, assuming tooling is correctly installed and network is configured.

---

_End of PRD v0.1_
