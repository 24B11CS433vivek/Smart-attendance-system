/**
 * ==========================================
 * ATTENDANCE SCANNER - COMPLETE WORKING VERSION
 * All functions included - No errors
 * ==========================================
 */

// ============================================
// CONFIGURATION
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
const elements = {
    themeToggle: null,
    roomButtons: null,
    moreRoomsBtn: null,
    moreRoomsDropdown: null,
    scannerContainer: null,
    reader: null,
    startBtn: null,
    stopBtn: null,
    switchCameraBtn: null,
    flashBtn: null,
    manualEntryToggle: null,
    manualEntryContent: null,
    manualCode: null,
    manualSubmit: null,
    resultSection: null,
    resultCard: null,
    closeResult: null,
    todayCount: null,
    recentScansList: null,
    refreshRecent: null,
    offlineQueue: null,
    queueCount: null,
    retryQueue: null,
    connectionStatus: null,
    loadingOverlay: null,
    toastContainer: null,
    successSound: null,
    errorSound: null,
    scanSound: null
};

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Initializing Attendance Scanner...');
    
    // Get all DOM elements
    initializeElements();
    
    // Load saved preferences
    loadTheme();
    loadSavedRoom();
    loadOfflineQueue();
    
    // Setup event listeners
    setupEventListeners();
    
    // Check connection status
    updateConnectionStatus();
    
    // Load initial data
    fetchStats();
    fetchRecentScans();
    
    // Process offline queue if online
    if (navigator.onLine) {
        processOfflineQueue();
    }
    
    console.log('✅ App initialized successfully');
});

// ============================================
// INITIALIZE DOM ELEMENTS
// ============================================
function initializeElements() {
    elements.themeToggle = document.getElementById('themeToggle');
    elements.roomButtons = document.getElementById('roomButtons');
    elements.moreRoomsBtn = document.getElementById('moreRoomsBtn');
    elements.moreRoomsDropdown = document.getElementById('moreRoomsDropdown');
    elements.scannerContainer = document.getElementById('scannerContainer');
    elements.reader = document.getElementById('reader');
    elements.startBtn = document.getElementById('startBtn');
    elements.stopBtn = document.getElementById('stopBtn');
    elements.switchCameraBtn = document.getElementById('switchCameraBtn');
    elements.flashBtn = document.getElementById('flashBtn');
    elements.manualEntryToggle = document.getElementById('manualEntryToggle');
    elements.manualEntryContent = document.getElementById('manualEntryContent');
    elements.manualCode = document.getElementById('manualCode');
    elements.manualSubmit = document.getElementById('manualSubmit');
    elements.resultSection = document.getElementById('resultSection');
    elements.resultCard = document.getElementById('resultCard');
    elements.closeResult = document.getElementById('closeResult');
    elements.todayCount = document.getElementById('todayCount');
    elements.recentScansList = document.getElementById('recentScansList');
    elements.refreshRecent = document.getElementById('refreshRecent');
    elements.offlineQueue = document.getElementById('offlineQueue');
    elements.queueCount = document.getElementById('queueCount');
    elements.retryQueue = document.getElementById('retryQueue');
    elements.connectionStatus = document.getElementById('connectionStatus');
    elements.loadingOverlay = document.getElementById('loadingOverlay');
    elements.toastContainer = document.getElementById('toastContainer');
    elements.successSound = document.getElementById('successSound');
    elements.errorSound = document.getElementById('errorSound');
    elements.scanSound = document.getElementById('scanSound');
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
    if (elements.themeToggle) {
        const icon = elements.themeToggle.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
        }
    }
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
    showToast('info', 'Room Selected', 'Now scanning for ' + room);
    fetchRecentScans();
}

function updateRoomSelection(room) {
    document.querySelectorAll('.room-btn').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.room === room);
    });
    document.querySelectorAll('.room-btn-small').forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.room === room);
    });
}

