# SmartPark AI 🚗

A smart parking discovery and booking system designed for Indian urban areas, featuring real-time availability, simulated AI fallback recommendations, and a camera-based space analyzer.

## 🌟 Features

- **GPS Lot Discovery:** Find designated parking lots near your location.
- **Instant Booking:** Visual slot booking with auto-generated QR code tickets.
- **Vehicle Matcher:** Select your vehicle (e.g., Alto, Nexon, Activa) to find appropriately sized parking spaces.
- **AI Fallback Finder:** When lots are full, use Gemini AI to find safe on-street alternatives based on your vehicle's dimensions.
- **AI Camera Scanner:** Point your phone camera at a roadside area to get instant AI analysis on parking safety and legality.

## 🚀 Tech Stack

- **Frontend:** Vanilla JS, HTML5, CSS3, Leaflet.js
- **Backend:** Node.js (Custom dependency-free HTTP framework)
- **Database:** SQLite (Node.js 22.5+ built-in `node:sqlite`)
- **AI:** Google Gemini 2.0 Flash

## ⚙️ Setup Instructions

### Prerequisites
- Node.js version 22.5.0 or higher (required for native SQLite support)
- A Google Gemini API Key

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/prathmeshbahtt44-wq/smart-parking.git
   cd smart-parking
   ```

2. **Configure API Key:**
   Open `frontend/js/api.js` and replace the placeholder API key with your actual Gemini API key:
   ```javascript
   const GEMINI_API_KEY = "YOUR-GEMINI-API-KEY-HERE";
   ```

3. **Start the Server:**
   No `npm install` needed! Just run:
   ```bash
   node --experimental-sqlite backend/server.js
   ```

4. **Open in Browser:**
   Navigate to `http://localhost:3000`

## 👥 Authors
- Prathmesh Bhatt & Krish Menaria (JECRC University)
