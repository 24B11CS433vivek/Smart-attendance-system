/* ════════════════════════════════════════════════
   AttendX — script.js
   Full scanner logic, offline queue, dashboard
   ════════════════════════════════════════════════ */

// ──────────────────────────────────────────────
//  CONFIG  (set your deployed Apps Script URL)
// ──────────────────────────────────────────────
const CONFIG_KEY = 'attendx_api_url';
let API_URL = localStorage.getItem(CONFIG_KEY) || '';

// ──────────────────────────────────────────────
//  STATE
// ──────────────────────────────────────────────
let html5QrCode   = null;
let scanning      = false;
let currentRoom   = 'Room 1';
let scanCount     = 0;
let offlineQueue  = JSON.parse(localStorage.getItem('attendx_queue') || '[]');

// Today's scanned codes (for frontend duplicate prevention)
const TODAY_KEY   = 'attendx_today_' + getTodayStr();
let todayScanned  = new Set(JSON.parse(localStorage.getItem(TODAY_KEY) || '[]'));

// ──────────────────────────────────────────────
//  INIT
// ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initBackground();
  initRoomPills();
  checkNetworkStatus();
  updateScanCount();
  restoreQueueBadge();

  // Show config modal if no API URL set
  if (!API_URL) {
    setTimeout(() => openConfig(), 600);
  }

  // Retry offline queue every 30 seconds
  setInterval(retryOfflineQueue, 30_000);
  setInterval(checkNetworkStatus, 5_000);
});

// ──────────────────────────────────────────────
//  PAGES
// ──────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (id === 'page-dashboard') loadDashboard();
}

// ──────────────────────────────────────────────
//  ROOM PILLS
// ──────────────────────────────────────────────
function initRoomPills() {
  document.querySelectorAll('.pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentRoom = pill.dataset.room;
    });
  });
}

// ──────────────────────────────────────────────
//  SCANNER TOGGLE
// ──────────────────────────────────────────────
async function toggleScanner() {
  if (!API_URL) { openConfig(); return; }
  scanning ? stopScanner() : startScanner();
}

async function startScanner() {
  const btnText = document.getElementById('btn-text');
  const btnStart = document.getElementById('btn-start');
  const frame  = document.getElementById('scanner-frame');

  btnText.textContent = 'Starting…';
  btnStart.disabled = true;

  try {
    html5QrCode = new Html5Qrcode('reader');

    const config = {
      fps: 15,
      qrbox: { width: 220, height: 220 },
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
      rememberLastUsedCamera: true,
    };

    await html5QrCode.start(
      { facingMode: 'environment' },
      config,
      onScanSuccess,
      onScanError
    );

    scanning = true;
    frame.classList.add('active');
    btnText.textContent = '⏹ STOP SCANNING';
    btnStart.classList.add('scanning');
    btnStart.disabled = false;

  } catch (err) {
    console.error('Camera error:', err);
    showToast('error', '✕', 'Camera Error', err.message || 'Cannot access camera');
    btnText.textContent = 'START SCANNING';
    btnStart.disabled = false;
  }
}

async function stopScanner() {
  const btnText  = document.getElementById('btn-text');
  const btnStart = document.getElementById('btn-start');
  const frame    = document.getElementById('scanner-frame');

  if (html5QrCode) {
    try { await html5QrCode.stop(); } catch(e) {}
    html5QrCode = null;
  }
  scanning = false;
  frame.classList.remove('active');
  btnText.textContent = 'START SCANNING';
  btnStart.classList.remove('scanning');
}

// ──────────────────────────────────────────────
//  SCAN CALLBACKS
// ──────────────────────────────────────────────
let lastScanned   = '';
let scanCooldown  = false;  // prevents double-fire

async function onScanSuccess(decodedText) {
  const code = decodedText.trim().toUpperCase();

  // Debounce: skip if same code within 2.5s
  if (scanCooldown && code === lastScanned) return;
  lastScanned  = code;
  scanCooldown = true;
  setTimeout(() => { scanCooldown = false; }, 2500);

  playBeep();

  // ── Frontend duplicate check ──
  if (todayScanned.has(code)) {
    flashOverlay('dup');
    showToast('dup', '⚠', 'Already Scanned', `${code} marked earlier today`);
    addToRecentList(code, currentRoom, getCurrentTime(), 'dup');
    return;
  }

  // ── Optimistic UI update ──
  todayScanned.add(code);
  persistTodaySet();
  scanCount++;
  updateScanCount();
  flashOverlay('success');
  showToast('success', '✓', 'Marked Present', `${code} — ${currentRoom}`);
  addToRecentList(code, currentRoom, getCurrentTime(), 'new');

  // ── Send to backend ──
  await submitAttendance(code, currentRoom);
}

