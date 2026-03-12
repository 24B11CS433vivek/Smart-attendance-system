/**
 * ==========================================
 * ATTENDANCE SCANNER - 100% WORKING VERSION
 * Camera + API + All Features Working
 * ==========================================
 */

// ============================================
// CONFIGURATION - YOUR API URL HERE
// ============================================
const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbym74lkksn7h8VktgkhVGNRQr__Zn3Ac86lHoXsL7hpH9gbGokw1UNDYySB-1JQcWGKNQ/exec',
    SCAN_DELAY: 2000,
    AUTO_CLOSE_RESULT: 3000,
    STORAGE_KEYS: {
        THEME: 'attendance_theme',
        ROOM: 'attendance_room',
        OFFLINE_QUEUE: 'attendance_offline_queue',
        RECENT_SCANS: 'attendance_recent_scans'
    },
    VALID_ROOMS: ['Room A', 'Room B', 'Room C', 'Room D', 'Room E', 'Room F', 'Room G', 'Room H', 'Room I', 'Room J']
};

// ============================================
// STATE
// ============================================
const state = {
    currentRoom: 'Room A',
    isScanning: false,
    isProcessing: false,
    scanner: null,
    currentCamera: 'environment',
    offlineQueue: [],
    recentScans: [],
    stats: { totalToday: 0, roomCounts: {} },
    lastScanTime: 0
};

// ============================================
// DOM ELEMENTS
// ============================================
let elements = {};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Attendance Scanner...');
    
    // Initialize elements
    elements = {
        themeToggle: document.getElementById('themeToggle'),
        roomButtons: document.getElementById('roomButtons'),
        scannerContainer: document.getElementById('scannerContainer'),
        scannerPlaceholder: document.getElementById('scannerPlaceholder'),
        scannerOverlay: document.getElementById('scannerOverlay'),
        reader: document.getElementById('reader'),
        startBtn: document.getElementById('startBtn'),
        stopBtn: document.getElementById('stopBtn'),
        switchCameraBtn: document.getElementById('switchCameraBtn'),
        manualEntryToggle: document.getElementById('manualEntryToggle'),
        manualEntryContent: document.getElementById('manualEntryContent'),
        manualCode: document.getElementById('manualCode'),
        manualSubmit: document.getElementById('manualSubmit'),
        resultSection: document.getElementById('resultSection'),
        resultCard: document.getElementById('resultCard'),
        closeResult: document.getElementById('closeResult'),
        todayCount: document.getElementById('todayCount'),
        recentScansList: document.getElementById('recentScansList'),
        refreshRecent: document.getElementById('refreshRecent'),
        offlineQueue: document.getElementById('offlineQueue'),
        queueCount: document.getElementById('queueCount'),
        retryQueue: document.getElementById('retryQueue'),
        connectionStatus: document.getElementById('connectionStatus'),
        loadingOverlay: document.getElementById('loadingOverlay'),
        toastContainer: document.getElementById('toastContainer'),
        successSound: document.getElementById('successSound'),
        errorSound: document.getElementById('errorSound'),
        scanSound: document.getElementById('scanSound')
    };
    
    // Initialize
    loadTheme();
    loadSavedRoom();
    loadOfflineQueue();
    setupEventListeners();
    updateConnectionStatus();
    fetchStats();
    fetchRecentScans();
    
    if (navigator.onLine) {
        processOfflineQueue();
    }
    
    console.log('✅ App initialized successfully');
});

// ============================================
// THEME
// ============================================
function loadTheme() {
    const theme = localStorage.getItem(CONFIG.STORAGE_KEYS.THEME) || 'light';
    document.documentElement.setAttribute('data-theme', theme);
    if (elements.themeToggle) {
        elements.themeToggle.querySelector('i').className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, newTheme);
    if (elements.themeToggle) {
        elements.themeToggle.querySelector('i').className = newTheme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    }
}

// ============================================
// ROOM MANAGEMENT
// ============================================
function loadSavedRoom() {
    const room = localStorage.getItem(CONFIG.STORAGE_KEYS.ROOM);
    if (room && CONFIG.VALID_ROOMS.includes(room)) {
        state.currentRoom = room;
        updateRoomSelection(room);
    }
}

