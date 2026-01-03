/**
 * Magic Link Service
 *
 * Generates one-time magic links for runner setup.
 * Each link contains an embedded token that expires after use or timeout.
 */

import { customAlphabet } from 'nanoid';
import { v4 as uuidv4 } from 'uuid';
import { MagicLink } from '../types';

// Short, URL-safe codes for magic links
const generateCode = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

export class MagicLinkService {
    private links: Map<string, MagicLink> = new Map();
    private readonly EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

    /**
     * Generate a new magic link
     */
    generate(): MagicLink {
        const code = generateCode();
        const token = uuidv4();
        const now = new Date();

        const link: MagicLink = {
            code,
            token,
            createdAt: now,
            expiresAt: new Date(now.getTime() + this.EXPIRY_MS),
            used: false
        };

        this.links.set(code, link);

        // Auto-cleanup expired links
        this.cleanupExpired();

        return link;
    }

    /**
     * Validate and consume a magic link code
     * Returns the token if valid, null otherwise
     */
    consume(code: string): string | null {
        const link = this.links.get(code);

        if (!link) {
            return null;
        }

        if (link.used) {
            return null;
        }

        if (new Date() > link.expiresAt) {
            this.links.delete(code);
            return null;
        }

        // Mark as used
        link.used = true;

        return link.token;
    }

    /**
     * Validate a token (for WebSocket connections)
     */
    validateToken(token: string): boolean {
        for (const link of this.links.values()) {
            if (link.token === token && link.used) {
                return true;
            }
        }
        return false;
    }

    /**
     * Get link info by code (for status checks)
     */
    getByCode(code: string): MagicLink | null {
        return this.links.get(code) || null;
    }

    /**
     * Remove expired links
     */
    private cleanupExpired(): void {
        const now = new Date();
        for (const [code, link] of this.links.entries()) {
            // Remove expired unused links, keep used ones for token validation
            if (!link.used && now > link.expiresAt) {
                this.links.delete(code);
            }
            // Remove old used links after 1 hour
            if (link.used && now.getTime() - link.createdAt.getTime() > 60 * 60 * 1000) {
                this.links.delete(code);
            }
        }
    }

    /**
     * Get all active (unused, not expired) links
     */
    getActiveLinks(): MagicLink[] {
        const now = new Date();
        return Array.from(this.links.values()).filter(
            link => !link.used && now < link.expiresAt
        );
    }
}
