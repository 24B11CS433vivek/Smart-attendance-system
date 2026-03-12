/**
 * ==========================================
 * ATTENDANCE SCANNER - MAIN JAVASCRIPT
 * Complete Scanner Logic & API Integration
 * ==========================================
 */

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    // Replace with your Google Apps Script Web App URL
    API_URL: 'https://script.google.com/macros/s/AKfycbym74lkksn7h8VktgkhVGNRQr__Zn3Ac86lHoXsL7hpH9gbGokw1UNDYySB-1JQcWGKNQ/exec',
    
    // Scanner settings
    SCAN_DELAY: 2000, // Delay between scans (ms)
    AUTO_CLOSE_RESULT: 3000, // Auto close result modal (ms)
    
    // Local storage keys
    STORAGE_KEYS: {
        THEME: 'attendance_theme',
        ROOM: 'attendance_room',
        OFFLINE_QUEUE: 'attendance_offline_queue',
        RECENT_SCANS: 'attendance_recent_scans'
    },
    
    // Valid rooms
    VALID_ROOMS: ['Room A', 'Room B', 'Room C', 'Room D', 'Room E', 'Room F', 'Room G', 'Room H', 'Room I', 'Room J']
};

// ============================================
// STATE MANAGEMENT
// ============================================
const state = {
    currentRoom: 'Room A',
    isScanning: false,
    isProcessing: false,
    scanner: null,
    currentCamera: 'environment',
    offlineQueue: [],
    recentScans: [],
    stats: {
        total: 0,
        rooms: {}
    },
    lastScanTime: 0
};

// ============================================
// DOM ELEMENTS
// ============================================
const elements = {
    // Theme
    themeToggle: document.getElementById('themeToggle'),
    
    // Room selection
    roomButtons: document.getElementById('roomButtons'),
    moreRoomsBtn: document.getElementById('moreRoomsBtn'),
    moreRoomsDropdown: document.getElementById('moreRoomsDropdown'),
    
    // Scanner
    scannerContainer: document.getElementById('scannerContainer'),
    reader: document.getElementById('reader'),
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    switchCameraBtn: document.getElementById('switchCameraBtn'),
    flashBtn: document.getElementById('flashBtn'),
    
    // Manual entry
    manualEntryToggle: document.getElementById('manualEntryToggle'),
    manualEntryContent: document.getElementById('manualEntryContent'),
    manualCode: document.getElementById('manualCode'),
    manualSubmit: document.getElementById('manualSubmit'),
    
    // Result
    resultSection: document.getElementById('resultSection'),
    resultCard: document.getElementById('resultCard'),
    closeResult: document.getElementById('closeResult'),
    
    // Stats
    todayCount: document.getElementById('todayCount'),
    
    // Recent scans
    recentScansList: document.getElementById('recentScansList'),
    refreshRecent: document.getElementById('refreshRecent'),
    
    // Offline queue
    offlineQueue: document.getElementById('offlineQueue'),
    queueCount: document.getElementById('queueCount'),
    retryQueue: document.getElementById('retryQueue'),
    
    // Connection status
    connectionStatus: document.getElementById('connectionStatus'),
    
    // Loading
    loadingOverlay: document.getElementById('loadingOverlay'),
    
    // Toast
    toastContainer: document.getElementById('toastContainer'),
    
    // Audio
    successSound: document.getElementById('successSound'),
    errorSound: document.getElementById('errorSound'),
    scanSound: document.getElementById('scanSound')
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    console.log('🚀 Initializing Attendance Scanner...');
    
    // Load saved preferences
    loadTheme();
    loadSavedRoom();
    loadOfflineQueue();
    
    // Setup event listeners
    setupEventListeners();
    
    // Check connection
    updateConnectionStatus();
    
    // Load initial data
    fetchStats();
    fetchRecentScans();
    
    // Process offline queue if online
    if (navigator.onLine) {
        processOfflineQueue();
    }
    
    console.log('✅ App initialized successfully');
}