function selectRoom(room) {
    state.currentRoom = room;
    localStorage.setItem(CONFIG.STORAGE_KEYS.ROOM, room);
    updateRoomSelection(room);
    showToast('info', 'Room Selected', room);
}

function updateRoomSelection(room) {
    document.querySelectorAll('.room-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.room === room);
    });
}

// ============================================
// SCANNER - CAMERA FUNCTIONS
// ============================================
async function startScanner() {
    if (state.isScanning) {
        console.log('Scanner already running');
        return;
    }
    
    console.log('📸 Starting scanner...');
    showToast('info', 'Starting Camera', 'Please allow camera access');
    
    try {
        // First check if camera is available
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(d => d.kind === 'videoinput');
        
        if (cameras.length === 0) {
            throw new Error('No camera found on this device');
        }
        
        console.log('Found cameras:', cameras.length);
        
        // Create scanner instance
        state.scanner = new Html5Qrcode("reader");
        
        // Scanner configuration
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            formatsToSupport: [
                Html5QrcodeSupportedFormats.QR_CODE,
                Html5QrcodeSupportedFormats.CODE_128,
                Html5QrcodeSupportedFormats.CODE_39,
                Html5QrcodeSupportedFormats.EAN_13,
                Html5QrcodeSupportedFormats.EAN_8,
                Html5QrcodeSupportedFormats.UPC_A,
                Html5QrcodeSupportedFormats.UPC_E
            ]
        };
        
        // Start scanning
        await state.scanner.start(
            { facingMode: state.currentCamera },
            config,
            onScanSuccess,
            onScanError
        );
        
        state.isScanning = true;
        
        // Update UI
        if (elements.startBtn) elements.startBtn.classList.add('hidden');
        if (elements.stopBtn) elements.stopBtn.classList.remove('hidden');
        if (elements.scannerPlaceholder) elements.scannerPlaceholder.classList.add('hidden');
        if (elements.scannerOverlay) elements.scannerOverlay.classList.add('active');
        
        showToast('success', 'Scanner Ready', 'Point at QR code or barcode');
        console.log('✅ Scanner started successfully');
        
    } catch (error) {
        console.error('❌ Camera error:', error);
        
        let errorMessage = 'Failed to start camera';
        
        if (error.name === 'NotAllowedError') {
            errorMessage = 'Camera access denied. Please allow camera in browser settings.';
        } else if (error.name === 'NotFoundError') {
            errorMessage = 'No camera found on this device';
        } else if (error.name === 'NotReadableError') {
            errorMessage = 'Camera is being used by another app';
        } else {
            errorMessage = error.message || 'Unknown camera error';
        }
        
        showToast('error', 'Camera Error', errorMessage);
        state.isScanning = false;
    }
}

async function stopScanner() {
    if (!state.isScanning || !state.scanner) {
        return;
    }
    
    console.log('🛑 Stopping scanner...');
    
    try {
        await state.scanner.stop();
        await state.scanner.clear();
    } catch (error) {
        console.error('Error stopping scanner:', error);
    }
    
    state.isScanning = false;
    state.scanner = null;
    
    // Update UI
    if (elements.startBtn) elements.startBtn.classList.remove('hidden');
    if (elements.stopBtn) elements.stopBtn.classList.add('hidden');
    if (elements.scannerPlaceholder) elements.scannerPlaceholder.classList.remove('hidden');
    if (elements.scannerOverlay) elements.scannerOverlay.classList.remove('active');
    
    console.log('✅ Scanner stopped');
}

async function switchCamera() {
    if (!state.isScanning) return;
    
    state.currentCamera = state.currentCamera === 'environment' ? 'user' : 'environment';
    await stopScanner();
    await startScanner();
}

function onScanSuccess(decodedText, decodedResult) {
    const now = Date.now();
    if (now - state.lastScanTime < CONFIG.SCAN_DELAY) {
        return;
    }
    state.lastScanTime = now;
    
    console.log('📋 Scanned:', decodedText);
    
    playSound('scan');
    if (navigator.vibrate) navigator.vibrate(100);
    
    processAttendance(decodedText.trim().toUpperCase());
}

function onScanError(error) {
    // Silent - don't log every frame
}

