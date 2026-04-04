const CONFIG = {
    UPDATE_INTERVAL: 1000,
    TIME_UPDATE_INTERVAL: 1000,
    ZONE_THRESHOLDS: {
        green: 10,
        yellow: 40
    }
};

console.log("dashboard.js loaded");

let dashboardState = {
    zones: {},
    lastZonesSignature: "",
    alerts: [],
    alertsSignature: "",
    trend: {
        timestamps: [],
        counts: []
    },
    trendSignature: "",
    totalCount: 0,
    trendChart: null,
    lastUpdate: null,
    isUpdating: false
};

const zoneElementCache = {};
const cameraSectorCache = {};

function getCameraSectorCounts() {
    const counts = {};
    const cameraCells = document.querySelectorAll(".grid-cell[data-zone]");

    cameraCells.forEach((cell) => {
        const zoneId = cell.dataset.zone;
        const count = Number.parseInt(cell.dataset.count || "0", 10);
        counts[zoneId] = Number.isNaN(count) ? 0 : count;
    });

    return counts;
}

function applyZoneCountsToCamera(zoneCounts) {
    if (!zoneCounts || typeof zoneCounts !== "object") return;

    Object.entries(zoneCounts).forEach(([zoneId, value]) => {
        if (!cameraSectorCache[zoneId]) {
            cameraSectorCache[zoneId] = document.querySelector(`.grid-cell[data-zone="${zoneId}"]`);
        }

        const cell = cameraSectorCache[zoneId];
        if (!cell) return;

        const count = Number.parseInt(String(value), 10);
        const normalized = Number.isNaN(count) ? 0 : count;

        cell.dataset.count = String(normalized);

        const countElement = cell.querySelector(".camera-zone-count");
        if (countElement) {
            countElement.textContent = String(normalized);
        }

        cell.classList.remove("status-green", "status-yellow", "status-red");
        cell.classList.add(`status-${getZoneStatus(normalized)}`);
    });
}

function formatTime(date = new Date()) {
    return date.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
    });
}

function getZoneStatus(count) {
    if (count < CONFIG.ZONE_THRESHOLDS.green) return "green";
    if (count <= CONFIG.ZONE_THRESHOLDS.yellow) return "yellow";
    return "red";
}

function showLoading(show = true) {
    const indicator = document.getElementById("loading-indicator");
    if (!indicator) return;
    if (show) indicator.classList.add("active");
    else indicator.classList.remove("active");
}

async function fetchAPI(endpoint) {
    try {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error(`Failed to fetch ${endpoint}:`, error);
        return null;
    }
}

async function updateZonesData() {
    const data = await fetchAPI("/api/zones");
    if (!data) return false;

    dashboardState.zones = {};
    data.zones.forEach((zone) => {
        dashboardState.zones[zone.id] = zone.count;
    });
    dashboardState.totalCount = data.total;
    dashboardState.lastUpdate = new Date();

    return true;
}

async function updateAlertsData() {
    const data = await fetchAPI("/api/alerts");
    if (!data) return false;

    dashboardState.alerts = data;
    return true;
}

async function updateTrendData() {
    const data = await fetchAPI("/api/trend");
    if (!data) return false;

    dashboardState.trend.timestamps = data.timestamps;
    dashboardState.trend.counts = data.counts;
    return true;
}

async function updateAllData() {
    if (dashboardState.isUpdating) return false;
    dashboardState.isUpdating = true;

    const results = await Promise.all([
        updateZonesData(),
        updateAlertsData(),
        updateTrendData()
    ]);

    dashboardState.isUpdating = false;
    return results.every(Boolean);
}

