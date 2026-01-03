/**
 * URL Builder Utility
 *
 * Handles URL template placeholder replacement for emulator preview URLs.
 */

export interface UrlBuilderOptions {
    /** URL template with %PORT% and %PATH% placeholders */
    template: string;
    /** Port number to substitute for %PORT% */
    port: number;
    /** Optional path to substitute for %PATH% (defaults to empty string) */
    path?: string;
}

/**
 * Builds a preview URL by replacing placeholders in the template.
 *
 * @param options - URL builder options
 * @returns The constructed URL
 * @throws Error if the resulting URL is invalid
 *
 * @example
 * buildPreviewUrl({
 *   template: 'http://localhost:%PORT%%PATH%',
 *   port: 6080,
 *   path: '/vnc.html?autoconnect=1'
 * });
 * // Returns: 'http://localhost:6080/vnc.html?autoconnect=1'
 */
export function buildPreviewUrl(options: UrlBuilderOptions): string {
    const { template, port, path = '' } = options;

    const url = template
        .replace(/%PORT%/g, port.toString())
        .replace(/%PATH%/g, path);

    // Validate the constructed URL
    try {
        new URL(url);
    } catch {
        throw new Error(`CloudDev: Invalid URL constructed: ${url}`);
    }

    return url;
}
