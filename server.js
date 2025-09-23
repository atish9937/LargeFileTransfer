const express = require('express');
const http = require('http');
const path = require('path'); // Import path module
const { Server } = require('socket.io');

// Load environment variables
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Rate limiting configuration
const connectionCounts = new Map(); // Track connections per IP
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_CONNECTIONS_PER_IP = 10;

// Clean up old rate limit entries
setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of connectionCounts.entries()) {
        if (now - data.firstConnection > RATE_LIMIT_WINDOW) {
            connectionCounts.delete(ip);
        }
    }
}, RATE_LIMIT_WINDOW);

  // In server.js
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? ["https://largefiletransfer.org", "https://www.largefiletransfer.org"]
            : ["http://localhost:3000", "http://127.0.0.1:3000"],
        credentials: true
    },
    serveClient: true,
    path: '/socket.io/',
    // Add these for better compatibility
    allowEIO3: true,
    transports: ['websocket', 'polling']
});

const PORT = process.env.PORT || 3000;

// Set a Content Security Policy
app.use((req, res, next) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const connectSrc = isProduction
        ? "'self' wss://largefiletransfer.org https://cdnjs.cloudflare.com"
        : "'self' ws://localhost:3000 wss://localhost:3000 https://cdnjs.cloudflare.com";

    res.setHeader(
        'Content-Security-Policy',
        `default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src ${connectSrc}; img-src 'self' data:;`
    );
    next();
});

// Serve static files (e.g., socket.io.js)
app.use(express.static(path.join(__dirname)));

// Explicitly serve Socket.io client library (backup route)
app.get('/socket.io/socket.io.js', (req, res) => {
    res.sendFile(require.resolve('socket.io/client-dist/socket.io.js'));
});

// Redirect root to /send for a better user experience
app.get('/(|/)', (req, res) => {
    res.sendFile(path.join(__dirname, 'home.html'));
});

app.get('/about(|/)', (req, res) => {
    res.sendFile(path.join(__dirname, 'about.html'));
});

app.get('/privacy(|/)', (req, res) => {
    res.sendFile(path.join(__dirname, 'privacy.html'));
});

app.get('/terms(|/)', (req, res) => {
    res.sendFile(path.join(__dirname, 'terms.html'));
});

// Handle sender route
app.get('/send(|/)', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle receiver route with dedicated receive page
app.get('/receive/:roomId', (req, res) => {
    res.sendFile(path.join(__dirname, 'receive.html'));
});

// Secure TURN server configuration endpoint
app.get('/api/turn-config', (req, res) => {
    // Base configuration with STUN servers
    const turnConfig = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun.services.mozilla.com' }
        ],
        iceCandidatePoolSize: 10
    };

    // Add TURN servers if credentials are available in environment
    if (process.env.TURN_SERVER_URL && process.env.TURN_SERVER_USERNAME && process.env.TURN_SERVER_PASSWORD) {
        // Add UDP TURN server
        turnConfig.iceServers.push({
            urls: process.env.TURN_SERVER_URL,
            username: process.env.TURN_SERVER_USERNAME,
            credential: process.env.TURN_SERVER_PASSWORD
        });

        // Add TLS TURN server if available
        if (process.env.TURN_SERVER_TLS_URL) {
            turnConfig.iceServers.push({
                urls: process.env.TURN_SERVER_TLS_URL,
                username: process.env.TURN_SERVER_USERNAME,
                credential: process.env.TURN_SERVER_PASSWORD
            });
        }

        console.log('TURN server configuration loaded successfully');
    } else {
        console.log('TURN server credentials not found, using STUN-only configuration');
    }

    res.json(turnConfig);
});

// Input validation functions
function isValidRoomId(roomId) {
    return typeof roomId === 'string' && /^[a-zA-Z0-9]{8,15}$/.test(roomId);
}

function isValidSocketData(data) {
    return data && typeof data === 'object' && isValidRoomId(data.roomId);
}

// Rate limiting middleware for socket connections
io.use((socket, next) => {
    const clientIP = socket.handshake.address;
    const now = Date.now();

    if (!connectionCounts.has(clientIP)) {
        connectionCounts.set(clientIP, {
            count: 1,
            firstConnection: now
        });
    } else {
        const ipData = connectionCounts.get(clientIP);
        if (now - ipData.firstConnection <= RATE_LIMIT_WINDOW) {
            if (ipData.count >= MAX_CONNECTIONS_PER_IP) {
                return next(new Error('Rate limit exceeded'));
            }
            ipData.count++;
        } else {
            // Reset counter for new window
            connectionCounts.set(clientIP, {
                count: 1,
                firstConnection: now
            });
        }
    }
    next();
});

io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // A user wants to join a room
    socket.on('join-room', (roomId) => {
        if (!isValidRoomId(roomId)) {
            socket.emit('error', 'Invalid room ID format');
            return;
        }

        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
        // Notify others in the room that a new user has joined
        socket.to(roomId).emit('user-joined', socket.id);
    });

    // Pass on WebRTC offers, answers, and ICE candidates
    socket.on('offer', (data) => {
        if (!isValidSocketData(data) || !data.sdp) {
            return; // Silently ignore invalid data
        }
        socket.to(data.roomId).emit('offer', { sdp: data.sdp, from: socket.id });
    });

    socket.on('answer', (data) => {
        if (!isValidSocketData(data) || !data.sdp) {
            return; // Silently ignore invalid data
        }
        socket.to(data.roomId).emit('answer', { sdp: data.sdp, from: socket.id });
    });

    socket.on('ice-candidate', (data) => {
        if (!isValidSocketData(data) || !data.candidate) {
            return; // Silently ignore invalid data
        }
        socket.to(data.roomId).emit('ice-candidate', { candidate: data.candidate, from: socket.id });
    });

    // File metadata transfer
    socket.on('file-meta', (data) => {
        if (!isValidSocketData(data) || !data.metadata || typeof data.metadata !== 'object') {
            return; // Silently ignore invalid data
        }

        // Validate metadata
        const { name, size } = data.metadata;
        if (typeof name !== 'string' || typeof size !== 'number' || size < 0 || size > 10 * 1024 * 1024 * 1024) {
            return; // Silently ignore invalid metadata
        }

        socket.to(data.roomId).emit('file-meta', data.metadata);
    });

    socket.on('transfer-done', (data) => {
        if (!isValidSocketData(data)) {
            return; // Silently ignore invalid data
        }
        socket.to(data.roomId).emit('transfer-done');
    });

    socket.on('transfer-confirmed', (data) => {
        if (!isValidSocketData(data)) {
            return; // Silently ignore invalid data
        }
        socket.to(data.roomId).emit('transfer-confirmed');
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        // In a real app, you might want to notify rooms about the disconnection
    });
});

server.listen(PORT, () => {
    console.log(`Signaling server listening on *:${PORT}`);
});