// ============================================
// THEME MANAGEMENT
// ============================================
function loadTheme() {
    const savedTheme = localStorage.getItem(CONFIG.STORAGE_KEYS.THEME) || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem(CONFIG.STORAGE_KEYS.THEME, newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = elements.themeToggle.querySelector('i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// ============================================
// ROOM MANAGEMENT
// ============================================
function loadSavedRoom() {
    const savedRoom = localStorage.getItem(CONFIG.STORAGE_KEYS.ROOM);
    if (savedRoom && CONFIG.VALID_ROOMS.includes(savedRoom)) {
        state.currentRoom = savedRoom;
        updateRoomSelection(savedRoom);
    }
}

function selectRoom(room) {
    state.currentRoom = room;
    localStorage.setItem(CONFIG.STORAGE_KEYS.ROOM, room);
    updateRoomSelection(room);
    
    // Show feedback
    showToast('info', 'Room Selected', `Now scanning for ${room}`);
    
    // Refresh recent scans for new room
    fetchRecentScans();
}

function updateRoomSelection(room) {
    // Update main room buttons
    document.querySelectorAll('.room-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.room === room);
    });
    
    // Update dropdown buttons
    document.querySelectorAll('.room-btn-small').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.room === room);
    });
}

// ============================================
// SCANNER MANAGEMENT
// ============================================
async function startScanner() {
    if (state.isScanning) return;
    
    try {
        state.scanner = new Html5Qrcode("reader");
        
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            disableFlip: false,
            experimentalFeatures: {
                useBarCodeDetectorIfSupported: true
            }
        };
        
        await state.scanner.start(
            { facingMode: state.currentCamera },
            config,
            onScanSuccess,
            onScanFailure
        );
        
        state.isScanning = true;
        updateScannerUI(true);
        
        console.log('📸 Scanner started');
        
    } catch (error) {
        console.error('Failed to start scanner:', error);
        showToast('error', 'Camera Error', 'Failed to access camera. Please check permissions.');
    }
}

async function stopScanner() {
    if (!state.isScanning || !state.scanner) return;
    
    try {
        await state.scanner.stop();
        state.scanner.clear();
        state.isScanning = false;
        updateScannerUI(false);
        
        console.log('🛑 Scanner stopped');
        
    } catch (error) {
        console.error('Failed to stop scanner:', error);
    }
}

async function switchCamera() {
    if (!state.isScanning) return;
    
    state.currentCamera = state.currentCamera === 'environment' ? 'user' : 'environment';
    
    await stopScanner();
    await startScanner();
    
    showToast('info', 'Camera Switched', state.currentCamera === 'environment' ? 'Using back camera' : 'Using front camera');
}

function updateScannerUI(isScanning) {
    elements.startBtn.classList.toggle('hidden', isScanning);
    elements.stopBtn.classList.toggle('hidden', !isScanning);
    elements.scannerContainer.classList.toggle('scanning', isScanning);
}

// ============================================
// SCAN HANDLERS
// ============================================
async function onScanSuccess(decodedText, decodedResult) {
    // Prevent rapid duplicate scans
    const now = Date.now();
    if (now - state.lastScanTime < CONFIG.SCAN_DELAY) {
        return;
    }
    state.lastScanTime = now;
    
    // Play scan sound
    playSound('scan');
    
    // Vibrate if supported
    if (navigator.vibrate) {
        navigator.vibrate(100);
    }
    
    console.log('📋 Scanned:', decodedText);
    
    // Process the scan
    await processAttendance(decodedText.trim().toUpperCase());
}

function onScanFailure(error) {
    // Silent failure - no need to log every failed frame
}

