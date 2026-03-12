/**
 * ==========================================
 * ATTENDANCE DASHBOARD - JAVASCRIPT
 * Live Statistics & Real-time Updates
 * ==========================================
 */

// Configuration
const CONFIG = {
    API_URL: 'https://script.google.com/macros/s/AKfycbym74lkksn7h8VktgkhVGNRQr__Zn3Ac86lHoXsL7hpH9gbGokw1UNDYySB-1JQcWGKNQ/exec',
    REFRESH_INTERVAL: 10000, // 10 seconds
    VALID_ROOMS: ['Room A', 'Room B', 'Room C', 'Room D', 'Room E', 'Room F', 'Room G', 'Room H', 'Room I', 'Room J']
};

// State
const state = {
    autoRefresh: true,
    refreshTimer: null,
    stats: null,
    recentScans: []
};

// DOM Elements
const elements = {
    themeToggle: document.getElementById('themeToggle'),
    currentDate: document.getElementById('currentDate'),
    totalCount: document.getElementById('totalCount'),
    roomsActive: document.getElementById('roomsActive'),
    lastHourCount: document.getElementById('lastHourCount'),
    roomsGrid: document.getElementById('roomsGrid'),
    hourlyChart: document.getElementById('hourlyChart'),
    liveFeed: document.getElementById('liveFeed'),
    lastUpdated: document.getElementById('lastUpdated'),
    autoRefreshToggle: document.getElementById('autoRefreshToggle')
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initializeDashboard();
});

function initializeDashboard() {
    loadTheme();
    setupEventListeners();
    setCurrentDate();
    fetchAllData();
    startAutoRefresh();
}

// Theme Management
function loadTheme() {
    const savedTheme = localStorage.getItem('attendance_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('attendance_theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = elements.themeToggle.querySelector('i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

// Event Listeners
function setupEventListeners() {
    elements.themeToggle.addEventListener('click', toggleTheme);
    
    elements.autoRefreshToggle.addEventListener('click', () => {
        state.autoRefresh = !state.autoRefresh;
        elements.autoRefreshToggle.classList.toggle('active', state.autoRefresh);
        
        if (state.autoRefresh) {
            startAutoRefresh();
        } else {
            stopAutoRefresh();
        }
    });
}

// Date Display
function setCurrentDate() {
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    elements.currentDate.textContent = new Date().toLocaleDateString('en-US', options);
}

// Auto Refresh
function startAutoRefresh() {
    if (state.refreshTimer) {
        clearInterval(state.refreshTimer);
    }
    
    state.refreshTimer = setInterval(() => {
        if (state.autoRefresh) {
            fetchAllData();
        }
    }, CONFIG.REFRESH_INTERVAL);
}

function stopAutoRefresh() {
    if (state.refreshTimer) {
        clearInterval(state.refreshTimer);
        state.refreshTimer = null;
    }
}

// Data Fetching
async function fetchAllData() {
    try {
        await Promise.all([
            fetchStats(),
            fetchRecentScans()
        ]);
        
        elements.lastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}

async function fetchStats() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=stats`);
        const result = await response.json();
        
        if (result.success && result.data) {
            state.stats = result.data;
            updateStatsUI();
        }
        
    } catch (error) {
        console.error('Error fetching stats:', error);
    }
}

async function fetchRecentScans() {
    try {
        const response = await fetch(`${CONFIG.API_URL}?action=recent&limit=30`);
        const result = await response.json();
        
        if (result.success && result.data.scans) {
            state.recentScans = result.data.scans;
            updateLiveFeed();
        }
        
    } catch (error) {
        console.error('Error fetching recent scans:', error);
    }
}

// UI Updates
function updateStatsUI() {
    if (!state.stats) return;
    
    // Total count with animation
    animateNumber(elements.totalCount, state.stats.totalToday || 0);
    
    // Active rooms
    const activeRooms = Object.values(state.stats.roomCounts || {}).filter(count => count > 0).length;
    animateNumber(elements.roomsActive, activeRooms);
    
    // Last hour count (calculate from hourly distribution)
    const currentHour = new Date().getHours();
    const lastHourCount = state.stats.hourlyDistribution?.[currentHour] || 0;
    animateNumber(elements.lastHourCount, lastHourCount);
    
    // Update room cards
    updateRoomCards();
    
    // Update hourly chart
    updateHourlyChart();
}

function updateRoomCards() {
    const roomCounts = state.stats?.roomCounts || {};
    
    elements.roomsGrid.innerHTML = CONFIG.VALID_ROOMS.slice(0, 6).map(room => {
        const count = roomCounts[room] || 0;
        const letter = room.replace('Room ', '');
        
        return `
            <div class="room-stat-card">
                <div class="room-stat-icon">${letter}</div>
                <div class="room-stat-info">
                    <h3>${count}</h3>
                    <p>${room}</p>
                </div>
            </div>
        `;
    }).join('');
}

function updateHourlyChart() {
    const distribution = state.stats?.hourlyDistribution || {};
    const maxCount = Math.max(...Object.values(distribution), 1);
    
    // Show hours from 6 AM to 8 PM
    const hours = [];
    for (let h = 6; h <= 20; h++) {
        hours.push(h);
    }
    
    elements.hourlyChart.innerHTML = hours.map(hour => {
        const count = distribution[hour] || 0;
        const percentage = (count / maxCount) * 100;
        const hourLabel = hour > 12 ? `${hour - 12}PM` : (hour === 12 ? '12PM' : `${hour}AM`);
        
        return `
            <div class="chart-bar">
                <span class="chart-bar-label">${hourLabel}</span>
                <div class="chart-bar-track">
                    <div class="chart-bar-fill" style="width: ${percentage}%">
                        ${count > 0 ? count : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function updateLiveFeed() {
    if (state.recentScans.length === 0) {
        elements.liveFeed.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No scans yet today</p>
            </div>
        `;
        return;
    }
    
    elements.liveFeed.innerHTML = state.recentScans.map((scan, index) => `
        <div class="scan-item" style="animation-delay: ${index * 0.03}s">
            <div class="scan-item-icon">${(scan.studentCode || '?')[0]}</div>
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

// Utility Functions
function animateNumber(element, target) {
    const current = parseInt(element.textContent) || 0;
    const increment = (target - current) / 20;
    let value = current;
    
    const timer = setInterval(() => {
        value += increment;
        if ((increment > 0 && value >= target) || (increment < 0 && value <= target)) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.round(value);
        }
    }, 50);
}

function formatTime(timestamp) {
    if (!timestamp) return '';
    
    try {
        let date;
        if (typeof timestamp === 'string') {
            date = new Date(timestamp.replace(' ', 'T'));
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