// ============================================
// ATTENDANCE PROCESSING
// ============================================
async function processAttendance(studentCode) {
    if (state.isProcessing) {
        console.log('Already processing...');
        return;
    }
    
    if (!studentCode || studentCode.length < 2) {
        showToast('error', 'Invalid Code', 'Please scan a valid code');
        return;
    }
    
    state.isProcessing = true;
    showLoading(true);
    
    console.log('📤 Processing:', studentCode, 'Room:', state.currentRoom);
    
    try {
        const payload = {
            studentCode: studentCode,
            room: state.currentRoom,
            clientTimestamp: new Date().toISOString()
        };
        
        // Check offline
        if (!navigator.onLine) {
            addToOfflineQueue(payload);
            showResult('warning', 'Offline', 'Saved - will sync when online', { studentCode: studentCode });
            return;
        }
        
        // Send to API
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error('Server error: ' + response.status);
        }
        
        const result = await response.json();
        console.log('📊 API Response:', result);
        
        if (result.success) {
            playSound('success');
            if (elements.scannerContainer) {
                elements.scannerContainer.classList.add('success');
                setTimeout(() => elements.scannerContainer.classList.remove('success'), 600);
            }
            
            showResult('success', 'Success!', 'Attendance recorded', result.data);
            addToRecentScans(result.data);
            state.stats.totalToday++;
            updateStatsUI();
            
        } else {
            playSound('error');
            if (elements.scannerContainer) {
                elements.scannerContainer.classList.add('error');
                setTimeout(() => elements.scannerContainer.classList.remove('error'), 600);
            }
            
            if (result.errorCode === 'DUPLICATE') {
                showResult('warning', 'Already Scanned!', 'Scanned earlier today', result.data || { studentCode: studentCode });
            } else {
                showResult('error', 'Failed', result.message || 'Unknown error', { studentCode: studentCode });
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        playSound('error');
        
        let errorMessage = 'Network error';
        if (error.name === 'AbortError') {
            errorMessage = 'Request timeout - check your internet';
        } else if (!navigator.onLine) {
            addToOfflineQueue({ studentCode: studentCode, room: state.currentRoom, clientTimestamp: new Date().toISOString() });
            showResult('warning', 'Offline', 'Saved - will sync when online', { studentCode: studentCode });
            return;
        }
        
        showResult('error', 'Error', errorMessage, { studentCode: studentCode });
        
    } finally {
        state.isProcessing = false;
        showLoading(false);
    }
}

// ============================================
// RESULT DISPLAY
// ============================================
function showResult(type, title, message, data) {
    data = data || {};
    
    if (!elements.resultCard || !elements.resultSection) return;
    
    elements.resultCard.className = 'result-card ' + type;
    
    const iconMap = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-circle'
    };
    
    const iconEl = elements.resultCard.querySelector('.result-icon i');
    if (iconEl) iconEl.className = iconMap[type] || 'fas fa-info-circle';
    
    const titleEl = elements.resultCard.querySelector('.result-title');
    const messageEl = elements.resultCard.querySelector('.result-message');
    const codeEl = elements.resultCard.querySelector('.student-code');
    const nameEl = elements.resultCard.querySelector('.student-name');
    const timeEl = elements.resultCard.querySelector('.scan-time');
    
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (codeEl) codeEl.textContent = data.studentCode || '';
    if (nameEl) nameEl.textContent = data.studentName || '';
    if (timeEl) timeEl.textContent = data.timestamp || data.previousTime || new Date().toLocaleTimeString();
    
    elements.resultSection.classList.remove('hidden');
    
    setTimeout(hideResult, CONFIG.AUTO_CLOSE_RESULT);
}

function hideResult() {
    if (elements.resultSection) {
        elements.resultSection.classList.add('hidden');
    }
}

// ============================================
// UI HELPERS
// ============================================
function showLoading(show) {
    if (elements.loadingOverlay) {
        elements.loadingOverlay.classList.toggle('hidden', !show);
    }
}

