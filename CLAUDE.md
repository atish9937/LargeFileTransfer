# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

DirectDrop is a peer-to-peer file transfer web application using WebRTC for direct file sharing. The project consists of a Node.js signaling server and a client-side WebRTC implementation that enables secure file transfers without uploading files to servers.

## Development Commands

### Running the Application
```bash
npm start          # Start the signaling server on port 3000
node server.js     # Alternative way to start the server
```

### Dependencies
```bash
npm install        # Install all dependencies (express, socket.io)
```

## Architecture Overview

### Backend (server.js)
- **Express server** serving static files and handling routing
- **Socket.io signaling server** for WebRTC peer connection establishment
- **Security middleware** with Content Security Policy headers
- **Room-based routing** where each file transfer gets a unique room ID

### Frontend (index.html)
- **Single-page application** handling both sender and receiver flows
- **WebRTC data channels** for peer-to-peer file transfer
- **File System Access API** integration for streaming large files directly to disk (Chrome/Edge)
- **Progressive enhancement** with fallback to blob download for unsupported browsers

### Key Components

1. **Signaling Flow**: Socket.io handles WebRTC offer/answer exchange and ICE candidate relay
2. **File Transfer**: Uses RTCDataChannel with 64KB chunks and backpressure management
3. **UI States**: Three main screens - file selection, sharing (with QR code), and receiving
4. **Routing**: URL-based routing distinguishes between senders (`/send`) and receivers (`/receive/:roomId`)

## Important Implementation Details

### WebRTC Configuration
- Uses Google and Mozilla STUN servers for NAT traversal
- TODO comments indicate TURN server setup needed for production
- Data channel configured for reliable file transfer

### Large File Handling
- File System Access API allows streaming to disk (bypasses memory limits)
- Fallback to blob-based download for Safari and older browsers
- Chunked transfer with progress tracking

### Security Considerations
- Content Security Policy restricts script and connection sources
- CORS configured for specific origins (needs production domain update)
- Peer-to-peer architecture avoids server-side file storage

## Development Notes

- The TODO.md file indicates planned large file streaming improvements
- Production deployment requires updating domain references in server.js and index.html
- WebRTC TURN servers needed for NAT traversal in restrictive network environments