# 🌐 Internet Request Visualizer - Chrome Extension

A Chrome Extension (Manifest V3) that visualizes what happens under the hood when you visit a website. It tracks and visualizes the complete network lifecycle: **DNS Resolution ➔ TCP/TLS Handshake ➔ HTTP Request & Response ➔ Data Transfer**.

---

## ✨ Features

- **🚀 100% Standalone Mode (No Backend Needed)**:
  Uses DNS-over-HTTPS (DoH via Google Public DNS and Cloudflare) and the browser's native network engine directly inside the extension.
- **⚡ Active Tab Quick Inspection**:
  Instantly inspects the website you are currently viewing using the browser's native `PerformanceNavigationTiming` API.
- **🔍 Any URL Analyzer**:
  Type any domain (e.g. `github.com`, `google.com`, `wikipedia.org`) to inspect its DNS record, IP, response latency, and transfer size.
- **📊 Interactive Waterfall Bar**:
  Visual breakdown showing the percentage of time spent in DNS lookup vs Connection & TLS vs Server Response / TTFB.
- **⚙️ Optional Local Backend Mode**:
  Toggle connection to your Python FastAPI backend (`http://127.0.0.1:8000`) whenever you want to test server-side resolution.
- **📋 Developer Tools**:
  One-click **Copy JSON** for exporting network telemetry, and **Full Tab** view for a larger dashboard experience.

---

## 📁 Project Structure

```
request-visualizer-extension/
├── extension/                       <-- 🌟 LOAD THIS IN CHROME
│   ├── manifest.json                <-- Manifest V3 configuration
│   ├── background.js                <-- Service worker (DoH, network fetch, tab scripting)
│   ├── popup/
│   │   ├── popup.html               <-- Extension UI layout
│   │   ├── popup.css                <-- Modern dark-mode styling & animations
│   │   └── popup.js                 <-- Interactive logic & metrics calculation
│   └── icons/                       <-- 16x16, 48x48, 128x128 icons
├── backend/                         <-- Enhanced Python FastAPI backend
│   ├── main.py                      <-- FastAPI server with CORS enabled for extension
│   └── requirements.txt
├── original-source/                 <-- Preserved original React + Vite project
│   ├── Frontend/
│   └── Backend/
└── README.md
```

---

## 🚀 Quick Start: How to Install in Google Chrome

Follow these simple steps to load the extension:

1. **Open Chrome Extensions Page**:
   - Open Google Chrome.
   - In the address bar, type `chrome://extensions/` and press **Enter**.

2. **Enable Developer Mode**:
   - In the top-right corner of the Extensions page, toggle the **Developer mode** switch **ON**.

3. **Load Unpacked**:
   - Click the **"Load unpacked"** button in the top-left toolbar.
   - In the file picker, select the `extension` folder located at:
     ```
     /Users/ambhrax/.gemini/antigravity/scratch/request-visualizer-extension/extension
     ```

4. **Pin and Use**:
   - Click the puzzle icon (🧩) in Chrome's top-right toolbar.
   - Click the pin icon next to **Internet Request Visualizer**.
   - Click the extension icon on any page to open the visualizer!

---

## 🛠️ Usage Modes

### 1. Standalone Mode (Default & Recommended)
- No terminal or backend required!
- Resolves DNS using standard DNS-over-HTTPS (`dns.google` / `cloudflare-dns.com`).
- Measures HTTP status codes, latency, transfer bytes, and server headers.

### 2. Inspect Active Tab
- Open any tab (e.g. `https://github.com`).
- Click the extension icon.
- Click **"Inspect Page"** in the active tab banner.
- It pulls real millisecond timings from Chrome's Performance Navigation Timing API (`domainLookup`, `connectEnd`, `responseStart`, `responseEnd`).

### 3. Optional: Local Python FastAPI Backend
If you want to use the Python backend:
1. Open a terminal and navigate to the backend directory:
   ```bash
   cd /Users/ambhrax/.gemini/antigravity/scratch/request-visualizer-extension/backend
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8000
   ```
2. Open the extension popup, click the ⚙️ **Settings** icon in the header, and select **"Local Python Backend"**.
