// ... existing dashboard code ...

function applyZoneCountsToCamera(zoneCounts, visualTiles) {
    if (!zoneCounts) return;
    const visuals = visualTiles || {};

    Object.entries(zoneCounts).forEach(([zoneId, count]) => {
        const cell = document.querySelector(`.grid-cell[data-zone="${zoneId}"]`);
        if (!cell) return;

        // Update Text
        const countEl = cell.querySelector(".camera-zone-count");
        if (countEl) countEl.textContent = count;
        
        // Update Status Color
        cell.className = `grid-cell status-${getZoneStatus(count)}`;

        // Update Visual Image
        if (visuals[zoneId]) {
            let img = cell.querySelector(".ai-processed-image");
            if (!img) {
                img = document.createElement("img");
                img.className = "ai-processed-image";
                cell.appendChild(img);
            }
            img.src = visuals[zoneId];
            img.style.opacity = "1";
        }
    });
}

// Update the analyzer click event
async function analyzeUploadedImage() {
    console.log("Upload started..."); // Check if button click works

    const fileInput = document.getElementById("people-image-input");
    const resultElement = document.getElementById("people-image-result");
    const submitButton = document.getElementById("people-image-submit");

    if (!fileInput.files[0]) {
        alert("Please select an image file first!");
        return;
    }

    // Visual feedback
    submitButton.disabled = true;
    resultElement.textContent = "Processing AI tiles... please wait.";

    const formData = new FormData();
    formData.append("image", fileInput.files[0]);

    try {
        const response = await fetch("/api/people-count-image", {
            method: "POST",
            body: formData
        });

        if (!response.ok) throw new Error("Server error: " + response.status);

        const data = await response.json();
        console.log("AI Response received:", data);

        // This sends the 9 images to your grid
        if (data.zone_counts && data.visual_tiles) {
            applyZoneCountsToCamera(data.zone_counts, data.visual_tiles);
            resultElement.textContent = `Success! Detected ${data.count} people.`;
        }

    } catch (error) {
        console.error("Upload failed:", error);
        resultElement.textContent = "Error: " + error.message;
    } finally {
        submitButton.disabled = false;
    }
}

// Ensure this is called inside your DOMContentLoaded listener
function initImageAnalyzer() {
    const btn = document.getElementById("people-image-submit");
    if (btn) {
        btn.onclick = analyzeUploadedImage;
        console.log("Button listener attached!");
    }
}
// ... keep your existing CONFIG and dashboardState ...

function applyZoneCountsToCamera(zoneCounts, visualTiles) {
    if (!zoneCounts) return;
    const visuals = visualTiles || {};

    Object.entries(zoneCounts).forEach(([zoneId, count]) => {
        const cell = document.querySelector(`.grid-cell[data-zone="${zoneId}"]`);
        if (!cell) return;

        // 1. Update text count
        const countEl = cell.querySelector(".camera-zone-count");
        if (countEl) countEl.textContent = count;

        // 2. Update Image
        if (visuals[zoneId]) {
            let img = cell.querySelector(".ai-processed-img");
            if (!img) {
                img = document.createElement("img");
                img.className = "ai-processed-img";
                cell.appendChild(img);
            }
            img.src = visuals[zoneId];
            img.style.opacity = "1";
        }
    });
}

async function analyzeUploadedImage() {
    const fileInput = document.getElementById("people-image-input");
    const resultElement = document.getElementById("people-image-result");
    
    if (!fileInput.files[0]) return;

    const formData = new FormData();
    formData.append("image", fileInput.files[0]);
    
    resultElement.textContent = "AI Processing...";

    try {
        const response = await fetch("/api/people-count-image", {
            method: "POST",
            body: formData
        });
        const data = await response.json();
        
        applyZoneCountsToCamera(data.zone_counts, data.visual_tiles);
        resultElement.textContent = `Detected: ${data.count}`;
        updateTotalCount(); // Update the big number
    } catch (e) {
        resultElement.textContent = "Error uploading.";
    }
}

// Ensure button listener is active
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("people-image-submit").addEventListener("click", analyzeUploadedImage);
});