function onScanError(err) {
  // Silent — normal during scanning when no QR in frame
}

// ──────────────────────────────────────────────
//  SUBMIT TO BACKEND
// ──────────────────────────────────────────────
async function submitAttendance(code, room) {
  const payload = { code, room, timestamp: new Date().toISOString() };

  if (!navigator.onLine) {
    enqueueOffline(payload);
    return;
  }

  try {
    // Use no-cors mode with URL params as fallback
    const url = API_URL
      + "?code=" + encodeURIComponent(code)
      + "&room=" + encodeURIComponent(room);

    const res  = await fetch(url, { method: "GET" });
    const data = await res.json();

    if (data.status === "duplicate") {
      showToast("dup", "⚠", "Duplicate (server)", code + " already in sheet");
    }

  } catch (err) {
    console.warn("Network fail, queuing:", err);
    enqueueOffline(payload);
  }
}

// ──────────────────────────────────────────────
//  OFFLINE QUEUE
// ──────────────────────────────────────────────
function enqueueOffline(payload) {
  offlineQueue.push(payload);
  localStorage.setItem('attendx_queue', JSON.stringify(offlineQueue));
  restoreQueueBadge();
}

async function retryOfflineQueue() {
  if (!navigator.onLine || offlineQueue.length === 0) return;

  const toRetry = [...offlineQueue];
  offlineQueue  = [];
  localStorage.removeItem('attendx_queue');
  restoreQueueBadge();

  for (const payload of toRetry) {
    try {
      await fetch(API_URL, {
        method:  'POST',
        headers: { 'Content-Type': 'text/plain' },
        body:    JSON.stringify(payload),
      });
    } catch (err) {
      offlineQueue.push(payload); // re-queue on fail
    }
  }

  if (offlineQueue.length > 0) {
    localStorage.setItem('attendx_queue', JSON.stringify(offlineQueue));
  }
  restoreQueueBadge();
}

function restoreQueueBadge() {
  const badge = document.getElementById('queue-badge');
  if (offlineQueue.length > 0) {
    badge.style.display = 'inline';
    badge.textContent   = `● ${offlineQueue.length} pending`;
  } else {
    badge.style.display = 'none';
  }
}

// ──────────────────────────────────────────────
//  NETWORK STATUS
// ──────────────────────────────────────────────
function checkNetworkStatus() {
  const dot = document.getElementById('net-status');
  if (navigator.onLine) {
    dot.className = 'status-dot online';
    retryOfflineQueue();
  } else {
    dot.className = 'status-dot offline';
  }
}
window.addEventListener('online',  checkNetworkStatus);
window.addEventListener('offline', checkNetworkStatus);

