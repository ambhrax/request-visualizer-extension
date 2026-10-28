from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socket
import time
import httpx

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {
        "message": "Internet Request Visualizer API"
    }


@app.get("/analyze")
def analyze(url: str):

    domain = (
        url.replace("https://", "")
        .replace("http://", "")
        .split("/")[0]
    )

    start = time.perf_counter()

    ip = socket.gethostbyname(domain)

    dns_time = (time.perf_counter() - start) * 1000


    if not url.startswith(("http://", "https://")):
        url = "https://" + url

    start = time.perf_counter()

    response = httpx.get(
        url,
        timeout=10,
        follow_redirects=True
    )

    response_time = (time.perf_counter() - start) * 1000

    return {
        "domain": domain,
        "ip": ip,
        "dns_time_ms": round(dns_time, 2),
        "status_code": response.status_code,
        "response_time_ms": round(response_time, 2),
        "response_size_bytes": len(response.content)
    }