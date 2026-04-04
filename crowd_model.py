from ultralytics import YOLO
import cv2
import numpy as np
import base64
from PIL import Image
import io

class CrowdCounter:
    def __init__(self, model_type="yolov8n.pt"):
        # Automatically downloads the nano model (fastest)
        self.model = YOLO(model_type)

    def predict_and_draw(self, pil_image: Image.Image, zone_id: str):
        # Convert PIL to OpenCV format
        opencv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
        
        # Run detection for class 0 (person)
        results = self.model.predict(opencv_image, classes=[0], conf=0.25, verbose=False)
        boxes = results[0].boxes
        count = len(boxes)

        # Draw boxes on the image
        for box in boxes:
            x1, y1, x2, y2 = map(int, box.xyxy[0])
            cv2.rectangle(opencv_image, (x1, y1), (x2, y2), (0, 255, 0), 2)

        # Add Zone Label Overlay
        cv2.putText(opencv_image, f"Zone {zone_id}", (10, 25), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        # Convert back to base64 for the web dashboard
        _, buffer = cv2.imencode('.jpg', opencv_image)
        b64_str = base64.b64encode(buffer).decode('utf-8')
        
        return count, f"data:image/jpeg;base64,{b64_str}"