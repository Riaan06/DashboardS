from flask import Flask, render_template, jsonify, request
from PIL import Image
import io
from datetime import datetime
from collections import deque

from crowd_model import CrowdCounter

app = Flask(__name__)

ZONE_LAYOUT = [
    ["A1", "A2", "A3"],
    ["B1", "B2", "B3"],
    ["C1", "C2", "C3"]
]

zone_state = {
    "A1": 0, "A2": 0, "A3": 0,
    "B1": 0, "B2": 0, "B3": 0,
    "C1": 0, "C2": 0, "C3": 0
}

alerts_state = []
trend_history = deque(maxlen=30)

# keep this as stub for now, or later replace with real model
crowd_counter = CrowdCounter(model_type="stub")


def current_time_str():
    return datetime.now().strftime("%H:%M:%S")


def split_image_into_9(image: Image.Image):
    width, height = image.size
    tile_width = width // 3
    tile_height = height // 3

    tiles = {}

    for row in range(3):
        for col in range(3):
            x1 = col * tile_width
            y1 = row * tile_height
            x2 = (col + 1) * tile_width if col < 2 else width
            y2 = (row + 1) * tile_height if row < 2 else height

            zone_id = ZONE_LAYOUT[row][col]
            tile = image.crop((x1, y1, x2, y2))
            tiles[zone_id] = tile

    return tiles


def build_alerts_from_zones(zones_dict):
    alerts = []

    for zone_id, count in zones_dict.items():
        if count > 80:
            alerts.append({
                "severity": "high",
                "message": f"Critical crowd density in zone {zone_id}: {count} people"
            })
        elif count > 40:
            alerts.append({
                "severity": "medium",
                "message": f"High crowd density in zone {zone_id}: {count} people"
            })
        elif count > 10:
            alerts.append({
                "severity": "low",
                "message": f"Moderate crowd activity in zone {zone_id}: {count} people"
            })

    if not alerts:
        alerts.append({
            "severity": "info",
            "message": "All zones are operating within normal crowd levels"
        })

    return alerts


def update_trend(total_count):
    trend_history.append({
        "timestamp": current_time_str(),
        "count": total_count
    })


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/zones")
def api_zones():
    total = sum(zone_state.values())
    zones = [{"id": zone_id, "count": count} for zone_id, count in zone_state.items()]

    return jsonify({
        "zones": zones,
        "total": total,
        "timestamp": current_time_str()
    })


@app.route("/api/alerts")
def api_alerts():
    return jsonify(alerts_state)


@app.route("/api/trend")
def api_trend():
    return jsonify({
        "timestamps": [item["timestamp"] for item in trend_history],
        "counts": [item["count"] for item in trend_history]
    })


@app.route("/api/people-count-image", methods=["POST"])
def people_count_image():
    global zone_state, alerts_state

    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    uploaded_file = request.files["image"]

    if uploaded_file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    try:
        image_bytes = uploaded_file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        return jsonify({"error": "Invalid image file"}), 400

    tiles = split_image_into_9(image)

    zone_counts = {}
    total_count = 0

    for zone_id, tile in tiles.items():
        result = crowd_counter.predict(tile)
        count = int(round(result["count"]))
        zone_counts[zone_id] = max(0, count)
        total_count += zone_counts[zone_id]

    zone_state = zone_counts
    alerts_state = build_alerts_from_zones(zone_counts)
    update_trend(total_count)

    return jsonify({
        "count": total_count,
        "zone_counts": zone_counts,
        "method": "9-tile-processing",
        "timestamp": current_time_str()
    })


if __name__ == "__main__":
    app.run(debug=True)