#!/usr/bin/env node
/**
 * CloudDev Coordinator CLI
 */

import { CoordinatorServer } from './server';

const PORT = parseInt(process.env.PORT || '7800', 10);
const BASE_URL = process.env.BASE_URL || process.env.COORDINATOR_URL;

async function main() {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║     🚀 CloudDev Runner Coordinator           ║');
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');

    const server = new CoordinatorServer({
        port: PORT,
        baseUrl: BASE_URL
    });

    await server.start();

    console.log(`✓ Server started on port ${PORT}`);
    if (BASE_URL) {
        console.log(`✓ External URL: ${BASE_URL}`);
    }
    console.log('');
    console.log('API Endpoints:');
    console.log(`  POST /api/v1/magic-link  - Generate setup link`);
    console.log(`  GET  /api/v1/runners     - List connected runners`);
    console.log(`  GET  /                   - Status dashboard`);
    console.log('');
    console.log('WebSocket:');
    console.log(`  /ws      - Runner connections`);
    console.log(`  /client  - VS Code extension`);
    console.log('');

    // Handle shutdown
    process.on('SIGINT', async () => {
        console.log('\\nShutting down...');
        await server.stop();
        process.exit(0);
    });

    process.on('SIGTERM', async () => {
        await server.stop();
        process.exit(0);
    });
}

main().catch((err) => {
    console.error('Failed to start coordinator:', err);
    process.exit(1);
});
