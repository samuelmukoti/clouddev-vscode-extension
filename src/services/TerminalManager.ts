/**
 * Terminal Manager Service
 *
 * Manages terminal creation, reuse, and disposal to prevent duplicate terminals.
 */

import * as vscode from 'vscode';

export class TerminalManager {
    private terminals: Map<string, vscode.Terminal> = new Map();
    private disposable: vscode.Disposable | null = null;

    /**
     * Initialize the terminal manager
     */
    initialize(context: vscode.ExtensionContext): void {
        // Listen for terminal disposal to clean up our tracking
        this.disposable = vscode.window.onDidCloseTerminal((terminal) => {
            for (const [name, t] of this.terminals.entries()) {
                if (t === terminal) {
                    this.terminals.delete(name);
                    break;
                }
            }
        });

        context.subscriptions.push(this.disposable);
    }

    /**
     * Gets an existing terminal or creates a new one
     *
     * @param name - The terminal name
     * @param cwd - Optional working directory
     * @returns The terminal instance
     */
    getOrCreateTerminal(name: string, cwd?: string): vscode.Terminal {
        // Check if terminal exists in our tracking
        const existing = this.terminals.get(name);
        if (existing) {
            existing.show();
            return existing;
        }

        // Also check VS Code's terminals (in case we lost track)
        const foundTerminal = vscode.window.terminals.find(t => t.name === name);
        if (foundTerminal) {
            this.terminals.set(name, foundTerminal);
            foundTerminal.show();
            return foundTerminal;
        }

        // Create new terminal
        const terminal = vscode.window.createTerminal({
            name,
            cwd: cwd || this.getWorkspaceRoot()
        });

        this.terminals.set(name, terminal);
        terminal.show();
        return terminal;
    }

    /**
     * Runs a command in a named terminal
     *
     * @param terminalName - The terminal name
     * @param command - The command to run
     * @param cwd - Optional working directory
     * @returns The terminal instance
     */
    runCommand(terminalName: string, command: string, cwd?: string): vscode.Terminal {
        const terminal = this.getOrCreateTerminal(terminalName, cwd);
        terminal.sendText(command);
        return terminal;
    }

    /**
     * Gets a terminal by name if it exists
     *
     * @param name - The terminal name
     * @returns The terminal or undefined
     */
    getTerminal(name: string): vscode.Terminal | undefined {
        return this.terminals.get(name);
    }

    /**
     * Checks if a terminal exists
     *
     * @param name - The terminal name
     * @returns True if the terminal exists
     */
    hasTerminal(name: string): boolean {
        return this.terminals.has(name);
    }

    /**
     * Disposes a terminal by name
     *
     * @param name - The terminal name
     * @returns True if the terminal was disposed
     */
    disposeTerminal(name: string): boolean {
        const terminal = this.terminals.get(name);
        if (terminal) {
            terminal.dispose();
            this.terminals.delete(name);
            return true;
        }
        return false;
    }

    /**
     * Disposes all tracked terminals
     */
    disposeAll(): void {
        for (const terminal of this.terminals.values()) {
            terminal.dispose();
        }
        this.terminals.clear();
    }

    /**
     * Gets the workspace root path
     */
    private getWorkspaceRoot(): string | undefined {
        const folders = vscode.workspace.workspaceFolders;
        return folders && folders.length > 0
            ? folders[0].uri.fsPath
            : undefined;
    }

    /**
     * Disposes of resources
     */
    dispose(): void {
        this.disposable?.dispose();
        // Don't dispose terminals on extension deactivation - let VS Code handle that
        this.terminals.clear();
    }
}