function updateAlerts() {
    const container = document.getElementById("alerts-container");
    if (!container) return;

    const signature = JSON.stringify(dashboardState.alerts || []);
    if (signature === dashboardState.alertsSignature) return;
    dashboardState.alertsSignature = signature;

    if (!dashboardState.alerts || dashboardState.alerts.length === 0) {
        container.innerHTML = `<div class="alert-scroll"><div class="alert alert--info">No active alerts</div></div>`;
        return;
    }

    const alertHTML = dashboardState.alerts.map((alert) => {
        const severityClass = `alert--${alert.severity || "info"}`;
        return `<div class="alert ${severityClass}">${alert.message}</div>`;
    }).join("");

    container.innerHTML = `<div class="alert-scroll">${alertHTML}</div>`;
}

function updateCameraSectors() {
    Object.entries(dashboardState.zones).forEach(([zoneId, count]) => {
        if (!cameraSectorCache[zoneId]) {
            cameraSectorCache[zoneId] = document.querySelector(`.grid-cell[data-zone="${zoneId}"]`);
        }

        const cell = cameraSectorCache[zoneId];
        if (!cell) return;

        const previousCount = Number.parseInt(cell.dataset.count || "0", 10);
        if (previousCount === count) return;

        cell.dataset.count = String(count);

        const countElement = cell.querySelector(".camera-zone-count");
        if (countElement) countElement.textContent = String(count);

        cell.classList.remove("status-green", "status-yellow", "status-red");
        cell.classList.add(`status-${getZoneStatus(count)}`);
    });
}

function updateZoneGrid() {
    const zonesFromCamera = getCameraSectorCounts();
    const signature = JSON.stringify(zonesFromCamera || {});
    if (signature === dashboardState.lastZonesSignature) return;

    Object.entries(zonesFromCamera).forEach(([zoneId, count]) => {
        if (!zoneElementCache[zoneId]) {
            zoneElementCache[zoneId] = document.querySelector(`.zone-block[data-zone="${zoneId}"]`);
        }

        const block = zoneElementCache[zoneId];
        if (!block) return;

        const countElement = block.querySelector(".zone-count");
        if (!countElement) return;

        const previousCount = Number.parseInt(countElement.textContent || "0", 10);
        if (previousCount === count) return;

        countElement.textContent = count;
        block.classList.remove("status-green", "status-yellow", "status-red");
        block.classList.add(`status-${getZoneStatus(count)}`);

        countElement.style.animation = "none";
        requestAnimationFrame(() => {
            countElement.style.animation = "pulse 0.35s ease-out";
        });
    });

    dashboardState.lastZonesSignature = signature;
}

function updateZoneTable() {
    const tbody = document.getElementById("zones-table-body");
    if (!tbody) return;

    const zonesFromCamera = getCameraSectorCounts();
    const signature = JSON.stringify(zonesFromCamera || {});
    if (signature === tbody.dataset.signature) return;

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
        .join("");

    tbody.innerHTML = rows;
    tbody.dataset.signature = signature;
}

function updateTotalCount() {
    const totalElement = document.getElementById("total-count");
    const lastUpdateElement = document.getElementById("last-update");
    if (!totalElement || !lastUpdateElement) return;

    const zonesFromCamera = getCameraSectorCounts();
    const derivedTotal = Object.values(zonesFromCamera).reduce((acc, value) => acc + value, 0);

    const currentValue = Number.parseInt(totalElement.textContent || "0", 10);
    if (currentValue !== derivedTotal) {
        totalElement.style.animation = "none";
        setTimeout(() => {
            totalElement.style.animation = "pulse 0.5s ease-out";
        }, 10);
    }

    totalElement.textContent = derivedTotal;
    lastUpdateElement.textContent = `Last updated: ${formatTime()}`;
}

