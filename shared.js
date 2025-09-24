// DirectDrop Shared JavaScript Functions
// This file contains common functions used by both sender and receiver pages

// ===== CONFIGURATION =====
const SIGNALING_SERVER_URL = window.location.origin;
const CHUNK_SIZE = 128 * 1024; // 128KB
const CONNECTION_ESTABLISHMENT_TIMEOUT = 5 * 60 * 1000; // 5 minutes - WebRTC connection setup
const WAITING_FOR_RECEIVER_TIMEOUT = 5 * 60 * 1000; // 5 minutes - waiting for someone to open link
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10GB limit
const ALLOWED_FILE_TYPES = []; // Empty array means all types allowed

// Debug mode - set to false for production
const DEBUG_MODE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// ===== DEBUG LOGGING =====
function debugLog(...args) {
    if (DEBUG_MODE) {
        console.log(...args);
    }
}

// ===== TIMEOUT HELPERS =====
function formatTimeout(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    if (minutes > 0) {
        return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
    }
    return `${seconds}s`;
}

// ===== WEBRTC CONFIGURATION =====
let rtcConfig = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun.services.mozilla.com' }
    ],
    iceCandidatePoolSize: 10
};

// Fetch TURN configuration from server
async function loadTurnConfig() {
    try {
        const response = await fetch('/api/turn-config');
        if (response.ok) {
            const config = await response.json();
            rtcConfig = config;
            
        } else {
            debugLog('Failed to load TURN config, using STUN-only');
        }
    } catch (error) {
        debugLog('Error loading TURN config:', error);
       
    }
}

// ===== ERROR AND SUCCESS DISPLAY =====
function showError(message, isTemporary = false) {
    const statusElement = document.getElementById('share-status') || document.getElementById('receive-status');
    if (statusElement) {
        statusElement.textContent = `Error: ${message}`;
        statusElement.style.color = '#dc3545';
        if (isTemporary) {
            setTimeout(() => {
                statusElement.style.color = '';
            }, 5000);
        }
    }
}

function showSuccess(message) {
    const statusElement = document.getElementById('share-status') || document.getElementById('receive-status');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.style.color = '#28a745';
    }
}

// ===== BROWSER COMPATIBILITY =====
function checkBrowserCompatibility() {
    const warnings = [];

    if (!window.RTCPeerConnection) {
        warnings.push('WebRTC is not supported in this browser. File transfer will not work.');
    }

    if (!('showSaveFilePicker' in window)) {
        warnings.push('Direct file saving is not supported in this browser. Files up to 4GB will be downloaded to your default download folder. For file transfer up to 10GB use Google Chrome or Microsoft Edge.');
    }

    if (!window.crypto || !window.crypto.getRandomValues) {
        warnings.push('Secure random number generation is not available. Room IDs may be less secure.');
    }

    return warnings;
}

function showCompatibilityWarnings() {
    // Check if device is mobile/tablet
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     window.innerWidth <= 768;

    const warnings = checkBrowserCompatibility();

    // Filter out the direct saving warning on mobile devices
    const filteredWarnings = warnings.filter(warning => {
        if (isMobile && warning.includes('Direct file saving is not supported')) {
            return false; // Hide this warning on mobile
        }
        return true;
    });

    if (filteredWarnings.length > 0) {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'compatibility-warning';
        warningDiv.innerHTML = '<strong>Browser Compatibility:</strong><br>' + filteredWarnings.join('<br>');

        const container = document.querySelector('.container');
        container.insertBefore(warningDiv, container.firstChild);
    }
}

// ===== FILE VALIDATION =====
function validateFile(file) {
    if (!file) {
        showError('No file selected');
        return false;
    }

    if (file.size > MAX_FILE_SIZE) {
        showError(`File too large. Maximum size is ${(MAX_FILE_SIZE / (1024*1024*1024)).toFixed(1)}GB`);
        return false;
    }

    if (ALLOWED_FILE_TYPES.length > 0 && !ALLOWED_FILE_TYPES.includes(file.type)) {
        showError('File type not allowed');
        return false;
    }

    return true;
}

// ===== WEBRTC SIGNALING HANDLERS =====
// ICE candidate queue to handle candidates that arrive before remote description
let iceCandidateQueue = [];

async function handleOffer(data, pc, socket, roomId) {
    if (roomId && pc && pc.signalingState === 'stable') {
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('answer', { roomId, sdp: pc.localDescription });
            

            // Process any queued ICE candidates
            await processQueuedIceCandidates(pc);
        } catch (error) {
       
            showError('Failed to establish connection');
        }
    }
}

async function handleAnswer(data, pc) {
    if (pc && pc.signalingState === 'have-local-offer') {
        try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        

            // Process any queued ICE candidates
            await processQueuedIceCandidates(pc);
        } catch (error) {
        
            showError('Failed to establish connection');
        }
    }
}

