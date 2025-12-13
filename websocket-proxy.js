#!/usr/bin/env node

/**
 * WebSocket Proxy Server for LG TV Control
 *
 * This proxy allows the HTML interface to work when hosted on a web server
 * by bypassing the "invalid origin" error that LG TVs enforce.
 *
 * Usage:
 *   node websocket-proxy.js [port]
 *
 * Default port: 8765
 *
 * Example:
 *   node websocket-proxy.js 8765
 */

const WebSocket = require('ws');
const http = require('http');

const PROXY_PORT = process.argv[2] || 8765;

// Create HTTP server for WebSocket proxy
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('LG TV WebSocket Proxy Server\nListening on port ' + PROXY_PORT);
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

console.log(`\n🚀 LG TV WebSocket Proxy Server`);
console.log(`📡 Listening on: ws://localhost:${PROXY_PORT}`);
console.log(`\n📝 Update your HTML file to connect to: ws://localhost:${PROXY_PORT}`);
console.log(`   Then access your hosted HTML page normally.\n`);

wss.on('connection', (clientWs, req) => {
    console.log('✅ Client connected from:', req.socket.remoteAddress);

    let tvWs = null;
    let tvIp = null;

    // Handle messages from browser client
    clientWs.on('message', (message) => {
        const data = message.toString();

        try {
            const json = JSON.parse(data);

            // Special command to set TV IP (sent before actual connection)
            if (json.type === '__PROXY_SET_TV_IP__') {
                tvIp = json.ip;
                console.log(`📺 TV IP set to: ${tvIp}`);
                return;
            }

            // If we don't have a TV connection yet, create it
            if (!tvWs && tvIp) {
                console.log(`🔗 Connecting to TV at wss://${tvIp}:3001`);

                tvWs = new WebSocket(`wss://${tvIp}:3001`, {
                    rejectUnauthorized: false  // Accept self-signed certs
                });

                tvWs.on('open', () => {
                    console.log('✅ Connected to TV');
                    // Forward the queued message
                    tvWs.send(data);
                });

                tvWs.on('message', (tvMessage) => {
                    // Forward message from TV to browser client
                    if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(tvMessage.toString());
                    }
                });

                tvWs.on('close', () => {
                    console.log('📴 TV connection closed');
                    if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.close();
                    }
                });

                tvWs.on('error', (error) => {
                    console.error('❌ TV connection error:', error.message);
                    if (clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(JSON.stringify({
                            type: 'error',
                            error: 'TV connection failed: ' + error.message
                        }));
                    }
                });
            } else if (tvWs && tvWs.readyState === WebSocket.OPEN) {
                // Forward message to TV
                tvWs.send(data);
            }
        } catch (e) {
            console.error('❌ Error parsing message:', e.message);
        }
    });

    clientWs.on('close', () => {
        console.log('📴 Client disconnected');
        if (tvWs) {
            tvWs.close();
        }
    });

    clientWs.on('error', (error) => {
        console.error('❌ Client error:', error.message);
    });
});

server.listen(PROXY_PORT, () => {
    console.log('✨ Proxy server is ready!\n');
});