function initTrendChart() {
    const chartCanvas = document.getElementById("trendChart");
    if (!chartCanvas) return;

    const ctx = chartCanvas.getContext("2d");

    dashboardState.trendChart = new Chart(ctx, {
        type: "line",
        data: {
            labels: dashboardState.trend.timestamps,
            datasets: [{
                label: "People Count",
                data: dashboardState.trend.counts,
                borderColor: "#3b82f6",
                backgroundColor: "rgba(59,130,246,0.1)",
                borderWidth: 3,
                fill: true,
                tension: 0.3,
                pointRadius: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 0 },
            plugins: {
                legend: {
                    labels: {
                        color: "#f1f5f9"
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: "#cbd5e1" },
                    grid: { color: "rgba(51,65,85,0.2)" }
                },
                y: {
                    beginAtZero: true,
                    ticks: { color: "#cbd5e1" },
                    grid: { color: "rgba(51,65,85,0.2)" }
                }
            }
        }
    });
}

function updateTrendChart() {
    const signature = `${dashboardState.trend.timestamps.join("|")}::${dashboardState.trend.counts.join("|")}`;
    if (signature === dashboardState.trendSignature) return;

    if (!dashboardState.trendChart) {
        initTrendChart();
        dashboardState.trendSignature = signature;
        return;
    }

    dashboardState.trendChart.data.labels = [...dashboardState.trend.timestamps];
    dashboardState.trendChart.data.datasets[0].data = [...dashboardState.trend.counts];
    dashboardState.trendChart.update("none");

    dashboardState.trendSignature = signature;
}

function updateCurrentTime() {
    const timeElement = document.getElementById("current-time");
    if (timeElement) {
        timeElement.textContent = formatTime();
    }
}

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
    console.log("analyzeUploadedImage called");

    const fileInput = document.getElementById("people-image-input");
    const submitButton = document.getElementById("people-image-submit");
    const resultElement = document.getElementById("people-image-result");

    if (!fileInput || !submitButton || !resultElement) {
        console.error("Image analyzer elements not found");
        return;
    }

    const file = fileInput.files?.[0];
    if (!file) {
        resultElement.textContent = "Please choose an image first.";
        return;
    }

    const formData = new FormData();
    formData.append("image", file);

    submitButton.disabled = true;
    resultElement.textContent = "Analyzing image in 9 pieces...";

    try {
        const response = await fetch("/api/people-count-image", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || "Image analysis failed.");
        }

        resultElement.textContent = `Detected people: ${data.count} | Method: ${data.method}`;

        if (data.zone_counts) {
            applyZoneCountsToCamera(data.zone_counts);
            dashboardState.lastZonesSignature = "";
            updateZoneGrid();
            updateZoneTable();
            updateTotalCount();
        }

        await updateAllData();
        updateUI();
    } catch (error) {
        console.error(error);
        resultElement.textContent = `Error: ${error.message}`;
    } finally {
        submitButton.disabled = false;
    }
}

function initImageAnalyzer() {
    console.log("initImageAnalyzer called");

    const submitButton = document.getElementById("people-image-submit");
    if (!submitButton) {
        console.error("Submit button not found");
        return;
    }

    submitButton.addEventListener("click", analyzeUploadedImage);
    console.log("Click listener attached");
}

let updateInterval = null;
let timeInterval = null;

function startDashboard() {
    if (updateInterval) return;

    showLoading(true);

    updateAllData().then(() => {
        updateUI();
        showLoading(false);
    });

    updateInterval = setInterval(async () => {
        await updateAllData();
        updateUI();
    }, CONFIG.UPDATE_INTERVAL);

    if (!timeInterval) {
        timeInterval = setInterval(updateCurrentTime, CONFIG.TIME_UPDATE_INTERVAL);
    }
}

function stopDashboard() {
    if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
    }

    if (timeInterval) {
        clearInterval(timeInterval);
        timeInterval = null;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    console.log("DOMContentLoaded fired");
    initImageAnalyzer();
    startDashboard();

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) stopDashboard();
        else startDashboard();
    });

    window.addEventListener("beforeunload", () => {
        stopDashboard();
    });
});

const style = document.createElement("style");
style.textContent = `
    @keyframes pulse {
        0% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.05); }
        100% { transform: scale(1); opacity: 1; }
    }
`;
document.head.appendChild(style);