function showToast(type, title, message) {
    if (!elements.toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    
    const iconMap = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    toast.innerHTML = '<div class="toast-icon"><i class="' + (iconMap[type] || 'fas fa-info-circle') + '"></i></div>' +
                      '<div class="toast-content"><div class="toast-title">' + title + '</div>' +
                      '<div class="toast-message">' + message + '</div></div>';
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(function() {
        toast.classList.add('hiding');
        setTimeout(function() { toast.remove(); }, 300);
    }, 3000);
}

function playSound(type) {
    try {
        const sounds = { success: elements.successSound, error: elements.errorSound, scan: elements.scanSound };
        if (sounds[type]) {
            sounds[type].currentTime = 0;
            sounds[type].play().catch(function() {});
        }
    } catch (e) {}
}

// ============================================
// RECENT SCANS
// ============================================
function addToRecentScans(data) {
    state.recentScans.unshift(data);
    if (state.recentScans.length > 20) state.recentScans = state.recentScans.slice(0, 20);
    localStorage.setItem(CONFIG.STORAGE_KEYS.RECENT_SCANS, JSON.stringify(state.recentScans));
    renderRecentScans();
}

function renderRecentScans() {
    if (!elements.recentScansList) return;
    
    if (state.recentScans.length === 0) {
        elements.recentScansList.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i><p>No scans yet today</p></div>';
        return;
    }
    
    let html = '';
    state.recentScans.forEach(function(scan) {
        html += '<div class="scan-item">' +
                '<div class="scan-item-icon">' + ((scan.studentCode || '?')[0]) + '</div>' +
                '<div class="scan-item-details">' +
                '<div class="scan-item-code">' + (scan.studentCode || 'Unknown') + '</div>' +
                '<div class="scan-item-name">' + (scan.studentName || 'Unknown') + '</div></div>' +
                '<div class="scan-item-time">' + formatTime(scan.timestamp) +
                '<div class="scan-item-room">' + (scan.room || '') + '</div></div></div>';
    });
    
    elements.recentScansList.innerHTML = html;
}

async function fetchRecentScans() {
    try {
        if (elements.refreshRecent) elements.refreshRecent.classList.add('loading');
        
        const response = await fetch(CONFIG.API_URL + '?action=recent&limit=20');
        const result = await response.json();
        
        if (result.success && result.data && result.data.scans) {
            state.recentScans = result.data.scans;
            renderRecentScans();
        }
    } catch (error) {
        console.log('Could not fetch recent scans');
        const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.RECENT_SCANS);
        if (saved) {
            try {
                state.recentScans = JSON.parse(saved);
                renderRecentScans();
            } catch (e) {}
        }
    } finally {
        if (elements.refreshRecent) elements.refreshRecent.classList.remove('loading');
    }
}

// ============================================
// STATISTICS
// ============================================
async function fetchStats() {
    try {
        const response = await fetch(CONFIG.API_URL + '?action=stats');
        const result = await response.json();
        
        if (result.success && result.data) {
            state.stats = result.data;
            updateStatsUI();
        }
    } catch (error) {
        console.log('Could not fetch stats');
    }
}

function updateStatsUI() {
    if (elements.todayCount) {
        const span = elements.todayCount.querySelector('span');
        if (span) span.textContent = state.stats.totalToday || 0;
    }
    
    document.querySelectorAll('.room-btn').forEach(function(btn) {
        const room = btn.dataset.room;
        const count = (state.stats.roomCounts && state.stats.roomCounts[room]) || 0;
        const countSpan = btn.querySelector('.room-count');
        if (countSpan) countSpan.textContent = count;
    });
}

// ============================================
// OFFLINE QUEUE
// ============================================
function loadOfflineQueue() {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.OFFLINE_QUEUE);
    if (saved) {
        try { state.offlineQueue = JSON.parse(saved); } catch (e) { state.offlineQueue = []; }
        updateOfflineQueueUI();
    }
}

function addToOfflineQueue(data) {
    state.offlineQueue.push({ ...data, queuedAt: new Date().toISOString() });
    localStorage.setItem(CONFIG.STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(state.offlineQueue));
    updateOfflineQueueUI();
}

function updateOfflineQueueUI() {
    if (elements.offlineQueue) {
        elements.offlineQueue.classList.toggle('hidden', state.offlineQueue.length === 0);
    }
    if (elements.queueCount) {
        elements.queueCount.textContent = state.offlineQueue.length;
    }
}