// ============================================
// SCANNER MANAGEMENT
// ============================================
async function startScanner() {
    if (state.isScanning) return;
    
    try {
        // Request camera permission first
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        stream.getTracks().forEach(function(track) { track.stop(); });
        
        // Initialize scanner
        state.scanner = new Html5Qrcode("reader");
        
        const config = {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
        };
        
        await state.scanner.start(
            { facingMode: state.currentCamera },
            config,
            onScanSuccess,
            onScanFailure
        );
        
        state.isScanning = true;
        
        if (elements.startBtn) elements.startBtn.classList.add('hidden');
        if (elements.stopBtn) elements.stopBtn.classList.remove('hidden');
        
        showToast('success', 'Scanner Ready', 'Point camera at QR code or barcode');
        console.log('📸 Scanner started successfully');
        
    } catch (error) {
        console.error('Failed to start scanner:', error);
        showToast('error', 'Camera Error', 'Please allow camera access in browser settings');
    }
}

async function stopScanner() {
    if (!state.isScanning || !state.scanner) return;
    
    try {
        await state.scanner.stop();
        state.scanner.clear();
        state.isScanning = false;
        
        if (elements.startBtn) elements.startBtn.classList.remove('hidden');
        if (elements.stopBtn) elements.stopBtn.classList.add('hidden');
        
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

// ============================================
// SCAN HANDLERS
// ============================================
async function onScanSuccess(decodedText, decodedResult) {
    const now = Date.now();
    if (now - state.lastScanTime < CONFIG.SCAN_DELAY) {
        return;
    }
    state.lastScanTime = now;
    
    playSound('scan');
    
    if (navigator.vibrate) {
        navigator.vibrate(100);
    }
    
    console.log('📋 Scanned:', decodedText);
    await processAttendance(decodedText.trim().toUpperCase());
}

function onScanFailure(error) {
    // Silent failure - no need to log
}

// ============================================
// ATTENDANCE PROCESSING
// ============================================
async function processAttendance(studentCode) {
    if (state.isProcessing) return;
    if (!studentCode || studentCode.length < 2) {
        showToast('error', 'Invalid Code', 'Please scan a valid code');
        return;
    }
    
    state.isProcessing = true;
    showLoading(true);
    
    try {
        const payload = {
            studentCode: studentCode,
            room: state.currentRoom,
            clientTimestamp: new Date().toISOString()
        };
        
        console.log('📤 Sending to API:', payload);
        
        // Check if offline
        if (!navigator.onLine) {
            addToOfflineQueue(payload);
            showResult('warning', 'Queued Offline', 'Will sync when online', {
                studentCode: studentCode,
                room: state.currentRoom
            });
            state.isProcessing = false;
            showLoading(false);
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
        console.log('📊 Result:', result);
        
        if (result.success) {
            // Success
            playSound('success');
            if (elements.scannerContainer) {
                elements.scannerContainer.classList.add('success');
                setTimeout(function() {
                    elements.scannerContainer.classList.remove('success');
                }, 500);
            }
            
            showResult('success', 'Success!', result.message, result.data);
            addToRecentScans(result.data);
            updateLocalStats(result.data);
            
        } else {
            // Error or duplicate
            playSound('error');
            if (elements.scannerContainer) {
                elements.scannerContainer.classList.add('error');
                setTimeout(function() {
                    elements.scannerContainer.classList.remove('error');
                }, 500);
            }
            
            if (result.errorCode === 'DUPLICATE') {
                showResult('warning', 'Already Scanned!', 'Scanned at ' + (result.data.previousTime || 'earlier today'), result.data);
            } else {
                showResult('error', 'Error', result.message, result.data || {});
            }
        }
        
    } catch (error) {
        console.error('❌ Error processing attendance:', error);
        playSound('error');
        
        if (!navigator.onLine) {
            addToOfflineQueue({
                studentCode: studentCode,
                room: state.currentRoom,
                clientTimestamp: new Date().toISOString()
            });
            showResult('warning', 'Queued Offline', 'Will sync when online', { studentCode: studentCode });
        } else {
            showResult('error', 'Error', 'Network error - please try again', { studentCode: studentCode });
        }
        
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
    
    // Update icon
    var iconMap = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-circle'
    };
    
    var iconEl = elements.resultCard.querySelector('.result-icon i');
    if (iconEl) {
        iconEl.className = iconMap[type] || iconMap.error;
    }
    
    // Update content
    var titleEl = elements.resultCard.querySelector('.result-title');
    var messageEl = elements.resultCard.querySelector('.result-message');
    var codeEl = elements.resultCard.querySelector('.student-code');
    var nameEl = elements.resultCard.querySelector('.student-name');
    var timeEl = elements.resultCard.querySelector('.scan-time');
    
    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    if (codeEl) codeEl.textContent = data.studentCode || '';
    if (nameEl) nameEl.textContent = data.studentName || '';
    if (timeEl) timeEl.textContent = data.timestamp || data.previousTime || new Date().toLocaleTimeString();
    
    // Show modal
    elements.resultSection.classList.remove('hidden');
    
    // Auto close
    setTimeout(function() {
        hideResult();
    }, CONFIG.AUTO_CLOSE_RESULT);
}

function hideResult() {
    if (elements.resultSection) {
        elements.resultSection.classList.add('hidden');
    }
}

// ============================================
// LOADING OVERLAY
// ============================================
function showLoading(show) {
    if (elements.loadingOverlay) {
        if (show) {
            elements.loadingOverlay.classList.remove('hidden');
        } else {
            elements.loadingOverlay.classList.add('hidden');
        }
    }
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(type, title, message) {
    if (!elements.toastContainer) return;
    
    var toast = document.createElement('div');
    toast.className = 'toast ' + type;
    
    var iconMap = {
        success: 'fas fa-check-circle',
        error: 'fas fa-times-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    toast.innerHTML = 
        '<div class="toast-icon"><i class="' + (iconMap[type] || iconMap.info) + '"></i></div>' +
        '<div class="toast-content">' +
            '<div class="toast-title">' + title + '</div>' +
            '<div class="toast-message">' + message + '</div>' +
        '</div>';
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(function() {
        toast.classList.add('hiding');
        setTimeout(function() {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// ============================================
// SOUND EFFECTS
// ============================================
function playSound(type) {
    try {
        var sounds = {
            success: elements.successSound,
            error: elements.errorSound,
            scan: elements.scanSound
        };
        
        var sound = sounds[type];
        if (sound) {
            sound.currentTime = 0;
            sound.play().catch(function() {});
        }
    } catch (e) {
        // Ignore audio errors
    }
}

// ============================================
// RECENT SCANS
// ============================================
function addToRecentScans(scanData) {
    state.recentScans.unshift(scanData);
    
    if (state.recentScans.length > 20) {
        state.recentScans = state.recentScans.slice(0, 20);
    }
    
    localStorage.setItem(CONFIG.STORAGE_KEYS.RECENT_SCANS, JSON.stringify(state.recentScans));
    renderRecentScans();
}

function renderRecentScans() {
    if (!elements.recentScansList) return;
    
    if (state.recentScans.length === 0) {
        elements.recentScansList.innerHTML = 
            '<div class="empty-state">' +
                '<i class="fas fa-inbox"></i>' +
                '<p>No scans yet today</p>' +
            '</div>';
        return;
    }
    
    var html = '';
    state.recentScans.forEach(function(scan, index) {
        html += 
            '<div class="scan-item" style="animation-delay: ' + (index * 0.05) + 's">' +
                '<div class="scan-item-icon">' + ((scan.studentCode || '?')[0]) + '</div>' +
                '<div class="scan-item-details">' +
                    '<div class="scan-item-code">' + (scan.studentCode || 'Unknown') + '</div>' +
                    '<div class="scan-item-name">' + (scan.studentName || 'Unknown Student') + '</div>' +
                '</div>' +
                '<div class="scan-item-time">' +
                    formatTime(scan.timestamp) +
                    '<div class="scan-item-room">' + (scan.room || 'N/A') + '</div>' +
                '</div>' +
            '</div>';
    });
    
    elements.recentScansList.innerHTML = html;
}

async function fetchRecentScans() {
    try {
        if (elements.refreshRecent) {
            elements.refreshRecent.classList.add('loading');
        }
        
        var response = await fetch(CONFIG.API_URL + '?action=recent&room=' + encodeURIComponent(state.currentRoom) + '&limit=20');
        var result = await response.json();
        
        if (result.success && result.data && result.data.scans) {
            state.recentScans = result.data.scans;
            renderRecentScans();
        }
        
    } catch (error) {
        console.error('Failed to fetch recent scans:', error);
        var saved = localStorage.getItem(CONFIG.STORAGE_KEYS.RECENT_SCANS);
        if (saved) {
            try {
                state.recentScans = JSON.parse(saved);
                renderRecentScans();
            } catch (e) {}
        }
    } finally {
        if (elements.refreshRecent) {
            elements.refreshRecent.classList.remove('loading');
        }
    }
}

// ============================================
// STATISTICS
// ============================================
async function fetchStats() {
    try {
        var response = await fetch(CONFIG.API_URL + '?action=stats');
        var result = await response.json();
        
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
    
    var room = scanData.room;
    if (!state.stats.roomCounts) {
        state.stats.roomCounts = {};
    }
    state.stats.roomCounts[room] = (state.stats.roomCounts[room] || 0) + 1;
    
    updateStatsUI();
}

function updateStatsUI() {
    if (elements.todayCount) {
        var totalSpan = elements.todayCount.querySelector('span');
        if (totalSpan) {
            totalSpan.textContent = state.stats.totalToday || 0;
        }
    }
    
    document.querySelectorAll('.room-btn').forEach(function(btn) {
        var room = btn.dataset.room;
        var count = (state.stats.roomCounts && state.stats.roomCounts[room]) || 0;
        var countSpan = btn.querySelector('.room-count');
        if (countSpan) {
            countSpan.textContent = count;
        }
    });
}

// ============================================
// OFFLINE QUEUE
// ============================================
function loadOfflineQueue() {
    var saved = localStorage.getItem(CONFIG.STORAGE_KEYS.OFFLINE_QUEUE);
    if (saved) {
        try {
            state.offlineQueue = JSON.parse(saved);
            updateOfflineQueueUI();
        } catch (e) {
            state.offlineQueue = [];
        }
    }
}

function saveOfflineQueue() {
    localStorage.setItem(CONFIG.STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(state.offlineQueue));
    updateOfflineQueueUI();
}

function addToOfflineQueue(data) {
    state.offlineQueue.push({
        studentCode: data.studentCode,
        room: data.room,
        clientTimestamp: data.clientTimestamp,
        queuedAt: new Date().toISOString()
    });
    saveOfflineQueue();
    showToast('warning', 'Added to Queue', 'Will sync when online');
}

function updateOfflineQueueUI() {
    var hasQueue = state.offlineQueue.length > 0;
    
    if (elements.offlineQueue) {
        if (hasQueue) {
            elements.offlineQueue.classList.remove('hidden');
        } else {
            elements.offlineQueue.classList.add('hidden');
        }
    }
    
    if (elements.queueCount) {
        elements.queueCount.textContent = state.offlineQueue.length;
    }
}

async function processOfflineQueue() {
    if (state.offlineQueue.length === 0) return;
    
    showToast('info', 'Syncing...', 'Processing ' + state.offlineQueue.length + ' queued scans');
    
    var queue = state.offlineQueue.slice();
    state.offlineQueue = [];
    
    var successCount = 0;
    var failedQueue = [];
    
    for (var i = 0; i < queue.length; i++) {
        var item = queue[i];
        try {
            var response = await fetch(CONFIG.API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
            });
            
            var result = await response.json();
            
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
        showToast('success', 'Sync Complete', successCount + ' scans synced successfully');
        fetchStats();
    }
    
    if (failedQueue.length > 0) {
        showToast('warning', 'Sync Incomplete', failedQueue.length + ' scans still pending');
    }
}

// ============================================
// CONNECTION STATUS
// ============================================
function updateConnectionStatus() {
    var isOnline = navigator.onLine;
    
    if (elements.connectionStatus) {
        elements.connectionStatus.className = 'connection-status ' + (isOnline ? 'online' : 'offline');
        var span = elements.connectionStatus.querySelector('span');
        if (span) {
            span.textContent = isOnline ? 'Online' : 'Offline';
        }
    }
}

// ============================================
// MANUAL ENTRY
// ============================================
function toggleManualEntry() {
    if (!elements.manualEntryToggle || !elements.manualEntryContent) return;
    
    var isActive = elements.manualEntryToggle.classList.toggle('active');
    
    if (isActive) {
        elements.manualEntryContent.classList.add('show');
        if (elements.manualCode) {
            elements.manualCode.focus();
        }
    } else {
        elements.manualEntryContent.classList.remove('show');
    }
}

async function submitManualEntry() {
    if (!elements.manualCode) return;
    
    var code = elements.manualCode.value.trim().toUpperCase();
    
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
function formatTime(timestamp) {
    if (!timestamp) return '';
    
    try {
        var date;
        if (typeof timestamp === 'string') {
            if (timestamp.includes('T')) {
                date = new Date(timestamp);
            } else {
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
    if (elements.themeToggle) {
        elements.themeToggle.addEventListener('click', toggleTheme);
    }
    
    // Room selection
    if (elements.roomButtons) {
        elements.roomButtons.addEventListener('click', function(e) {
            var btn = e.target.closest('.room-btn');
            if (btn && btn.dataset.room) {
                selectRoom(btn.dataset.room);
            }
        });
    }
    
    // More rooms dropdown
    if (elements.moreRoomsBtn) {
        elements.moreRoomsBtn.addEventListener('click', function() {
            if (elements.moreRoomsDropdown) {
                elements.moreRoomsDropdown.classList.toggle('show');
            }
        });
    }
    
    if (elements.moreRoomsDropdown) {
        elements.moreRoomsDropdown.addEventListener('click', function(e) {
            var btn = e.target.closest('.room-btn-small');
            if (btn && btn.dataset.room) {
                selectRoom(btn.dataset.room);
                elements.moreRoomsDropdown.classList.remove('show');
            }
        });
    }
    
    // Scanner controls
    if (elements.startBtn) {
        elements.startBtn.addEventListener('click', startScanner);
    }
    
    if (elements.stopBtn) {
        elements.stopBtn.addEventListener('click', stopScanner);
    }
    
    if (elements.switchCameraBtn) {
        elements.switchCameraBtn.addEventListener('click', switchCamera);
    }
    
    // Manual entry
    if (elements.manualEntryToggle) {
        elements.manualEntryToggle.addEventListener('click', toggleManualEntry);
    }
    
    if (elements.manualSubmit) {
        elements.manualSubmit.addEventListener('click', submitManualEntry);
    }
    
    if (elements.manualCode) {
        elements.manualCode.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                submitManualEntry();
            }
        });
    }
    
    // Result modal
    if (elements.closeResult) {
        elements.closeResult.addEventListener('click', hideResult);
    }
    
    if (elements.resultSection) {
        elements.resultSection.addEventListener('click', function(e) {
            if (e.target === elements.resultSection) {
                hideResult();
            }
        });
    }
    
    // Recent scans refresh
    if (elements.refreshRecent) {
        elements.refreshRecent.addEventListener('click', function() {
            fetchRecentScans();
            fetchStats();
        });
    }
    
    // Offline queue retry
    if (elements.retryQueue) {
        elements.retryQueue.addEventListener('click', processOfflineQueue);
    }
    
    // Connection status
    window.addEventListener('online', function() {
        updateConnectionStatus();
        showToast('success', 'Back Online', 'Syncing queued scans...');
        processOfflineQueue();
    });
    
    window.addEventListener('offline', function() {
        updateConnectionStatus();
        showToast('warning', 'Offline', 'Scans will be queued');
    });
    
    // Page visibility
    document.addEventListener('visibilitychange', function() {
        if (document.visibilityState === 'visible' && navigator.onLine) {
            fetchStats();
            fetchRecentScans();
            processOfflineQueue();
        }
    });
    
    // Close dropdowns when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.more-rooms') && elements.moreRoomsDropdown) {
            elements.moreRoomsDropdown.classList.remove('show');
        }
    });
}

// ============================================
// GLOBAL EXPORT FOR TESTING
// ============================================
window.AttendanceApp = {
    state: state,
    config: CONFIG,
    startScanner: startScanner,
    stopScanner: stopScanner,
    processAttendance: processAttendance,
    fetchStats: fetchStats,
    fetchRecentScans: fetchRecentScans
};
