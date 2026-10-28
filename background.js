/**
 * Internet Request Visualizer - Background Service Worker (Manifest V3)
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log("Internet Request Visualizer extension installed successfully.");
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "ANALYZE_URL") {
    handleAnalyzeUrl(message)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep message channel open for async response
  }

  if (message.type === "INSPECT_ACTIVE_TAB") {
    handleInspectActiveTab(message)
      .then(result => sendResponse({ success: true, data: result }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }
});

/**
 * Handle URL analysis in Standalone or Backend mode
 */
async function handleAnalyzeUrl({ url, mode, backendUrl }) {
  let targetUrl = url.trim();
  if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
    targetUrl = "https://" + targetUrl;
  }

  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (e) {
    throw new Error(`Invalid URL format: "${url}"`);
  }

  const domain = parsed.hostname;

  // Mode: Local Backend (FastAPI)
  if (mode === "backend") {
    const base = backendUrl || "http://127.0.0.1:8000";
    const endpoint = `${base.replace(/\/+$/, "")}/analyze?url=${encodeURIComponent(targetUrl)}`;
    try {
      const response = await fetch(endpoint, { method: "GET" });
      if (!response.ok) {
        throw new Error(`Backend returned HTTP ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      return {
        ...data,
        source: "backend",
        targetUrl
      };
    } catch (err) {
      throw new Error(`Cannot connect to local backend at ${base}. Please ensure uvicorn is running, or switch to Standalone Mode.`);
    }
  }

  // Mode: Standalone (Browser + DNS-over-HTTPS)
  // Step 1: DNS Lookup via DoH
  const dnsResult = await resolveDns(domain);

  // Step 2: HTTP Request & Response Measurement
  const httpResult = await measureHttpRequest(targetUrl);

  return {
    domain,
    ip: dnsResult.ip,
    dns_time_ms: dnsResult.dnsTimeMs,
    dns_provider: dnsResult.provider,
    dns_records: dnsResult.records,
    status_code: httpResult.statusCode,
    status_text: httpResult.statusText,
    response_time_ms: httpResult.responseTimeMs,
    response_size_bytes: httpResult.sizeBytes,
    content_type: httpResult.contentType,
    server: httpResult.server,
    protocol: parsed.protocol.replace(":", "").toUpperCase(),
    final_url: httpResult.finalUrl,
    targetUrl,
    source: "standalone"
  };
}

/**
 * Resolve DNS using Google DNS-over-HTTPS with Cloudflare DoH fallback
 */
async function resolveDns(domain) {
  const start = performance.now();
  let ip = "N/A";
  let provider = "Google DoH";
  let records = [];

  try {
    const googleRes = await fetch(
      `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`,
      { cache: "no-store" }
    );
    if (googleRes.ok) {
      const gData = await googleRes.json();
      if (gData.Answer && gData.Answer.length > 0) {
        const aRecord = gData.Answer.find(r => r.type === 1) || gData.Answer[0];
        ip = aRecord.data;
        records = gData.Answer;
      }
    }
  } catch (err) {
    try {
      provider = "Cloudflare DoH";
      const cfRes = await fetch(
        `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=A`,
        {
          headers: { Accept: "application/dns-json" },
          cache: "no-store"
        }
      );
      if (cfRes.ok) {
        const cfData = await cfRes.json();
        if (cfData.Answer && cfData.Answer.length > 0) {
          const aRecord = cfData.Answer.find(r => r.type === 1) || cfData.Answer[0];
          ip = aRecord.data;
          records = cfData.Answer;
        }
      }
    } catch (cfErr) {
      provider = "Direct / Browser Cache";
      ip = "127.0.0.1 (Lookup failed)";
    }
  }

  const dnsTimeMs = Math.round((performance.now() - start) * 100) / 100;
  return { ip, dnsTimeMs, provider, records };
}

/**
 * Measure HTTP Request timing, status, headers, and payload size
 */
async function measureHttpRequest(url) {
  const start = performance.now();
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-cache"
    });

    const responseTimeMs = Math.round((performance.now() - start) * 100) / 100;
    const contentType = response.headers.get("content-type") || "unknown";
    const server = response.headers.get("server") || "unknown";

    let sizeBytes = 0;
    const headerLen = response.headers.get("content-length");
    if (headerLen && !isNaN(parseInt(headerLen))) {
      sizeBytes = parseInt(headerLen);
    } else {
      try {
        const buffer = await response.arrayBuffer();
        sizeBytes = buffer.byteLength;
      } catch (e) {
        sizeBytes = 0;
      }
    }

    return {
      statusCode: response.status,
      statusText: response.statusText || "OK",
      responseTimeMs,
      sizeBytes,
      contentType,
      server,
      finalUrl: response.url
    };
  } catch (err) {
    const responseTimeMs = Math.round((performance.now() - start) * 100) / 100;
    return {
      statusCode: 0,
      statusText: `Network Error: ${err.message}`,
      responseTimeMs,
      sizeBytes: 0,
      contentType: "N/A",
      server: "N/A",
      finalUrl: url
    };
  }
}

/**
 * Inspect Active Tab using Performance Navigation Timing API
 */
async function handleInspectActiveTab({ tabId, tabUrl }) {
  if (!tabUrl || tabUrl.startsWith("chrome://") || tabUrl.startsWith("edge://") || tabUrl.startsWith("about:")) {
    throw new Error("Cannot inspect internal browser system tabs. Please navigate to a standard website.");
  }

  const parsed = new URL(tabUrl);
  const domain = parsed.hostname;

  let pageNav = null;
  try {
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const nav = performance.getEntriesByType("navigation")[0];
        if (!nav) return null;
        return {
          domainLookupStart: nav.domainLookupStart,
          domainLookupEnd: nav.domainLookupEnd,
          connectStart: nav.connectStart,
          connectEnd: nav.connectEnd,
          secureConnectionStart: nav.secureConnectionStart,
          requestStart: nav.requestStart,
          responseStart: nav.responseStart,
          responseEnd: nav.responseEnd,
          duration: nav.duration,
          transferSize: nav.transferSize,
          encodedBodySize: nav.encodedBodySize,
          decodedBodySize: nav.decodedBodySize,
          protocol: nav.nextHopProtocol
        };
      }
    });

    if (injectionResults && injectionResults[0] && injectionResults[0].result) {
      pageNav = injectionResults[0].result;
    }
  } catch (e) {
    console.warn("Could not execute script on tab:", e);
  }

  const dnsResult = await resolveDns(domain);

  if (pageNav) {
    const dnsTime = Math.max(0, Math.round((pageNav.domainLookupEnd - pageNav.domainLookupStart) * 10) / 10);
    const tcpTime = Math.max(0, Math.round((pageNav.connectEnd - pageNav.connectStart) * 10) / 10);
    const tlsTime = pageNav.secureConnectionStart > 0
      ? Math.max(0, Math.round((pageNav.connectEnd - pageNav.secureConnectionStart) * 10) / 10)
      : 0;
    const ttfb = Math.max(0, Math.round((pageNav.responseStart - pageNav.requestStart) * 10) / 10);
    const downloadTime = Math.max(0, Math.round((pageNav.responseEnd - pageNav.responseStart) * 10) / 10);
    const responseTime = Math.max(1, Math.round(pageNav.duration * 10) / 10);
    const size = pageNav.transferSize || pageNav.encodedBodySize || pageNav.decodedBodySize || 0;

    return {
      domain,
      ip: dnsResult.ip,
      dns_time_ms: dnsTime > 0 ? dnsTime : dnsResult.dnsTimeMs,
      dns_provider: dnsTime > 0 ? "Chrome Performance Cache" : dnsResult.provider,
      tcp_time_ms: tcpTime,
      tls_time_ms: tlsTime,
      ttfb_ms: ttfb,
      download_time_ms: downloadTime,
      status_code: 200,
      status_text: "OK (Active Tab)",
      response_time_ms: responseTime,
      response_size_bytes: size,
      protocol: (pageNav.protocol || "h2/h3").toUpperCase(),
      targetUrl: tabUrl,
      source: "active-tab"
    };
  }

  const httpResult = await measureHttpRequest(tabUrl);
  return {
    domain,
    ip: dnsResult.ip,
    dns_time_ms: dnsResult.dnsTimeMs,
    dns_provider: dnsResult.provider,
    status_code: httpResult.statusCode,
    status_text: httpResult.statusText,
    response_time_ms: httpResult.responseTimeMs,
    response_size_bytes: httpResult.sizeBytes,
    content_type: httpResult.contentType,
    server: httpResult.server,
    protocol: parsed.protocol.replace(":", "").toUpperCase(),
    targetUrl: tabUrl,
    source: "standalone"
  };
}
