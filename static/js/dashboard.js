// Dashboard Configuration
const CONFIG = {
    UPDATE_INTERVAL: 1000, // 1 second
    TIME_UPDATE_INTERVAL: 1000,
    API_TIMEOUT: 5000,
    CHART_MAX_POINTS: 30,
    ZONE_THRESHOLDS: {
        green: 10,    // < 10
        yellow: 40    // 10-40, > 40 is red
    }
};

// Global state
let dashboardState = {
    zones: {},
    lastZonesSignature: '',
    alerts: [],
    alertsSignature: '',
    trend: {
        timestamps: [],
        counts: []
    },
    trendSignature: '',
    totalCount: 0,
    trendChart: null,
    lastUpdate: null,
    isUpdating: false
};

const zoneElementCache = {};
const cameraSectorCache = {};

function getCameraSectorCounts() {
    const counts = {};
    const cameraCells = document.querySelectorAll('.grid-cell[data-zone]');

    cameraCells.forEach((cell) => {
        const zoneId = cell.dataset.zone;
        const count = Number.parseInt(cell.dataset.count || '0', 10);
        counts[zoneId] = Number.isNaN(count) ? 0 : count;
    });

    return counts;
}

function applyZoneCountsToCamera(zoneCounts) {
    if (!zoneCounts || typeof zoneCounts !== 'object') {
        return;
    }

    Object.entries(zoneCounts).forEach(([zoneId, value]) => {
        if (!cameraSectorCache[zoneId]) {
            cameraSectorCache[zoneId] = document.querySelector(`.grid-cell[data-zone="${zoneId}"]`);
        }

        const cell = cameraSectorCache[zoneId];
        if (!cell) {
            return;
        }

        const count = Number.parseInt(String(value), 10);
        const normalized = Number.isNaN(count) ? 0 : count;

        cell.dataset.count = String(normalized);
        const countElement = cell.querySelector('.camera-zone-count');
        if (countElement) {
            countElement.textContent = String(normalized);
        }

        cell.classList.remove('status-green', 'status-yellow', 'status-red');
        cell.classList.add(`status-${getZoneStatus(normalized)}`);
    });
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format time for display
 */
function formatTime(date = new Date()) {
    return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
    });
}

/**
 * Get zone status based on count
 */
function getZoneStatus(count) {
    if (count < CONFIG.ZONE_THRESHOLDS.green) {
        return 'green';
    } else if (count <= CONFIG.ZONE_THRESHOLDS.yellow) {
        return 'yellow';
    } else {
        return 'red';
    }
}

/**
 * Show/hide loading indicator
 */
function showLoading(show = true) {
    const indicator = document.getElementById('loading-indicator');
    if (show) {
        indicator.classList.add('active');
    } else {
        indicator.classList.remove('active');
    }
}

/**
 * Fetch data from API with error handling
 */
