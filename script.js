/**
 * SIMPLE ATTENDANCE SCANNER
 * Lightweight, Fast, Live Sync
 */

// ⚠️ PASTE YOUR GOOGLE APPS SCRIPT URL HERE
const API_URL = 'https://script.google.com/macros/s/AKfycbym74lkksn7h8VktgkhVGNRQr__Zn3Ac86lHoXsL7hpH9gbGokw1UNDYySB-1JQcWGKNQ/exec';

// State
let scanner = null;
let isScanning = false;
let currentRoom = 'A';
let lastScan = 0;

// Elements
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const codeInput = document.getElementById('codeInput');
const submitBtn = document.getElementById('submitBtn');
const resultDiv = document.getElementById('result');
const countEl = document.getElementById('count');
const recentList = document.getElementById('recentList');
const statusEl = document.getElementById('status');
const refreshBtn = document.getElementById('refreshBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadData();
    setInterval(loadData, 5000); // Live sync every 5 seconds
    setupEvents();
    checkOnline();
});

// Setup Events
function setupEvents() {
    // Room selection
    document.querySelectorAll('.room').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.room').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRoom = btn.dataset.room;
        });
    });

    // Start/Stop Scanner
    startBtn.addEventListener('click', startScanner);
    stopBtn.addEventListener('click', stopScanner);

    // Manual submit
    submitBtn.addEventListener('click', () => {
        const code = codeInput.value.trim().toUpperCase();
        if (code) {
            submitAttendance(code);
            codeInput.value = '';
        }
    });

    codeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') submitBtn.click();
    });

    // Refresh
    refreshBtn.addEventListener('click', loadData);

    // Online/Offline
    window.addEventListener('online', checkOnline);
    window.addEventListener('offline', checkOnline);
}

// Check Online Status
function checkOnline() {
    if (navigator.onLine) {
        statusEl.textContent = '● Online';
        statusEl.classList.remove('offline');
    } else {
        statusEl.textContent = '● Offline';
        statusEl.classList.add('offline');
    }
}

// Start Camera Scanner
async function startScanner() {
    try {
        scanner = new Html5Qrcode("scanner");
        
        await scanner.start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onScanSuccess,
            () => {}
        );

        isScanning = true;
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
        showResult('Camera started! Point at barcode.', 'success');
        
    } catch (err) {
        showResult('Camera error: ' + err.message, 'error');
    }
}

// Stop Scanner
async function stopScanner() {
    if (scanner && isScanning) {
        await scanner.stop();
        scanner.clear();
        isScanning = false;
        startBtn.style.display = 'block';
        stopBtn.style.display = 'none';
    }
}

// On Successful Scan
function onScanSuccess(code) {
    // Prevent rapid duplicate scans
    if (Date.now() - lastScan < 2000) return;
    lastScan = Date.now();

    // Vibrate
    if (navigator.vibrate) navigator.vibrate(100);

    submitAttendance(code.trim().toUpperCase());
}

// Submit Attendance to API
async function submitAttendance(code) {
    showResult('Processing...', 'warning');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentCode: code,
                room: 'Room ' + currentRoom
            })
        });

        const data = await response.json();

        if (data.success) {
            showResult(`✓ ${code} - ${data.data.studentName || 'Recorded'}`, 'success');
            loadData(); // Refresh list
        } else {
            if (data.errorCode === 'DUPLICATE') {
                showResult(`⚠ ${code} already scanned today!`, 'warning');
            } else {
                showResult(`✗ ${data.message}`, 'error');
            }
        }
    } catch (err) {
        showResult('Network error. Try again.', 'error');
    }
}

// Load Stats & Recent Scans (Live Sync)
async function loadData() {
    try {
        // Get stats
        const statsRes = await fetch(API_URL + '?action=stats');
        const stats = await statsRes.json();
        
        if (stats.success) {
            countEl.textContent = stats.data.totalToday || 0;
        }

        // Get recent scans
        const recentRes = await fetch(API_URL + '?action=recent&limit=10');
        const recent = await recentRes.json();

        if (recent.success && recent.data.scans) {
            renderRecent(recent.data.scans);
        }
    } catch (err) {
        console.log('Sync error');
    }
}

// Render Recent Scans
function renderRecent(scans) {
    if (scans.length === 0) {
        recentList.innerHTML = '<div class="empty">No scans yet</div>';
        return;
    }

    recentList.innerHTML = scans.map(s => `
        <div class="scan-item">
            <div>
                <div class="code">${s.studentCode}</div>
                <div class="meta">${s.studentName || 'Unknown'}</div>
            </div>
            <div class="meta">${s.room}<br>${formatTime(s.timestamp)}</div>
        </div>
    `).join('');
}

// Format Time
function formatTime(ts) {
    if (!ts) return '';
    try {
        const d = new Date(ts.replace(' ', 'T'));
        return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
        return ts;
    }
}

// Show Result Message
function showResult(msg, type) {
    resultDiv.textContent = msg;
    resultDiv.className = 'result ' + type;
    
    if (type !== 'warning' || msg.includes('already')) {
        setTimeout(() => {
            resultDiv.style.display = 'none';
        }, 3000);
    }
}