// ============================================
// ATTENDANCE PROCESSING
// ============================================
async function processAttendance(studentCode) {
    if (state.isProcessing) return;
    
    state.isProcessing = true;
    showLoading(true);
    
    try {
        // Validate input
        if (!studentCode || studentCode.length < 2) {
            throw new Error('Invalid student code');
        }
        
        const payload = {
            studentCode: studentCode,
            room: state.currentRoom,
            clientTimestamp: new Date().toISOString()
        };
        
        // Check if online
        if (!navigator.onLine) {
            // Add to offline queue
            addToOfflineQueue(payload);
            showResult('warning', 'Queued Offline', 'Will sync when online', {
                studentCode: studentCode,
                room: state.currentRoom
            });
            return;
        }
        
        // Send to API
        const response = await fetch(CONFIG.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Success
            playSound('success');
            elements.scannerContainer.classList.add('success');
            setTimeout(() => elements.scannerContainer.classList.remove('success'), 500);
            
            showResult('success', 'Success!', result.message, result.data);
            
            // Update local recent scans
            addToRecentScans(result.data);
            
            // Update stats
            updateLocalStats(result.data);
            
        } else {
            // Error or duplicate
            playSound('error');
            elements.scannerContainer.classList.add('error');
            setTimeout(() => elements.scannerContainer.classList.remove('error'), 500);
            
            if (result.errorCode === 'DUPLICATE') {
                showResult('warning', 'Already Scanned!', `Scanned at ${result.data.previousTime}`, result.data);
            } else {
                showResult('error', 'Error', result.message, result.data);
            }
        }
        
    } catch (error) {
        console.error('Error processing attendance:', error);
        playSound('error');
        
        if (!navigator.onLine) {
            // Add to offline queue
            addToOfflineQueue({
                studentCode: studentCode,
                room: state.currentRoom,
                clientTimestamp: new Date().toISOString()
            });
            showResult('warning', 'Queued Offline', 'Will sync when online', { studentCode });
        } else {
            showResult('error', 'Error', error.message || 'Failed to process attendance');
        }
        
    } finally {
        state.isProcessing = false;
        showLoading(false);
    }
}

// ============================================
// RESULT DISPLAY
// ============================================
function showResult(type, title, message, data = {}) {
    elements.resultCard.className = `result-card ${type}`;
    
    // Update icon
    const iconMap = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-circle'
    };
    elements.resultCard.querySelector('.result-icon i').className = iconMap[type] || iconMap.error;
    
    // Update content
    elements.resultCard.querySelector('.result-title').textContent = title;
    elements.resultCard.querySelector('.result-message').textContent = message;
    
    // Update details
    const details = elements.resultCard.querySelector('.result-details');
    details.querySelector('.student-code').textContent = data.studentCode || '';
    details.querySelector('.student-name').textContent = data.studentName || '';
    details.querySelector('.scan-time').textContent = data.timestamp || data.previousTime || new Date().toLocaleTimeString();
    
    // Show modal
    elements.resultSection.classList.remove('hidden');
    
    // Auto close after delay
    setTimeout(() => {
        hideResult();
    }, CONFIG.AUTO_CLOSE_RESULT);
}

function hideResult() {
    elements.resultSection.classList.add('hidden');
}

// ============================================
// RECENT SCANS MANAGEMENT
// ============================================
function addToRecentScans(scanData) {
    // Add to beginning of array
    state.recentScans.unshift(scanData);
    
    // Keep only last 20
    if (state.recentScans.length > 20) {
        state.recentScans = state.recentScans.slice(0, 20);
    }
    
    // Save to local storage
    localStorage.setItem(CONFIG.STORAGE_KEYS.RECENT_SCANS, JSON.stringify(state.recentScans));
    
    // Update UI
    renderRecentScans();
}