async function fetchAPI(endpoint) {
    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Failed to fetch ${endpoint}:`, error);
        return null;
    }
}

// ============================================================================
// API Data Fetching
// ============================================================================

/**
 * Fetch zones data from API
 */
async function updateZonesData() {
    const data = await fetchAPI('/api/zones');
    if (!data) return false;

    dashboardState.zones = {};
    data.zones.forEach(zone => {
        dashboardState.zones[zone.id] = zone.count;
    });
    dashboardState.totalCount = data.total;
    dashboardState.lastUpdate = new Date();

    return true;
}

/**
 * Fetch alerts data from API
 */
async function updateAlertsData() {
    const data = await fetchAPI('/api/alerts');
    if (!data) return false;

    dashboardState.alerts = data;
    return true;
}

/**
 * Fetch trend data from API
 */
async function updateTrendData() {
    const data = await fetchAPI('/api/trend');
    if (!data) return false;

    dashboardState.trend.timestamps = data.timestamps;
    dashboardState.trend.counts = data.counts;

    return true;
}

/**
 * Fetch all data from APIs
 */
async function updateAllData() {
    if (dashboardState.isUpdating) {
        return false;
    }

    dashboardState.isUpdating = true;
    
    const results = await Promise.all([
        updateZonesData(),
        updateAlertsData(),
        updateTrendData()
    ]);

    dashboardState.isUpdating = false;
    return results.every(r => r);
}

// ============================================================================
// UI Update Functions
// ============================================================================

/**
 * Update alerts bar
 */
function updateAlerts() {
    const container = document.getElementById('alerts-container');
    const signature = JSON.stringify(dashboardState.alerts || []);

    // Skip render when alerts are unchanged to avoid visual jitter.
    if (signature === dashboardState.alertsSignature) {
        return;
    }
    dashboardState.alertsSignature = signature;
    
    if (!dashboardState.alerts || dashboardState.alerts.length === 0) {
        container.innerHTML = `<div class="alert-scroll"><div class="alert alert--info">No active alerts</div></div>`;
        return;
    }

    const alertHTML = dashboardState.alerts.map(alert => {
        const severityClass = `alert--${alert.severity || 'info'}`;
        return `<div class="alert ${severityClass}">${alert.message}</div>`;
    }).join('');

    container.innerHTML = `<div class="alert-scroll">${alertHTML}</div>`;
}

/**
 * Update camera sectors with live zone headcounts
 */
function updateCameraSectors() {
    Object.entries(dashboardState.zones).forEach(([zoneId, count]) => {
        if (!cameraSectorCache[zoneId]) {
            cameraSectorCache[zoneId] = document.querySelector(`.grid-cell[data-zone="${zoneId}"]`);
        }

        const cell = cameraSectorCache[zoneId];
        if (!cell) return;

        const previousCount = Number.parseInt(cell.dataset.count || '0', 10);
        if (previousCount === count) {
            return;
        }

        cell.dataset.count = String(count);
        const countElement = cell.querySelector('.camera-zone-count');
        if (countElement) {
            countElement.textContent = String(count);
        }

        cell.classList.remove('status-green', 'status-yellow', 'status-red');
        const status = getZoneStatus(count);
        cell.classList.add(`status-${status}`);
    });
}

/**
 * Update zone grid visualization
 */
function updateZoneGrid() {
    const zonesFromCamera = getCameraSectorCounts();
    const zonesSignature = JSON.stringify(zonesFromCamera || {});
    if (zonesSignature === dashboardState.lastZonesSignature) {
        return;
    }

    Object.entries(zonesFromCamera).forEach(([zoneId, count]) => {
        if (!zoneElementCache[zoneId]) {
            zoneElementCache[zoneId] = document.querySelector(`.zone-block[data-zone="${zoneId}"]`);
        }

        const block = zoneElementCache[zoneId];
        if (!block) return;

        // Update count
        const countElement = block.querySelector('.zone-count');
        const previousCount = Number.parseInt(countElement.textContent, 10);

        if (previousCount === count) {
            return;
        }

        countElement.textContent = count;

        // Remove previous status classes
        block.classList.remove('status-green', 'status-yellow', 'status-red');

        // Add new status class
        const status = getZoneStatus(count);
        block.classList.add(`status-${status}`);

        // Add animation only when the value actually changes.
        countElement.style.animation = 'none';
        requestAnimationFrame(() => {
            countElement.style.animation = 'pulse 0.35s ease-out';
        });
    });

    dashboardState.lastZonesSignature = zonesSignature;
}

/**
 * Update zone table
 */
function updateZoneTable() {
    const tbody = document.getElementById('zones-table-body');
    const zonesFromCamera = getCameraSectorCounts();
    const zonesSignature = JSON.stringify(zonesFromCamera || {});

    if (zonesSignature === tbody.dataset.signature) {
        return;
    }
    
    const rows = Object.entries(zonesFromCamera)
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([zoneId, count]) => {
            const status = getZoneStatus(count);
            const statusText = status.charAt(0).toUpperCase() + status.slice(1);
            return `
                <tr>
                    <td><span class="zone-id">${zoneId}</span></td>
                    <td><span class="zone-people">${count}</span></td>
                    <td><span class="status-badge ${status}">${statusText}</span></td>
                </tr>
            `;
        })
        .join('');

    tbody.innerHTML = rows;
    tbody.dataset.signature = zonesSignature;
}

/**
 * Update total count display
 */
function updateTotalCount() {
    const totalElement = document.getElementById('total-count');
    const lastUpdateElement = document.getElementById('last-update');
    const zonesFromCamera = getCameraSectorCounts();
    const derivedTotal = Object.values(zonesFromCamera).reduce((acc, value) => acc + value, 0);

    // Animate count change
    const currentValue = parseInt(totalElement.textContent);
    const newValue = derivedTotal;

    if (currentValue !== newValue) {
        totalElement.style.animation = 'none';
        setTimeout(() => {
            totalElement.style.animation = 'pulse 0.5s ease-out';
        }, 10);
    }

    totalElement.textContent = newValue;
    lastUpdateElement.textContent = `Last updated: ${formatTime()}`;
}

/**
 * Initialize Chart.js trend chart
 */
function initTrendChart() {
    const ctx = document.getElementById('trendChart').getContext('2d');

    dashboardState.trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dashboardState.trend.timestamps,
            datasets: [{
                label: 'People Count',
                data: dashboardState.trend.counts,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#1e293b',
                pointBorderWidth: 2,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#06b6d4',
                hoverBorderColor: '#06b6d4',
                segment: {
                    borderColor: ctx => {
                        const value = ctx.p1DataIndex >= 0 ? ctx.dataset.data[ctx.p1DataIndex] : 0;
                        if (value > 100) return 'rgba(239, 68, 68, 0.8)';
                        if (value > 70) return 'rgba(245, 158, 11, 0.8)';
                        return 'rgba(16, 185, 129, 0.8)';
                    }
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0 // Disable animations for smooth real-time updates
            },
            plugins: {
                legend: {
                    display: true,
                    labels: {
                        color: '#f1f5f9',
                        padding: 20,
                        font: {
                            size: 13,
                            weight: '500'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    padding: 12,
                    titleColor: '#f1f5f9',
                    bodyColor: '#cbd5e1',
                    borderColor: '#3b82f6',
                    borderWidth: 1,
                    cornerRadius: 6,
                    titleFont: { size: 14, weight: '600' },
                    bodyFont: { size: 13 }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        color: 'rgba(51, 65, 85, 0.2)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#cbd5e1',
                        font: { size: 12 },
                        maxTicksLimit: 8 // Limit x-axis ticks for readability
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(51, 65, 85, 0.2)',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#cbd5e1',
                        font: { size: 12 }
                    }
                }
            }
        }
    });
}

/**
 * Update trend chart with new data
 */
function updateTrendChart() {
    const trendSignature = `${dashboardState.trend.timestamps.join('|')}::${dashboardState.trend.counts.join('|')}`;
    if (trendSignature === dashboardState.trendSignature) {
        return;
    }

    if (!dashboardState.trendChart) {
        initTrendChart();
        dashboardState.trendSignature = trendSignature;
        return;
    }

    // Update data with proper array cloning to trigger reactivity
    dashboardState.trendChart.data.labels = [...dashboardState.trend.timestamps];
    dashboardState.trendChart.data.datasets[0].data = [...dashboardState.trend.counts];
    
    // Force chart update with proper mode
    dashboardState.trendChart.update('none');
    dashboardState.trendSignature = trendSignature;
}

/**
 * Update current time in header
 */
function updateCurrentTime() {
    const timeElement = document.getElementById('current-time');
    timeElement.textContent = formatTime();
}

/**
 * Update all UI elements
 */
function updateUI() {
    updateAlerts();
    updateCameraSectors();
    updateZoneGrid();
    updateZoneTable();
    updateTotalCount();
    updateTrendChart();
    updateCurrentTime();
}

async function analyzeUploadedImage() {
    const fileInput = document.getElementById('people-image-input');
    const submitButton = document.getElementById('people-image-submit');
    const resultElement = document.getElementById('people-image-result');

    const file = fileInput?.files?.[0];
    if (!file) {
        resultElement.textContent = 'Please choose an image first.';
        return;
    }

    const formData = new FormData();
    formData.append('image', file);

    submitButton.disabled = true;
    resultElement.textContent = 'Analyzing image...';

    try {
        const response = await fetch('/api/people-count-image', {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || 'Image analysis failed.');
        }

        if (typeof data.count === 'number') {
            resultElement.textContent = `Detected people: ${data.count}`;
        } else {
            resultElement.textContent = 'Analysis completed, but count was not provided by external API.';
        }

        if (data.zone_counts) {
            applyZoneCountsToCamera(data.zone_counts);
            dashboardState.lastZonesSignature = '';
            updateZoneGrid();
            updateZoneTable();
            updateTotalCount();
        }
    } catch (error) {
        resultElement.textContent = `Error: ${error.message}`;
    } finally {
        submitButton.disabled = false;
    }
}

function initImageAnalyzer() {
    const submitButton = document.getElementById('people-image-submit');
    if (!submitButton) {
        return;
    }

    submitButton.addEventListener('click', analyzeUploadedImage);
}

// ============================================================================
// Main Update Loop
// ============================================================================

let updateInterval = null;
let timeInterval = null;

/**
 * Start the dashboard update loop
 */
function startDashboard() {
    console.log('Starting dashboard...');

    if (updateInterval) {
        return;
    }

    showLoading(true);

    // Initial data fetch
    updateAllData().then(() => {
        updateUI();
        showLoading(false);
    });

    // Set up periodic updates
    updateInterval = setInterval(async () => {
        await updateAllData();
        updateUI();
    }, CONFIG.UPDATE_INTERVAL);

    // Update time display once per second.
    if (!timeInterval) {
        timeInterval = setInterval(updateCurrentTime, CONFIG.TIME_UPDATE_INTERVAL);
    }
}

/**
 * Stop the dashboard update loop
 */
function stopDashboard() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
        console.log('Dashboard stopped');
    }

    if (timeInterval) {
        clearInterval(timeInterval);
        timeInterval = null;
    }
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize dashboard on page load
 */
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM Content Loaded - Initializing dashboard');
    initImageAnalyzer();
    startDashboard();

    // Pause updates when tab is not visible, resume when visible
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            console.log('Page hidden - pausing updates');
            stopDashboard();
        } else {
            console.log('Page visible - resuming updates');
            startDashboard();
        }
    });

    // Handle window beforeunload
    window.addEventListener('beforeunload', () => {
        stopDashboard();
    });
});

// ============================================================================
// Add CSS Animation for pulse effect
// ============================================================================

const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0% {
            transform: scale(1);
            opacity: 1;
        }
        50% {
            transform: scale(1.05);
        }
        100% {
            transform: scale(1);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);

console.log('Dashboard script loaded successfully');
