from flask import Flask, render_template, jsonify, request
from PIL import Image
import io
import base64
import cv2
import numpy as np
from datetime import datetime
from collections import deque
from ultralytics import YOLO

app = Flask(__name__)

# --- CONFIG ---
ZONE_LAYOUT = [["A1", "A2", "A3"], ["B1", "B2", "B3"], ["C1", "C2", "C3"]]
trend_history = deque(maxlen=30)
zone_state = {z: 0 for row in ZONE_LAYOUT for z in row}

# Initialize YOLOv8
model = YOLO("yolov8n.pt") 

def process_tile(pil_tile, zone_id):
    # Convert PIL to OpenCV
    img = cv2.cvtColor(np.array(pil_tile), cv2.COLOR_RGB2BGR)
    results = model.predict(img, classes=[0], conf=0.25, verbose=False)
    
    count = len(results[0].boxes)
    
    # Draw boxes
    for box in results[0].boxes:
        x1, y1, x2, y2 = map(int, box.xyxy[0])
        cv2.rectangle(img, (x1, y1), (x2, y2), (0, 255, 0), 2)
    
    # Encode to Base64
    _, buffer = cv2.imencode('.jpg', img)
    b64_str = base64.b64encode(buffer).decode('utf-8')
    return count, f"data:image/jpeg;base64,{b64_str}"

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/people-count-image", methods=["POST"])
def people_count_image():
    if "image" not in request.files:
        return jsonify({"error": "No image"}), 400
    
    file = request.files["image"]
    img = Image.open(io.BytesIO(file.read())).convert("RGB")
    
    w, h = img.size
    tw, th = w // 3, h // 3
    
    results_counts = {}
    results_visuals = {}
    total = 0

    for r in range(3):
        for c in range(3):
            zone_id = ZONE_LAYOUT[r][c]
            tile = img.crop((c*tw, r*th, (c+1)*tw, (r+1)*th))
            cnt, b64 = process_tile(tile, zone_id)
            results_counts[zone_id] = cnt
            results_visuals[zone_id] = b64
            total += cnt

    trend_history.append({"t": datetime.now().strftime("%H:%M:%S"), "c": total})
    return jsonify({"count": total, "zone_counts": results_counts, "visual_tiles": results_visuals})

# Add missing API routes for the dashboard auto-refresh
@app.route("/api/zones")
def api_zones():
    return jsonify({"zones": [{"id": k, "count": v} for k, v in zone_state.items()], "total": sum(zone_state.values())})

@app.route("/api/trend")
def api_trend():
    return jsonify({"timestamps": [i["t"] for i in trend_history], "counts": [i["c"] for i in trend_history]})

@app.route("/api/alerts")
def api_alerts():
    return jsonify([]) # Stub

if __name__ == "__main__":
    app.run(debug=True)