function renderRecentScans() {
    if (state.recentScans.length === 0) {
        elements.recentScansList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No scans yet today</p>
            </div>
        `;
        return;
    }
    
    elements.recentScansList.innerHTML = state.recentScans.map((scan, index) => `
        <div class="scan-item" style="animation-delay: ${index * 0.05}s">
            <div class="scan-item-icon">${(scan.studentCode || '??')[0]}</div>
            <div class="scan-item-details">
                <div class="scan-item-code">${scan.studentCode || 'Unknown'}</div>
                <div class="scan-item-name">${scan.studentName || 'Unknown Student'}</div>
            </div>
            <div class="scan-item-time">
                ${formatTime(scan.timestamp)}
                <div class="scan-item-room">${scan.room || 'N/A'}</div>
            </div>
        </div>
    `).join('');
}

async function fetchRecentScans() {
    try {
        elements.refreshRecent.classList.add('loading');
        
        const response = await fetch(`${CONFIG.API_URL}?action=recent&room=${encodeURIComponent(state.currentRoom)}&limit=20`);
        const result = await response.json();
        
        if (result.success && result.data.scans) {
            state.recentScans = result.data.scans;
            renderRecentScans();
        }
        
    } catch (error) {
        console.error('Failed to fetch recent scans:', error);
        // Load from local storage
        const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.RECENT_SCANS);
        if (saved) {
            state.recentScans = JSON.parse(saved);
            renderRecentScans();
        }
    } finally {
        elements.refreshRecent.classList.remove('loading');
    }
}

// ============================================
// STATISTICS
// ============================================
async function fetchStats() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=stats`);
        const result = await response.json();
        
        if (result.success && result.data) {
            state.stats = result.data;
            updateStatsUI();
        }
        
    } catch (error) {
        console.error('Failed to fetch stats:', error);
    }
}

function updateLocalStats(scanData) {
    state.stats.totalToday = (state.stats.totalToday || 0) + 1;
    
    const room = scanData.room;
    if (!state.stats.roomCounts) {
        state.stats.roomCounts = {};
    }
    state.stats.roomCounts[room] = (state.stats.roomCounts[room] || 0) + 1;
    
    updateStatsUI();
}

function updateStatsUI() {
    // Update header badge
    const totalSpan = elements.todayCount.querySelector('span');
    totalSpan.textContent = state.stats.totalToday || 0;
    
    // Update room counts
    document.querySelectorAll('.room-btn').forEach(btn => {
        const room = btn.dataset.room;
        const count = state.stats.roomCounts?.[room] || 0;
        const countSpan = btn.querySelector('.room-count');
        if (countSpan) {
            countSpan.textContent = count;
        }
    });
}

// ============================================
// OFFLINE QUEUE MANAGEMENT
// ============================================
function loadOfflineQueue() {
    const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.OFFLINE_QUEUE);
    if (saved) {
        state.offlineQueue = JSON.parse(saved);
        updateOfflineQueueUI();
    }
}

function saveOfflineQueue() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(state.offlineQueue));
    updateOfflineQueueUI();
}

function addToOfflineQueue(data) {
    state.offlineQueue.push({
        ...data,
        queuedAt: new Date().toISOString()
    });
    saveOfflineQueue();
    showToast('warning', 'Added to Queue', 'Will sync when online');
}

function updateOfflineQueueUI() {
    const hasQueue = state.offlineQueue.length > 0;
    elements.offlineQueue.classList.toggle('hidden', !hasQueue);
    elements.queueCount.textContent = state.offlineQueue.length;
}

async function processOfflineQueue() {
    if (state.offlineQueue.length === 0) return;
    
    showToast('info', 'Syncing...', `Processing ${state.offlineQueue.length} queued scans`);
    
    const queue = [...state.offlineQueue];
    state.offlineQueue = [];
    
    let successCount = 0;
    let failedQueue = [];
    
    for (const item of queue) {
        try {
            const response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            
            const result = await response.json();
            
            if (result.success) {
                successCount++;
                addToRecentScans(result.data);
            } else if (result.errorCode !== 'DUPLICATE') {
                failedQueue.push(item);
            }
            
        } catch (error) {
            failedQueue.push(item);
        }
    }
    
    state.offlineQueue = failedQueue;
    saveOfflineQueue();
    
    if (successCount > 0) {
        showToast('success', 'Sync Complete', `${successCount} scans synced successfully`);
        fetchStats();
    }
    
    if (failedQueue.length > 0) {
        showToast('warning', 'Sync Incomplete', `${failedQueue.length} scans still pending`);
    }
}

// ============================================
// CONNECTION STATUS
// ============================================
function updateConnectionStatus() {
    const isOnline = navigator.onLine;
    const statusEl = elements.connectionStatus;
    
    statusEl.className = `connection-status ${isOnline ? 'online' : 'offline'}`;
    statusEl.querySelector('span').textContent = isOnline ? 'Online' : 'Offline';
}

