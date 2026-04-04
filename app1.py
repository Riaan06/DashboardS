from flask import Flask, render_template, jsonify, request
from datetime import datetime, timedelta
import random
from collections import deque
import base64
import json
import os
from urllib import request as urlrequest
from urllib.error import URLError, HTTPError

app = Flask(__name__)

EXTERNAL_PEOPLE_COUNT_API = os.getenv("EXTERNAL_PEOPLE_COUNT_API", "")

# Global trend history - maintains rolling window of data points
trend_history = deque(maxlen=30)  # 30 points = 5 minutes at 10-second intervals
last_trend_update = None

# Mock data - simulating external AI API responses
def get_zones_data():
    """Simulate external AI API - Zone people counts"""
    zones = {
        "zones": [
            {"id": "A1", "count": random.randint(0, 20)},
            {"id": "A2", "count": random.randint(0, 25)},
            {"id": "A3", "count": random.randint(0, 30)},
            {"id": "B1", "count": random.randint(0, 15)},
            {"id": "B2", "count": random.randint(0, 35)},
            {"id": "B3", "count": random.randint(0, 20)},
            {"id": "C1", "count": random.randint(0, 10)},
            {"id": "C2", "count": random.randint(0, 40)},
            {"id": "C3", "count": random.randint(0, 50)},
        ],
        "timestamp": datetime.now().isoformat()
    }
    zones["total"] = sum(zone["count"] for zone in zones["zones"])
    return zones


def get_alerts_data():
    """Simulate external AI API - Alerts"""
    alert_messages = [
        {"message": "Block C3 over threshold", "severity": "high"},
        {"message": "Zone intrusion at VIP area", "severity": "high"},
        {"message": "Unusual crowd gathering at B2", "severity": "medium"},
        {"message": "Multiple alerts at entrance A1", "severity": "medium"},
        {"message": "Zone A3 monitoring active", "severity": "low"},
    ]
    
    # Randomly select alerts
    selected_alerts = random.sample(alert_messages, k=random.randint(1, 3))
    return selected_alerts


def get_trend_data():
    """Simulate external AI API - Trend data (last 5 minutes with proper history)"""
    global trend_history, last_trend_update
    
    now = datetime.now()
    
    # Add new data point every 1 second (exponential moving average for smoothness)
    if last_trend_update is None:
        # Initialize with baseline data
        for i in range(30):
            count = 50 + random.randint(-10, 20)
            trend_history.append(count)
        last_trend_update = now
    else:
        # Add new data point based on previous value (creates coherent trend)
        last_value = trend_history[-1] if trend_history else 50
        # Smooth random walk - new value close to previous
        change = random.randint(-5, 8)
        new_count = max(10, min(150, last_value + change))
        trend_history.append(new_count)
        last_trend_update = now
    
    # Generate timestamps for all points in history
    timestamps = []
    counts = list(trend_history)
    
    for i in range(len(trend_history)):
        time = now - timedelta(seconds=(len(trend_history) - i - 1) * 1)
        timestamps.append(time.strftime("%H:%M:%S"))
    
    return {
        "timestamps": timestamps,
        "counts": counts,
        "timestamp": datetime.now().isoformat()
    }


def call_external_people_count_api(image_bytes, filename, content_type):
    """Send uploaded image to external AI API for people counting."""
    if not EXTERNAL_PEOPLE_COUNT_API:
        return None, "External people-count API is not configured. Set EXTERNAL_PEOPLE_COUNT_API."

    payload = {
        "filename": filename,
        "content_type": content_type,
        "image_base64": base64.b64encode(image_bytes).decode("utf-8"),
    }

    req = urlrequest.Request(
        EXTERNAL_PEOPLE_COUNT_API,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urlrequest.urlopen(req, timeout=20) as response:
            raw = response.read().decode("utf-8")
            parsed = json.loads(raw)
            return parsed, None
    except HTTPError as exc:
        return None, f"External API HTTP error: {exc.code}"
    except URLError as exc:
        return None, f"External API connection error: {exc.reason}"
    except json.JSONDecodeError:
        return None, "External API returned invalid JSON."


# Routes
@app.route('/')
def index():
    """Serve the dashboard"""
    return render_template('index.html')


@app.route('/api/zones')
def api_zones():
    """API endpoint - Zone data proxy"""
    return jsonify(get_zones_data())


@app.route('/api/alerts')
def api_alerts():
    """API endpoint - Alerts data proxy"""
    return jsonify(get_alerts_data())


@app.route('/api/trend')
def api_trend():
    """API endpoint - Trend data proxy"""
    return jsonify(get_trend_data())


@app.route('/api/status')
def api_status():
    """API endpoint - Overall system status"""
    zones = get_zones_data()
    return jsonify({
        "status": "active",
        "total_people": zones["total"],
        "zones_monitored": len(zones["zones"]),
        "timestamp": datetime.now().isoformat()
    })


@app.route('/api/people-count-image', methods=['POST'])
def api_people_count_image():
    """Accept image upload, call external API, and return people-count result."""
    if 'image' not in request.files:
        return jsonify({"error": "Missing image file in form-data key 'image'."}), 400

    image_file = request.files['image']
    if not image_file or image_file.filename == '':
        return jsonify({"error": "No image selected."}), 400

    image_bytes = image_file.read()
    if not image_bytes:
        return jsonify({"error": "Uploaded image is empty."}), 400

    external_result, err = call_external_people_count_api(
        image_bytes=image_bytes,
        filename=image_file.filename,
        content_type=image_file.mimetype or 'application/octet-stream',
    )
    if err:
        return jsonify({"error": err}), 502

    people_count = external_result.get("count", external_result.get("people_count"))
    zone_counts = external_result.get("zone_counts")

    return jsonify({
        "count": people_count,
        "zone_counts": zone_counts,
        "raw": external_result,
        "timestamp": datetime.now().isoformat(),
    })


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
