/**
 * Webview Manager Service
 *
 * Manages webview panels for embedding noVNC and other preview content.
 */

import * as vscode from 'vscode';

export class WebviewManager {
    private panels: Map<string, vscode.WebviewPanel> = new Map();

    constructor(private context: vscode.ExtensionContext) {}

    /**
     * Opens or reveals the emulator view webview
     *
     * @param url - The noVNC URL to embed
     */
    async openEmulatorView(url: string): Promise<void> {
        const panelId = 'clouddev.emulatorView';

        // Check if panel already exists
        const existing = this.panels.get(panelId);
        if (existing) {
            existing.reveal(vscode.ViewColumn.Two);
            // Update the content with the new URL
            existing.webview.html = await this.getEmulatorHtml(existing.webview, url);
            return;
        }

        // Resolve URL for remote development scenarios
        const resolvedUrl = await this.resolveUrl(url);

        // Create new panel
        const panel = vscode.window.createWebviewPanel(
            panelId,
            'Android Emulator',
            vscode.ViewColumn.Two,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: []
            }
        );

        panel.webview.html = await this.getEmulatorHtml(panel.webview, resolvedUrl);

        // Track panel
        this.panels.set(panelId, panel);

        // Handle disposal
        panel.onDidDispose(() => {
            this.panels.delete(panelId);
        });

        // Handle visibility changes
        panel.onDidChangeViewState((e) => {
            if (e.webviewPanel.visible) {
                // Panel became visible - could refresh content here
            }
        });
    }

    /**
     * Resolves a URL for remote development scenarios
     *
     * @param url - The local URL
     * @returns The resolved external URL
     */
    private async resolveUrl(url: string): Promise<string> {
        try {
            const localUri = vscode.Uri.parse(url);
            const externalUri = await vscode.env.asExternalUri(localUri);
            return externalUri.toString();
        } catch {
            // If resolution fails, return the original URL
            return url;
        }
    }

    /**
     * Generates the HTML content for the emulator webview
     *
     * @param webview - The webview instance
     * @param url - The noVNC URL to embed
     * @returns The HTML content
     */
    private async getEmulatorHtml(webview: vscode.Webview, url: string): Promise<string> {
        // Extract origin for CSP
        let frameOrigin = '*';
        try {
            const urlObj = new URL(url);
            frameOrigin = urlObj.origin;
        } catch {
            // Use wildcard if URL parsing fails
        }

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none';
                   frame-src ${frameOrigin} http: https:;
                   style-src 'unsafe-inline';">
    <title>Android Emulator</title>
    <style>
        html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            background-color: #1e1e1e;
        }
        .container {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
        }
        .toolbar {
            height: 32px;
            background-color: #252526;
            border-bottom: 1px solid #3c3c3c;
            padding: 0 12px;
            display: flex;
            align-items: center;
            gap: 12px;
        }
        .toolbar-title {
            color: #cccccc;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 12px;
            flex: 1;
        }
        .toolbar-button {
            background: #0e639c;
            color: white;
            border: none;
            padding: 4px 12px;
            border-radius: 3px;
            font-size: 11px;
            cursor: pointer;
            font-family: inherit;
        }
        .toolbar-button:hover {
            background: #1177bb;
        }
        iframe {
            flex: 1;
            width: 100%;
            border: none;
        }
        .loading {
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100%;
            color: #cccccc;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            flex-direction: column;
            gap: 16px;
        }
        .spinner {
            width: 32px;
            height: 32px;
            border: 3px solid #3c3c3c;
            border-top-color: #0e639c;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .error-message {
            color: #f48771;
            text-align: center;
            padding: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="toolbar">
            <span class="toolbar-title">Android Emulator - noVNC</span>
            <button class="toolbar-button" onclick="refreshFrame()">Refresh</button>
            <button class="toolbar-button" onclick="openExternal()">Open External</button>
        </div>
        <iframe
            id="emulator-frame"
            src="${url}"
            allow="fullscreen; clipboard-read; clipboard-write"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            loading="eager"
        ></iframe>
    </div>
    <script>
        function refreshFrame() {
            const frame = document.getElementById('emulator-frame');
            frame.src = frame.src;
        }
        function openExternal() {
            const frame = document.getElementById('emulator-frame');
            window.open(frame.src, '_blank');
        }
    </script>
</body>
</html>`;
    }

    /**
     * Checks if the emulator view is open
     */
    isEmulatorViewOpen(): boolean {
        return this.panels.has('clouddev.emulatorView');
    }

    /**
     * Closes the emulator view
     */
    closeEmulatorView(): void {
        const panel = this.panels.get('clouddev.emulatorView');
        if (panel) {
            panel.dispose();
            this.panels.delete('clouddev.emulatorView');
        }
    }

    /**
     * Disposes all panels
     */
    dispose(): void {
        for (const panel of this.panels.values()) {
            panel.dispose();
        }
        this.panels.clear();
    }
}
