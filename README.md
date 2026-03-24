# 🚨 Surveillance Dashboard

A real-time surveillance dashboard web application built with Flask and modern frontend technologies. The dashboard consumes data from external AI APIs and displays it in an interactive, responsive UI.

## 🎯 Features

- **Real-time Dashboard**: Updates every 1 second with live data from external APIs
- **Live Camera Feed**: Display camera feeds with a 3×3 grid overlay labeled with zone identifiers
- **Zone Visualization**: Interactive grid showing people count in each zone (A1-C3)
- **Zone Table**: Detailed table with zone IDs, people counts, and status indicators
- **Alerts System**: Scrolling alerts bar with color-coded severity levels
- **Trend Analysis**: Line chart showing people count trends over the last 5 minutes
- **Dark Theme UI**: Modern, responsive design with smooth animations
- **Status Indicators**: Color-coded zones (Green < 10, Yellow 10-40, Red > 40)

## 🏗️ Project Structure

```
DashboardS/
├── app.py                 # Flask backend server
├── requirements.txt       # Python dependencies
├── templates/
│   └── index.html        # Main dashboard HTML
└── static/
    ├── css/
    │   └── style.css     # Dashboard styling
    └── js/
        └── dashboard.js  # JavaScript logic
```

## 🚀 Getting Started

### Prerequisites

- Python 3.8+
- pip (Python package manager)

### Installation

1. **Clone or navigate to the project directory:**
   ```bash
   cd DashboardS
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run the Flask application:**
   ```bash
   python app.py
   ```

4. **Open your browser:**
   Navigate to `http://localhost:5000`

## 📡 API Endpoints

The backend provides the following API endpoints that proxy data from external AI systems:

### `/api/zones`
Returns zone-wise people counts
```json
{
  "zones": [
    {"id": "A1", "count": 5},
    {"id": "A2", "count": 18},
    ...
  ],
  "total": 95,
  "timestamp": "2024-03-23T10:30:45.123456"
}
```

### `/api/alerts`
Returns current alerts with severity levels
```json
[
  {"message": "Block C3 over threshold", "severity": "high"},
  {"message": "Zone intrusion at VIP", "severity": "medium"}
]
```

### `/api/trend`
Returns trend data (last 5 minutes of people counts)
```json
{
  "timestamps": ["12:00", "12:01", "12:02"],
  "counts": [50, 70, 95],
  "timestamp": "2024-03-23T10:30:45.123456"
}
```

### `/api/status`
Returns overall system status
```json
{
  "status": "active",
  "total_people": 95,
  "zones_monitored": 9,
  "timestamp": "2024-03-23T10:30:45.123456"
}
```

## 🎨 UI Components

### Header Section
- Logo with dashboard title and status indicator
- Real-time clock
- Scrolling alerts bar with color-coded severity

### Main Dashboard

#### Top Section
- **Live Camera Feed**: Display area with 3×3 grid overlay
- **Zone Distribution**: Visual grid showing current counts and status

#### Middle Section
- **Total Count Card**: Prominent display of total people detected
- **Zone Details Table**: Detailed breakdown with status indicators

#### Bottom Section
- **Trend Chart**: Line chart using Chart.js showing 5-minute trend

## 🔄 Real-time Updates

The dashboard automatically:
- Fetches data every 1 second
- Updates all UI elements without page reload
- Maintains smooth animations and transitions
- Updates the trend chart with new data points
- Refreshes alerts in real-time

## 🎯 Zone Status Logic

| Range | Color  | Display |
|-------|--------|---------|
| < 10  | Green  | Safe    |
| 10-40 | Yellow | Caution |
| > 40  | Red    | Alert   |

## 📊 Alert Severity Levels

- **High** (🔴 Red): Critical alerts requiring immediate attention
- **Medium** (🟡 Yellow): Warning alerts to monitor
- **Low** (🔵 Blue): Informational alerts

## 🔧 Configuration

Edit the `CONFIG` object in `static/js/dashboard.js` to customize:

```javascript
const CONFIG = {
    UPDATE_INTERVAL: 1000,     // Data fetch interval (ms)
    API_TIMEOUT: 5000,          // API call timeout (ms)
    CHART_MAX_POINTS: 30,       // Maximum chart data points
    ZONE_THRESHOLDS: {
        green: 10,              // Green threshold
        yellow: 40              // Yellow threshold
    }
};
```

## 🌐 Responsive Design

The dashboard is fully responsive and works on:
- Desktop (1920px+)
- Tablet (1400px)
- Mobile (600px and below)

## 🚫 Important Notes

- This dashboard consumes data from external AI detection systems
- It does NOT perform any AI detection itself
- All data processing is done by external APIs
- The application focuses solely on visualization and real-time updates

## 🔌 Integration with External AI APIs

To connect your external AI system:

1. Update the API endpoints in `app.py` to fetch from your AI system
2. Modify the data transformation logic to match your API responses
3. Ensure your external APIs return data in the expected format

## 📦 Dependencies

- **Flask 3.1.3**: Web framework for Python
- **Chart.js**: JavaScript charting library (CDN)

## 🎓 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 📝 License

This project is provided as-is for surveillance and monitoring purposes.

## 🤝 Support

For issues or questions, ensure:
1. Flask is running on port 5000
2. All required files are in the correct directories
3. Browser console shows no JavaScript errors
4. Network tab shows successful API responses

---

**Last Updated**: March 23, 2024
