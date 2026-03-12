/**
 * ATTENDANCE SCANNER - CORS FIXED VERSION
 * 100% Working with Google Apps Script
 */

// ============================================
// ⚠️ PASTE YOUR GOOGLE APPS SCRIPT URL HERE
// ============================================
const API = 'https://script.google.com/macros/s/AKfycbyfcH6tPpSlnPOHvM7unN-GbO_k33W6IzHzFpy6FahLPrM00UGAdx1e0KnSg9Z0vXCF/exec';

// State
let scanner = null;
let scanning = false;
let room = 'Room A';
let lastScan = 0;

// DOM Elements
const $ = id => document.getElementById(id);
const startBtn = $('startBtn');
const stopBtn = $('stopBtn');
const manualInput = $('manualInput');
const manualBtn = $('manualBtn');
const message = $('message');
const totalCount = $('totalCount');
const recentList = $('recentList');
const status = $('status');
const placeholder = $('placeholder');
const refreshBtn = $('refreshBtn');
const roomsDiv = $('rooms');

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', init);

function init() {
    // Load data
    loadData();
    
    // Auto refresh every 5 seconds for live sync
    setInterval(loadData, 5000);
    
    // Room selection
    roomsDiv.addEventListener('click', e => {
        if (e.target.classList.contains('room')) {
            document.querySelectorAll('.room').forEach(r => r.classList.remove('active'));
            e.target.classList.add('active');
            room = e.target.dataset.room;
            showMsg(`Selected: ${room}`, 'info');
        }
    });
    
    // Start/Stop camera
    startBtn.onclick = startCamera;
    stopBtn.onclick = stopCamera;
    
    // Manual entry
    manualBtn.onclick = () => {
        const code = manualInput.value.trim().toUpperCase();
        if (code) {
            submitCode(code);
            manualInput.value = '';
        }
    };
    
    manualInput.onkeypress = e => {
        if (e.key === 'Enter') manualBtn.click();
    };
    
    // Refresh button
    refreshBtn.onclick = loadData;
    
    // Online/offline status
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
}

// ============================================
// CAMERA FUNCTIONS
// ============================================
async function startCamera() {
    showMsg('Starting camera...', 'info');
    
    try {
        scanner = new Html5Qrcode('scanner');
        
        await scanner.start(
            { facingMode: 'environment' },
            {
                fps: 10,
                qrbox: { width: 250, height: 250 },
                aspectRatio: 1.0
            },
            onScan,
            () => {} // ignore errors
        );
        
        scanning = true;
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
        placeholder.classList.add('hidden');
        showMsg('📷 Camera ready! Scan barcode/QR code', 'success');
        
    } catch (err) {
        console.error('Camera error:', err);
        showMsg('Camera error: ' + err.message, 'error');
    }
}

async function stopCamera() {
    if (scanner && scanning) {
        try {
            await scanner.stop();
            scanner.clear();
        } catch (e) {}
        
        scanning = false;
        startBtn.style.display = 'block';
        stopBtn.style.display = 'none';
        placeholder.classList.remove('hidden');
    }
}

// ============================================
// SCAN HANDLER
// ============================================
function onScan(code) {
    // Prevent rapid duplicate scans (2 second cooldown)
    const now = Date.now();
    if (now - lastScan < 2000) return;
    lastScan = now;
    
    // Vibrate feedback
    if (navigator.vibrate) navigator.vibrate(100);
    
    // Process the code
    submitCode(code.trim().toUpperCase());
}

// ============================================
// SUBMIT ATTENDANCE (CORS FIXED!)
// ============================================
async function submitCode(code) {
    if (!code || code.length < 2) {
        showMsg('Invalid code', 'error');
        return;
    }
    
    showMsg('Processing...', 'info');
    
    try {
        // ✅ CORS FIX: Use URL parameters instead of JSON body
        const url = `${API}?action=add&code=${encodeURIComponent(code)}&room=${encodeURIComponent(room)}`;
        
        const response = await fetch(url, {
            method: 'GET',
            redirect: 'follow'
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMsg(`✅ ${code} - Recorded!`, 'success');
            loadData(); // Refresh the list
        } else {
            if (result.error === 'DUPLICATE') {
                showMsg(`⚠️ ${code} already scanned today!`, 'warning');
            } else {
                showMsg(`❌ ${result.message || 'Error'}`, 'error');
            }
        }
        
    } catch (err) {
        console.error('Network error:', err);
        showMsg('Network error. Check internet.', 'error');
    }
}

// ============================================
// LOAD DATA (LIVE SYNC)
// ============================================
async function loadData() {
    try {
        // Get stats
        const statsUrl = `${API}?action=stats`;
        const statsRes = await fetch(statsUrl);
        const stats = await statsRes.json();
        
        if (stats.success) {
            totalCount.textContent = stats.total || 0;
        }
        
        // Get recent scans
        const recentUrl = `${API}?action=recent&limit=15`;
        const recentRes = await fetch(recentUrl);
        const recent = await recentRes.json();
        
        if (recent.success && recent.scans) {
            renderRecent(recent.scans);
        }
        
    } catch (err) {
        console.log('Sync failed');
    }
}

// ============================================
// RENDER RECENT SCANS
// ============================================
function renderRecent(scans) {
    if (!scans || scans.length === 0) {
        recentList.innerHTML = '<div class="empty-msg">No scans yet today</div>';
        return;
    }
    
    recentList.innerHTML = scans.map(s => `
        <div class="scan-item">
            <div>
                <div class="code">${s.code}</div>
                <div class="name">${s.name || 'Student'}</div>
            </div>
            <div>
                <div class="time">${s.time}</div>
                <div class="room-tag">${s.room}</div>
            </div>
        </div>
    `).join('');
}

// ============================================
// HELPERS
// ============================================
function showMsg(text, type) {
    message.textContent = text;
    message.className = 'message ' + type;
    
    // Auto hide after 3 seconds (except for processing)
    if (type !== 'info') {
        setTimeout(() => {
            message.className = 'message';
        }, 3000);
    }
}

function updateStatus() {
    if (navigator.onLine) {
        status.textContent = '● Online';
        status.className = 'online';
    } else {
        status.textContent = '● Offline';
        status.className = 'offline';
    }
}
