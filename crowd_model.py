from PIL import Image
import numpy as np

try:
    import cv2
except ImportError:
    cv2 = None


class CrowdCounter:
    def __init__(self, model_type="stub"):
        self.model_type = model_type

    def predict(self, pil_image: Image.Image):
        if self.model_type == "stub":
            return self._predict_stub(pil_image)
        raise ValueError(f"Unsupported model_type: {self.model_type}")

    def _predict_stub(self, pil_image: Image.Image):
        """
        Heuristic estimate for demo/testing.
        Not a real crowd model.
        Works a bit better on smaller tiles than full large images.
        """
        gray = np.array(pil_image.convert("L")).astype(np.float32)

        h, w = gray.shape
        area = h * w

        gx = np.abs(np.diff(gray, axis=1))
        gy = np.abs(np.diff(gray, axis=0))

        edge_strength = (gx.mean() + gy.mean()) / 2.0
        texture = gray.std()
        contrast = gray.max() - gray.min()

        score = (0.5 * edge_strength) + (0.3 * texture) + (0.2 * contrast)

        # tuned for tile-based processing
        estimated_count = int(max(0, round((score * area) / 180000.0)))

        return {
            "count": estimated_count,
            "method": "stub"
        }