async function handleIceCandidate(data, pc) {
    if (pc) {
        // Check if remote description is set
        if (pc.remoteDescription && pc.remoteDescription.type) {
            try {
                await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
                if (DEBUG_MODE) debugLog('ICE candidate added immediately');
            } catch (error) {
                debugLog('Error adding ICE candidate:', error);
                // ICE candidate errors are usually non-fatal, so don't show user error
            }
        } else {
            // Queue the candidate for later processing
            iceCandidateQueue.push(data.candidate);
            if (DEBUG_MODE) debugLog('ICE candidate queued (remote description not yet set)');
        }
    }
}

// Process queued ICE candidates after remote description is set
async function processQueuedIceCandidates(pc) {
    while (iceCandidateQueue.length > 0) {
        const candidate = iceCandidateQueue.shift();
        try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
            if (DEBUG_MODE) debugLog('Queued ICE candidate processed');
        } catch (error) {
            debugLog('Error processing queued ICE candidate:', error);
        }
    }
}

// Clear ICE candidate queue (call when creating new peer connection)
function clearIceCandidateQueue() {
    iceCandidateQueue = [];
    
}

// ===== PROGRESS TRACKING =====
let transferStartTime = null;
let lastProgressUpdate = null;
let lastTransferredBytes = 0;

function updateProgressBar(elementId, value, max) {
    const progressBar = document.getElementById(elementId);
    if (progressBar) {
        const percentage = max > 0 ? (value / max) * 100 : 0;
        progressBar.style.width = `${percentage}%`;

        // Update detailed progress text
        updateProgressText(elementId, value, max, percentage);
    }
}

function updateProgressText(elementId, transferred, total, percentage) {
    const now = Date.now();

    // Initialize transfer start time
    if (!transferStartTime) {
        transferStartTime = now;
        lastProgressUpdate = now;
        lastTransferredBytes = 0;
    }

    // Calculate speed and ETA every 1000ms to avoid too frequent updates
    if (now - lastProgressUpdate >= 1000) {
        const elapsedTime = (now - transferStartTime) / 1000; // seconds
        const transferredSinceLastUpdate = transferred - lastTransferredBytes;
        const timeSinceLastUpdate = (now - lastProgressUpdate) / 1000;

        // Calculate current speed (bytes per second)
        const currentSpeed = timeSinceLastUpdate > 0 ? transferredSinceLastUpdate / timeSinceLastUpdate : 0;
        const averageSpeed = elapsedTime > 0 ? transferred / elapsedTime : 0;

        // Use average of current and overall speed for more stable readings
        const speed = (currentSpeed + averageSpeed) / 2;

        // Calculate ETA
        const remaining = total - transferred;
        const eta = speed > 0 ? remaining / speed : 0;

        // Format sizes
        const transferredFormatted = formatFileSize(transferred);
        const totalFormatted = formatFileSize(total);
        const speedFormatted = formatSpeed(speed);
        const etaFormatted = formatTime(eta);

        // Update status text based on element type
        let statusElementId;
        if (elementId === 'share-progress') {
            statusElementId = 'share-status';
        } else if (elementId === 'receive-progress') {
            statusElementId = 'receive-status';
        }

        if (statusElementId && percentage < 100) {
            const statusElement = document.getElementById(statusElementId);
            if (statusElement && transferred > 0) {
                const action = elementId === 'share-progress' ? 'Transferring' : 'Receiving';
                statusElement.textContent = `${action}... ${percentage.toFixed(1)}% (${transferredFormatted}/${totalFormatted}) • ${speedFormatted} • ETA: ${etaFormatted}`;
            }
        }

        lastProgressUpdate = now;
        lastTransferredBytes = transferred;
    }
}

function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function formatSpeed(bytesPerSecond) {
    if (bytesPerSecond < 1024) return `${bytesPerSecond.toFixed(0)} B/s`;
    if (bytesPerSecond < 1024 * 1024) return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
    if (bytesPerSecond < 1024 * 1024 * 1024) return `${(bytesPerSecond / 1024 / 1024).toFixed(1)} MB/s`;
    return `${(bytesPerSecond / 1024 / 1024 / 1024).toFixed(2)} GB/s`;
}

function formatTime(seconds) {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// Reset progress tracking when starting new transfer
function resetProgressTracking() {
    transferStartTime = null;
    lastProgressUpdate = null;
    lastTransferredBytes = 0;
}

// ===== ROOM ID GENERATION =====
function generateSecureRoomId() {
    if (window.crypto && window.crypto.getRandomValues) {
        const array = new Uint8Array(12);
        window.crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(36)).join('').substring(0, 11);
    } else {
        // Fallback for older browsers
        return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    }
}

// ===== FAQ TOGGLE FUNCTION =====
function toggleFAQ(questionElement) {
    const faqItem = questionElement.parentNode;
    const answer = faqItem.querySelector('.faq-answer');
    const toggle = questionElement.querySelector('.faq-toggle');

    // Close all other FAQ items
    document.querySelectorAll('.faq-item').forEach(item => {
        if (item !== faqItem) {
            item.querySelector('.faq-answer').classList.remove('active');
            item.querySelector('.faq-toggle').classList.remove('active');
        }
    });

    // Toggle current item
    answer.classList.toggle('active');
    toggle.classList.toggle('active');
}