// ──────────────────────────────────────────────
//  TOAST NOTIFICATION
// ──────────────────────────────────────────────
let toastTimer = null;
function showToast(type, icon, title, detail) {
  const toast  = document.getElementById('result-toast');
  const iEl    = document.getElementById('toast-icon');
  const tEl    = document.getElementById('toast-title');
  const dEl    = document.getElementById('toast-detail');

  toast.className = `result-toast toast-${type} show`;
  iEl.textContent = icon;
  tEl.textContent = title;
  dEl.textContent = detail;

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

// ──────────────────────────────────────────────
//  FLASH OVERLAY
// ──────────────────────────────────────────────
function flashOverlay(type) {
  const el = document.getElementById('flash-overlay');
  el.className = '';
  void el.offsetWidth; // reflow
  el.className = `flash-${type}`;
  setTimeout(() => el.className = '', 400);
}

// ──────────────────────────────────────────────
//  RECENT SCANS LIST
// ──────────────────────────────────────────────
function addToRecentList(code, room, time, type) {
  const list  = document.getElementById('scan-list');
  const empty = list.querySelector('.scan-empty');
  if (empty) empty.remove();

  const li = document.createElement('li');
  li.className = `scan-item ${type === 'dup' ? 'dup-item' : 'new-item'}`;
  li.innerHTML = `
    <span class="scan-dot"></span>
    <span class="scan-code">${escHtml(code)}</span>
    <span class="scan-room">${escHtml(room)}</span>
    <span class="scan-time">${time}</span>
  `;
  list.insertBefore(li, list.firstChild);

  // Cap at 30 items
  while (list.children.length > 30) list.removeChild(list.lastChild);
}

// ──────────────────────────────────────────────
//  SCAN COUNTER
// ──────────────────────────────────────────────
function updateScanCount() {
  const el = document.getElementById('scan-count');
  el.style.transform = 'scale(1.3)';
  el.textContent = scanCount;
  setTimeout(() => el.style.transform = 'scale(1)', 200);
}

// ──────────────────────────────────────────────
//  DASHBOARD
// ──────────────────────────────────────────────
async function loadDashboard() {
  if (!API_URL) { openConfig(); return; }

  document.getElementById('dash-total').textContent = '—';
  document.getElementById('dash-date').textContent  = 'Loading…';
  document.getElementById('dash-tbody').innerHTML   = '<tr><td colspan="3" class="loading-cell">Loading…</td></tr>';

  // Reset room cards
  const cards = document.getElementById('room-cards');
  cards.innerHTML = '';
  ['Room 1','Room 2','Room 3','Room 4'].forEach(() => {
    const d = document.createElement('div');
    d.className = 'room-card skeleton';
    cards.appendChild(d);
  });

  try {
    const res  = await fetch(`${API_URL}?action=stats`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error(data.message);

    renderDashboard(data);
  } catch (err) {
    document.getElementById('dash-total').textContent = 'ERR';
    document.getElementById('dash-date').textContent  = 'Failed to load';
    console.error(err);
  }
}

function renderDashboard(data) {
  // Date
  document.getElementById('dash-date').textContent = data.date || getTodayStr();

  // Total
  const total = data.total || 0;
  document.getElementById('dash-total').textContent = total;

  // Progress bar
  const pct = Math.min((total / 400) * 100, 100).toFixed(1);
  document.getElementById('dash-progress').style.width = pct + '%';

  // Room cards
  const cards  = document.getElementById('room-cards');
  cards.innerHTML = '';
  const rooms  = ['Room 1','Room 2','Room 3','Room 4'];
  const maxRm  = Math.max(...rooms.map(r => data.roomCounts[r] || 0), 1);

  rooms.forEach(room => {
    const count  = data.roomCounts[room] || 0;
    const fillPct = ((count / maxRm) * 100).toFixed(1);
    const card    = document.createElement('div');
    card.className = 'room-card';
    card.innerHTML = `
      <div class="room-card-name">${room}</div>
      <div class="room-card-count">${count}</div>
      <div class="room-card-bar"><div class="room-card-fill" style="width:${fillPct}%"></div></div>
    `;
    cards.appendChild(card);
  });

  // Recent table
  const tbody = document.getElementById('dash-tbody');
  tbody.innerHTML = '';
  if (!data.recent || data.recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" class="loading-cell">No scans yet</td></tr>';
    return;
  }
  data.recent.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escHtml(row.code)}</strong></td>
      <td>${escHtml(row.room)}</td>
      <td>${escHtml(row.time)}</td>
    `;
    tbody.appendChild(tr);
  });
}

// ──────────────────────────────────────────────
//  CONFIG MODAL
// ──────────────────────────────────────────────
function openConfig() {
  const modal = document.getElementById('config-modal');
  document.getElementById('api-url-input').value = API_URL;
  modal.classList.add('open');
}
function closeConfig() {
  document.getElementById('config-modal').classList.remove('open');
}
function saveConfig() {
  const val = document.getElementById('api-url-input').value.trim();
  if (!val.startsWith('https://')) {
    alert('Please paste a valid https:// URL');
    return;
  }
  API_URL = val;
  localStorage.setItem(CONFIG_KEY, API_URL);
  closeConfig();
  showToast('success', '✓', 'API Saved', 'Ready to scan');
}

// ──────────────────────────────────────────────
//  SOUND  (Web Audio API — no external files)
// ──────────────────────────────────────────────
let audioCtx = null;
function playBeep() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc  = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type      = 'sine';
    osc.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + .18);
    osc.start();
    osc.stop(audioCtx.currentTime + .18);
  } catch(e) {}
}

// ──────────────────────────────────────────────
//  BACKGROUND ANIMATION (grid dots)
// ──────────────────────────────────────────────
function initBackground() {
  const canvas = document.getElementById('bg-canvas');
  const ctx    = canvas.getContext('2d');

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const dots = [];
  const N    = 60;
  for (let i = 0; i < N; i++) {
    dots.push({
      x:  Math.random() * window.innerWidth,
      y:  Math.random() * window.innerHeight,
      r:  Math.random() * 1.5 + .5,
      vx: (Math.random() - .5) * .3,
      vy: (Math.random() - .5) * .3,
      a:  Math.random(),
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    dots.forEach(d => {
      d.x += d.vx; d.y += d.vy;
      if (d.x < 0) d.x = canvas.width;
      if (d.x > canvas.width) d.x = 0;
      if (d.y < 0) d.y = canvas.height;
      if (d.y > canvas.height) d.y = 0;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,229,255,${d.a * .3})`;
      ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
}

// ──────────────────────────────────────────────
//  HELPERS
// ──────────────────────────────────────────────
function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}
function getCurrentTime() {
  return new Date().toLocaleTimeString('en-IN', { hour12: false });
}
function persistTodaySet() {
  localStorage.setItem(TODAY_KEY, JSON.stringify([...todayScanned]));
}
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
