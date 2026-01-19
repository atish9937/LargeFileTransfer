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

const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? ["https://largefiletransfer.org", "https://www.largefiletransfer.org"]
            : ["http://localhost:3000", "http://127.0.0.1:3000"],
        credentials: true,
        methods: ["GET", "POST"],
        transports: ['websocket', 'polling']
    },
    serveClient: true,
    path: '/socket.io/',
    allowEIO4: true,
    // Add these for better transport handling
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    maxHttpBufferSize: 1e6
});

const PORT = process.env.PORT || 3000;

// Add CORS middleware specifically for Socket.io endpoints
// Disable caching for HTML/JS/CSS files in development
app.use((req, res, next) => {
    // Don't cache HTML, JS, CSS files
    if (req.path.match(/\.(html|js|css)$/)) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    next();
});

app.use('/socket.io/*', (req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://largefiletransfer.org');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

// Set a Content Security Policy
app.use((req, res, next) => {
    const isProduction = process.env.NODE_ENV === 'production';
    const connectSrc = isProduction
        ? "'self' https://largefiletransfer.org wss://largefiletransfer.org https://cdnjs.cloudflare.com"
        : "'self' http://localhost:3000 ws://localhost:3000 wss://localhost:3000 https://cdnjs.cloudflare.com";

    res.setHeader(
        'Content-Security-Policy',
        `default-src 'self'; script-src 'self' https://cdnjs.cloudflare.com 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com; connect-src ${connectSrc}; img-src 'self' data:;`
    );
    next();
});

// Serve static files (e.g., socket.io.js)
app.use(express.static(path.join(__dirname)));

// Explicitly serve Socket.io client library (backup route)
app.get('/socket.io/socket.io.js', (req, res) => {
    res.sendFile(require.resolve('socket.io/client-dist/socket.io.js'));
});

// Serve home page for root - includes file transfer functionality
app.get('/(|/)', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/home(|/)', (req, res) => {
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

// Blog routes
app.get('/blog(|/)', (req, res) => {
    res.sendFile(path.join(__dirname, 'blog.html'));
});

// Serve blog images statically - MUST come before /blog/:slug route
app.use('/blog/images', express.static(path.join(__dirname, 'blog', 'images')));

// Individual blog post route - must come after /blog/ and /blog/images routes
app.get('/blog/:slug', (req, res) => {
    const slug = req.params.slug;
    const blogPostPath = path.join(__dirname, 'blog', `${slug}.html`);

    // Check if file exists
    const fs = require('fs');
    if (fs.existsSync(blogPostPath)) {
        res.sendFile(blogPostPath);
    } else {
        // Blog post not found, redirect to blog listing
        res.redirect('/blog');
    }
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

// Store rooms with password hashes (in-memory)
const rooms = new Map(); // { roomId: { users: Set, passwordHash: string|null, createdAt: Date } }

// Cleanup old rooms every 10 minutes
setInterval(() => {
    const now = new Date();
    const ROOM_TIMEOUT = 10 * 60 * 1000; // 10 minutes

    rooms.forEach((room, roomId) => {
        const age = now - room.createdAt;
        if (age > ROOM_TIMEOUT && room.users.size === 0) {
            rooms.delete(roomId);
            console.log('Cleaned up old room:', roomId);
        }
    });
}, 10 * 60 * 1000);

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

    // Check if room exists and if it's protected
    socket.on('check-room', ({ roomId }) => {
        if (!isValidRoomId(roomId)) {
            socket.emit('room-not-found');
            return;
        }

        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('room-not-found');
            return;
        }

        const roomInfo = {
            exists: true,
            isProtected: !!room.passwordHash,
            hasUsers: room.users.size > 0
        };

        socket.emit('room-info', roomInfo);
    });

    // Verify password for protected room
    socket.on('verify-password', ({ roomId, passwordHash }) => {
        if (!isValidRoomId(roomId) || typeof passwordHash !== 'string') {
            socket.emit('password-verified', { valid: false });
            return;
        }

        const room = rooms.get(roomId);

        if (!room) {
            socket.emit('password-verified', { valid: false });
            return;
        }

        // Check if password matches
        const isValid = room.passwordHash === passwordHash;

        socket.emit('password-verified', { valid: isValid });

        if (isValid) {
            console.log('Password verified for room:', roomId);
        } else {
            console.log('Invalid password attempt for room:', roomId);
        }
    });

    // A user wants to join a room
    socket.on('join-room', (data, callback) => {
        // Handle both old format (string) and new format (object)
        let roomId, passwordHash, isProtected;

        if (typeof data === 'string') {
            // Old format: just roomId
            roomId = data;
            passwordHash = null;
            isProtected = false;
        } else if (typeof data === 'object' && data.roomId) {
            // New format: object with roomId, passwordHash, isProtected
            roomId = data.roomId;
            passwordHash = data.passwordHash || null;
            isProtected = data.isProtected || false;
        } else {
            socket.emit('error', 'Invalid join-room data');
            if (callback) callback({ success: false, error: 'Invalid data' });
            return;
        }

        if (!isValidRoomId(roomId)) {
            socket.emit('error', 'Invalid room ID format');
            if (callback) callback({ success: false, error: 'Invalid room ID' });
            return;
        }

        // If creating new room with password
        if (isProtected && passwordHash) {
            if (!rooms.has(roomId)) {
                rooms.set(roomId, {
                    users: new Set(),
                    passwordHash: passwordHash,
                    createdAt: new Date()
                });
                console.log('Created protected room:', roomId);
            }
        } else if (!rooms.has(roomId)) {
            // Create unprotected room
            rooms.set(roomId, {
                users: new Set(),
                passwordHash: null,
                createdAt: new Date()
            });
            console.log('Created unprotected room:', roomId);
        }

        const room = rooms.get(roomId);

        // Add user to room
        socket.join(roomId);
        room.users.add(socket.id);

        console.log(`User ${socket.id} joined room: ${roomId} - Total users: ${room.users.size}`);

        // Send acknowledgement that room is created
        if (callback) callback({ success: true, roomId });

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

        // Remove from all rooms and cleanup
        rooms.forEach((room, roomId) => {
            if (room.users.has(socket.id)) {
                room.users.delete(socket.id);
                socket.to(roomId).emit('user-left', { userId: socket.id });

                console.log(`User ${socket.id} left room: ${roomId} - Remaining users: ${room.users.size}`);

                // Delete room if empty
                if (room.users.size === 0) {
                    rooms.delete(roomId);
                    console.log('Deleted empty room:', roomId);
                }
            }
        });
    });
});

server.listen(PORT, () => {
    console.log(`Signaling server listening on *:${PORT}`);
});
