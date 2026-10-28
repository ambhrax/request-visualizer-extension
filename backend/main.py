from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import socket
import time
import httpx
from urllib.parse import urlparse

app = FastAPI(title="Internet Request Visualizer API")

# Allow all origins so Chrome Extension, Vite dev server, and local tools can connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {
        "message": "Internet Request Visualizer API is running",
        "endpoints": {
            "/analyze": "Pass ?url=<target_url> to inspect DNS and HTTP latency"
        }
    }

@app.get("/analyze")
def analyze(url: str = Query(..., description="Website domain or full URL")):
    raw_url = url.strip()
    if not raw_url.startswith(("http://", "https://")):
        raw_url = "https://" + raw_url

    parsed = urlparse(raw_url)
    domain = parsed.hostname or raw_url.split("/")[0]

    # DNS Lookup measurement
    dns_start = time.perf_counter()
    try:
        ip = socket.gethostbyname(domain)
    except socket.gaierror as e:
        ip = f"Resolution failed: {e.strerror}"
    dns_time_ms = (time.perf_counter() - dns_start) * 1000

    # HTTP Request measurement
    http_start = time.perf_counter()
    status_code = 0
    status_text = "Unknown"
    response_size = 0
    content_type = "unknown"
    server = "unknown"

    try:
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            response = client.get(raw_url)
            response_time_ms = (time.perf_counter() - http_start) * 1000
            status_code = response.status_code
            status_text = response.reason_phrase
            response_size = len(response.content)
            content_type = response.headers.get("content-type", "unknown")
            server = response.headers.get("server", "unknown")
    except httpx.RequestError as e:
        response_time_ms = (time.perf_counter() - http_start) * 1000
        status_text = f"Connection error: {str(e)}"

    return {
        "domain": domain,
        "ip": ip,
        "dns_time_ms": round(dns_time_ms, 2),
        "status_code": status_code,
        "status_text": status_text,
        "response_time_ms": round(response_time_ms, 2),
        "response_size_bytes": response_size,
        "content_type": content_type,
        "server": server,
        "targetUrl": raw_url,
        "source": "backend"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
