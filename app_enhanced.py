from flask import Flask, render_template, jsonify, request, send_from_directory
from datetime import datetime, timedelta
import random
from collections import deque
import base64
import json
import os
import cv2
import numpy as np
from PIL import Image
import io

app = Flask(__name__)

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# Global variables
trend_history = deque(maxlen=30)
last_trend_update = None
last_people_count = 0
last_uploaded_image = None
zone_counts_global = {}

# Try to import YOLO - if not available, use fallback
try:
    from ultralytics import YOLO
    model = YOLO('yolov8n.pt')  # Lightweight model for speed
    MODEL_AVAILABLE = True
    print("✅ YOLO model loaded successfully!")
except ImportError:
    MODEL_AVAILABLE = False
    print("⚠️ YOLO not available. Install with: pip install ultralytics")
except Exception as e:
    MODEL_AVAILABLE = False
    print(f"⚠️ Error loading YOLO: {e}")


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def count_people_in_image(image_bytes):
    """
    Count people in uploaded image using YOLO object detection
    Returns: (count, zone_counts, annotated_image_base64)
    """
    if not MODEL_AVAILABLE:
        # Fallback: simple density estimation
        return estimate_people_density(image_bytes)
    
    try:
        # Convert bytes to image
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return 0, {}, None
        
        # Run YOLO detection
        results = model(img, verbose=False)
        
        # Filter for 'person' class (class 0 in COCO)
        people = []
        for result in results:
            boxes = result.boxes
            for box in boxes:
                cls = int(box.cls[0])
                conf = float(box.conf[0])
                if cls == 0 and conf > 0.25:  # class 0 = person, confidence > 25%
                    people.append({
                        'bbox': box.xyxy[0].cpu().numpy().tolist(),
                        'confidence': conf
                    })
        
        total_count = len(people)
        
        # Divide image into 3x3 zones for zone-wise counting
        h, w = img.shape[:2]
        zone_counts = divide_into_zones(people, w, h)
        
        # Annotate image with detections
        annotated_img = img.copy()
        for person in people:
            bbox = person['bbox']
            x1, y1, x2, y2 = map(int, bbox)
            cv2.rectangle(annotated_img, (x1, y1), (x2, y2), (0, 255, 0), 2)
            cv2.putText(annotated_img, f"{person['confidence']:.2f}", 
                       (x1, y1-10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
        
        # Draw zone grid
        for i in range(1, 3):
            cv2.line(annotated_img, (w//3 * i, 0), (w//3 * i, h), (255, 255, 0), 2)
            cv2.line(annotated_img, (0, h//3 * i), (w, h//3 * i), (255, 255, 0), 2)
        
        # Add zone labels
        zones = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3']
        for idx, zone in enumerate(zones):
            row = idx // 3
            col = idx % 3
            x = col * w // 3 + 10
            y = row * h // 3 + 30
            cv2.putText(annotated_img, f"{zone}: {zone_counts.get(zone, 0)}", 
                       (x, y), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 255), 2)
        
        # Convert to base64
        _, buffer = cv2.imencode('.jpg', annotated_img)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return total_count, zone_counts, img_base64
        
    except Exception as e:
        print(f"Error in count_people_in_image: {e}")
        return 0, {}, None


def divide_into_zones(people, width, height):
    """Divide detections into 3x3 zones (A1-C3)"""
    zones = {
        'A1': 0, 'A2': 0, 'A3': 0,
        'B1': 0, 'B2': 0, 'B3': 0,
        'C1': 0, 'C2': 0, 'C3': 0
    }
    
    for person in people:
        bbox = person['bbox']
        center_x = (bbox[0] + bbox[2]) / 2
        center_y = (bbox[1] + bbox[3]) / 2
        
        # Determine zone
        col = int(center_x / (width / 3))
        row = int(center_y / (height / 3))
        
        col = min(col, 2)
        row = min(row, 2)
        
        zone_name = f"{chr(65 + row)}{col + 1}"  # A1, A2, etc.
        zones[zone_name] += 1
    
    return zones


def estimate_people_density(image_bytes):
    """Fallback method: density-based estimation if YOLO not available"""
    try:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None:
            return 0, {}, None
        
        h, w = img.shape[:2]
        
        # Simple density estimation based on color patterns
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        
        # Count edge density as proxy for crowd density
        edge_density = np.sum(edges > 0) / (w * h)
        estimated_count = int(edge_density * w * h / 500)  # Rough calibration
        
        # Divide into zones
        zone_counts = {}
        zones = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3', 'C1', 'C2', 'C3']
        for zone in zones:
            zone_counts[zone] = random.randint(max(0, estimated_count//9 - 5), 
                                              max(1, estimated_count//9 + 5))
        
        # Annotate image
        annotated_img = img.copy()
        for i in range(1, 3):
            cv2.line(annotated_img, (w//3 * i, 0), (w//3 * i, h), (255, 255, 0), 2)
            cv2.line(annotated_img, (0, h//3 * i), (w, h//3 * i), (255, 255, 0), 2)
        
        cv2.putText(annotated_img, f"Estimated: {estimated_count} people", 
                   (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
        
        _, buffer = cv2.imencode('.jpg', annotated_img)
        img_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return estimated_count, zone_counts, img_base64
        
    except Exception as e:
        print(f"Error in estimate_people_density: {e}")
        return 0, {}, None


def get_zones_data():
    """Return zone data - use real data if available, otherwise mock"""
    global zone_counts_global
    
    if zone_counts_global:
        zones = []
        for zone_id, count in zone_counts_global.items():
            zones.append({"id": zone_id, "count": count})
        total = sum(zone_counts_global.values())
    else:
        # Mock data
        zones = [
            {"id": "A1", "count": random.randint(0, 20)},
            {"id": "A2", "count": random.randint(0, 25)},
            {"id": "A3", "count": random.randint(0, 30)},
            {"id": "B1", "count": random.randint(0, 15)},
            {"id": "B2", "count": random.randint(0, 35)},
            {"id": "B3", "count": random.randint(0, 20)},
            {"id": "C1", "count": random.randint(0, 10)},
            {"id": "C2", "count": random.randint(0, 40)},
            {"id": "C3", "count": random.randint(0, 50)},
        ]
        total = sum(zone["count"] for zone in zones)
    
    return {
        "zones": zones,
        "total": total,
        "timestamp": datetime.now().isoformat()
    }


def get_alerts_data():
    """Simulate external AI API - Alerts"""
    alert_messages = [
        {"message": "Block C3 over threshold", "severity": "high"},
        {"message": "Zone intrusion at VIP area", "severity": "high"},
        {"message": "Unusual crowd gathering at B2", "severity": "medium"},
        {"message": "Multiple alerts at entrance A1", "severity": "medium"},
        {"message": "Zone A3 monitoring active", "severity": "low"},
    ]
    
    selected_alerts = random.sample(alert_messages, k=random.randint(1, 3))
    return selected_alerts


def get_trend_data():
    """Trend data with real counts if available"""
    global trend_history, last_trend_update, last_people_count
    
    now = datetime.now()
    
    if last_trend_update is None:
        for i in range(30):
            count = 50 + random.randint(-10, 20)
            trend_history.append(count)
        last_trend_update = now
    else:
        if last_people_count > 0:
            # Use real count
            trend_history.append(last_people_count)
        else:
            # Use smooth random walk
            last_value = trend_history[-1] if trend_history else 50
            change = random.randint(-5, 8)
            new_count = max(10, min(150, last_value + change))
            trend_history.append(new_count)
        last_trend_update = now
    
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


# Routes
@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/zones')
def api_zones():
    return jsonify(get_zones_data())


@app.route('/api/alerts')
def api_alerts():
    return jsonify(get_alerts_data())


@app.route('/api/trend')
def api_trend():
    return jsonify(get_trend_data())


@app.route('/api/status')
def api_status():
    zones = get_zones_data()
    return jsonify({
        "status": "active",
        "total_people": zones["total"],
        "zones_monitored": len(zones["zones"]),
        "model_available": MODEL_AVAILABLE,
        "timestamp": datetime.now().isoformat()
    })


@app.route('/api/people-count-image', methods=['POST'])
def api_people_count_image():
    """Accept image upload and return people count with annotated image"""
    global last_people_count, last_uploaded_image, zone_counts_global
    
    if 'image' not in request.files:
        return jsonify({"error": "Missing image file in form-data key 'image'."}), 400

    image_file = request.files['image']
    if not image_file or image_file.filename == '':
        return jsonify({"error": "No image selected."}), 400
    
    if not allowed_file(image_file.filename):
        return jsonify({"error": "Invalid file type. Allowed: png, jpg, jpeg, gif, webp"}), 400

    try:
        image_bytes = image_file.read()
        if not image_bytes:
            return jsonify({"error": "Uploaded image is empty."}), 400

        # Count people in image
        count, zone_counts, annotated_base64 = count_people_in_image(image_bytes)
        
        # Update global state
        last_people_count = count
        zone_counts_global = zone_counts
        last_uploaded_image = annotated_base64
        
        return jsonify({
            "count": count,
            "zone_counts": zone_counts,
            "annotated_image": f"data:image/jpeg;base64,{annotated_base64}" if annotated_base64 else None,
            "method": "YOLO Detection" if MODEL_AVAILABLE else "Density Estimation",
            "timestamp": datetime.now().isoformat(),
            "success": True
        })
        
    except Exception as e:
        print(f"Error processing image: {e}")
        return jsonify({"error": f"Failed to process image: {str(e)}"}), 500


@app.route('/api/last-image')
def api_last_image():
    """Get the last uploaded annotated image"""
    global last_uploaded_image, last_people_count
    
    if last_uploaded_image:
        return jsonify({
            "image": f"data:image/jpeg;base64,{last_uploaded_image}",
            "count": last_people_count,
            "timestamp": datetime.now().isoformat()
        })
    else:
        return jsonify({"image": None, "count": 0})


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