async function processOfflineQueue() {
    if (state.offlineQueue.length === 0) return;
    
    showToast('info', 'Syncing', 'Processing offline scans...');
    
    const queue = [...state.offlineQueue];
    state.offlineQueue = [];
    let success = 0;
    
    for (const item of queue) {
        try {
            const response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            const result = await response.json();
            if (result.success) {
                success++;
                addToRecentScans(result.data);
            } else if (result.errorCode !== 'DUPLICATE') {
                state.offlineQueue.push(item);
            }
        } catch (e) {
            state.offlineQueue.push(item);
        }
    }
    
    localStorage.setItem(CONFIG.STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(state.offlineQueue));
    updateOfflineQueueUI();
    
    if (success > 0) {
        showToast('success', 'Synced', success + ' scans uploaded');
        fetchStats();
    }
}

// ============================================
// CONNECTION STATUS
// ============================================
function updateConnectionStatus() {
    if (elements.connectionStatus) {
        const online = navigator.onLine;
        elements.connectionStatus.className = 'connection-status ' + (online ? 'online' : 'offline');
        elements.connectionStatus.querySelector('span').textContent = online ? 'Online' : 'Offline';
    }
}

// ============================================
// MANUAL ENTRY
// ============================================
function toggleManualEntry() {
    if (elements.manualEntryToggle && elements.manualEntryContent) {
        elements.manualEntryToggle.classList.toggle('active');
        elements.manualEntryContent.classList.toggle('show');
        if (elements.manualEntryContent.classList.contains('show') && elements.manualCode) {
            elements.manualCode.focus();
        }
    }
}

function submitManualEntry() {
    if (elements.manualCode) {
        const code = elements.manualCode.value.trim().toUpperCase();
        if (code) {
            processAttendance(code);
            elements.manualCode.value = '';
        } else {
            showToast('error', 'Error', 'Please enter a student code');
        }
    }
}

// ============================================
// UTILITIES
// ============================================
function formatTime(timestamp) {
    if (!timestamp) return '';
    try {
        const date = new Date(timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T'));
        return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (e) {
        return timestamp;
    }
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    if (elements.themeToggle) elements.themeToggle.addEventListener('click', toggleTheme);
    
    if (elements.roomButtons) {
        elements.roomButtons.addEventListener('click', function(e) {
            const btn = e.target.closest('.room-btn');
            if (btn && btn.dataset.room) selectRoom(btn.dataset.room);
        });
    }
    
    if (elements.startBtn) elements.startBtn.addEventListener('click', startScanner);
    if (elements.stopBtn) elements.stopBtn.addEventListener('click', stopScanner);
    if (elements.switchCameraBtn) elements.switchCameraBtn.addEventListener('click', switchCamera);
    
    if (elements.manualEntryToggle) elements.manualEntryToggle.addEventListener('click', toggleManualEntry);
    if (elements.manualSubmit) elements.manualSubmit.addEventListener('click', submitManualEntry);
    if (elements.manualCode) {
        elements.manualCode.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') submitManualEntry();
        });
    }
    
    if (elements.closeResult) elements.closeResult.addEventListener('click', hideResult);
    if (elements.resultSection) {
        elements.resultSection.addEventListener('click', function(e) {
            if (e.target === elements.resultSection) hideResult();
        });
    }
    
    if (elements.refreshRecent) {
        elements.refreshRecent.addEventListener('click', function() {
            fetchRecentScans();
            fetchStats();
        });
    }
    
    if (elements.retryQueue) elements.retryQueue.addEventListener('click', processOfflineQueue);
    
    window.addEventListener('online', function() {
        updateConnectionStatus();
        showToast('success', 'Online', 'Syncing...');
        processOfflineQueue();
    });
    
    window.addEventListener('offline', function() {
        updateConnectionStatus();
        showToast('warning', 'Offline', 'Scans will be saved locally');
    });
}

// ============================================
// GLOBAL EXPORT
// ============================================
window.AttendanceApp = {
    state: state,
    startScanner: startScanner,
    stopScanner: stopScanner,
    processAttendance: processAttendance,
    fetchStats: fetchStats
};