// ============================================
// MANUAL ENTRY
// ============================================
function toggleManualEntry() {
    const isActive = elements.manualEntryToggle.classList.toggle('active');
    elements.manualEntryContent.classList.toggle('show', isActive);
    
    if (isActive) {
        elements.manualCode.focus();
    }
}

async function submitManualEntry() {
    const code = elements.manualCode.value.trim().toUpperCase();
    
    if (!code) {
        showToast('error', 'Error', 'Please enter a student code');
        return;
    }
    
    await processAttendance(code);
    elements.manualCode.value = '';
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function showLoading(show) {
    elements.loadingOverlay.classList.toggle('hidden', !show);
}

function showToast(type, title, message) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconMap = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="${iconMap[type] || iconMap.info}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;
    
    elements.toastContainer.appendChild(toast);
    
    // Remove after delay
    setTimeout(() => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function playSound(type) {
    try {
        const sounds = {
            success: elements.successSound,
            error: elements.errorSound,
            scan: elements.scanSound
        };
        
        const sound = sounds[type];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(() => {}); // Ignore autoplay errors
        }
    } catch (e) {
        // Ignore audio errors
    }
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    
    try {
        // Handle different timestamp formats
        let date;
        if (typeof timestamp === 'string') {
            // Try parsing as ISO or common formats
            if (timestamp.includes('T')) {
                date = new Date(timestamp);
            } else {
                // Assume format like "2025-01-15 09:30:45"
                date = new Date(timestamp.replace(' ', 'T'));
            }
        } else {
            date = new Date(timestamp);
        }
        
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } catch (e) {
        return timestamp;
    }
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    // Theme toggle
    elements.themeToggle.addEventListener('click', toggleTheme);
    
    // Room selection
    elements.roomButtons.addEventListener('click', (e) => {
        const btn = e.target.closest('.room-btn');
        if (btn) {
            selectRoom(btn.dataset.room);
        }
    });
    
    // More rooms dropdown
    elements.moreRoomsBtn.addEventListener('click', () => {
        elements.moreRoomsDropdown.classList.toggle('show');
    });
    
    elements.moreRoomsDropdown.addEventListener('click', (e) => {
        const btn = e.target.closest('.room-btn-small');
        if (btn) {
            selectRoom(btn.dataset.room);
            elements.moreRoomsDropdown.classList.remove('show');
        }
    });
    
    // Scanner controls
    elements.startBtn.addEventListener('click', startScanner);
    elements.stopBtn.addEventListener('click', stopScanner);
    elements.switchCameraBtn.addEventListener('click', switchCamera);
    
    // Manual entry
    elements.manualEntryToggle.addEventListener('click', toggleManualEntry);
    elements.manualSubmit.addEventListener('click', submitManualEntry);
    elements.manualCode.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            submitManualEntry();
        }
    });
    
    // Result modal
    elements.closeResult.addEventListener('click', hideResult);
    elements.resultSection.addEventListener('click', (e) => {
        if (e.target === elements.resultSection) {
            hideResult();
        }
    });
    
    // Recent scans refresh
    elements.refreshRecent.addEventListener('click', () => {
        fetchRecentScans();
        fetchStats();
    });
    
    // Offline queue retry
    elements.retryQueue.addEventListener('click', processOfflineQueue);
    
    // Connection status
    window.addEventListener('online', () => {
        updateConnectionStatus();
        showToast('success', 'Back Online', 'Syncing queued scans...');
        processOfflineQueue();
    });
    
    window.addEventListener('offline', () => {
        updateConnectionStatus();
        showToast('warning', 'Offline', 'Scans will be queued');
    });
    
    // Handle page visibility
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) {
            fetchStats();
            fetchRecentScans();
            processOfflineQueue();
        }
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.more-rooms')) {
            elements.moreRoomsDropdown.classList.remove('show');
        }
    });
}

// ============================================
// EXPORT FOR DEBUGGING
// ============================================
window.AttendanceApp = {
    state,
    config: CONFIG,
    startScanner,
    stopScanner,
    processAttendance,
    fetchStats,
    fetchRecentScans
};
