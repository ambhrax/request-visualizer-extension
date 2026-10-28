/**
 * Internet Request Visualizer - Popup Controller
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Elements
  const urlInput = document.getElementById("urlInput");
  const btnAnalyze = document.getElementById("btnAnalyze");
  const chips = document.querySelectorAll(".chip");

  const activeTabBanner = document.getElementById("activeTabBanner");
  const activeTabHost = document.getElementById("activeTabHost");
  const btnInspectTab = document.getElementById("btnInspectTab");

  const btnSettings = document.getElementById("btnSettings");
  const settingsDrawer = document.getElementById("settingsDrawer");
  const radioStandalone = document.getElementById("radioStandalone");
  const radioBackend = document.getElementById("radioBackend");
  const backendConfig = document.getElementById("backendConfig");
  const backendUrlInput = document.getElementById("backendUrlInput");

  const errorBox = document.getElementById("errorBox");
  const errorMessage = document.getElementById("errorMessage");
  const loadingBox = document.getElementById("loadingBox");
  const flowContainer = document.getElementById("flowContainer");

  const btnCopyJson = document.getElementById("btnCopyJson");
  const btnOpenFull = document.getElementById("btnOpenFull");

  // State
  let currentActiveTab = null;
  let lastAnalysisData = null;
  let executionMode = "standalone";

  // Load saved preferences
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["executionMode", "backendUrl"], (res) => {
      if (res.executionMode) {
        executionMode = res.executionMode;
        if (executionMode === "backend") {
          radioBackend.checked = true;
          backendConfig.classList.remove("hidden");
        } else {
          radioStandalone.checked = true;
          backendConfig.classList.add("hidden");
        }
      }
      if (res.backendUrl) {
        backendUrlInput.value = res.backendUrl;
      }
    });
  }

  // Detect Current Active Tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0 && tabs[0].url) {
      currentActiveTab = tabs[0];
      const parsedUrl = new URL(currentActiveTab.url);

      if (parsedUrl.protocol.startsWith("http")) {
        activeTabHost.textContent = parsedUrl.hostname;
        // Pre-fill input if default github.com is there
        if (urlInput.value === "github.com") {
          urlInput.value = parsedUrl.hostname;
        }
      } else {
        activeTabBanner.classList.add("hidden");
      }
    } else {
      activeTabBanner.classList.add("hidden");
    }
  } catch (e) {
    console.warn("Could not query active tab:", e);
    activeTabBanner.classList.add("hidden");
  }

  // Settings toggle
  btnSettings.addEventListener("click", () => {
    settingsDrawer.classList.toggle("hidden");
  });

  radioStandalone.addEventListener("change", () => {
    executionMode = "standalone";
    backendConfig.classList.add("hidden");
    saveSettings();
  });

  radioBackend.addEventListener("change", () => {
    executionMode = "backend";
    backendConfig.classList.remove("hidden");
    saveSettings();
  });

  backendUrlInput.addEventListener("change", () => {
    saveSettings();
  });

  function saveSettings() {
    if (chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({
        executionMode,
        backendUrl: backendUrlInput.value.trim()
      });
    }
  }

  // Preset Chips
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      urlInput.value = chip.dataset.url;
      analyzeUrl(chip.dataset.url);
    });
  });

  // Analyze Button & Enter key
  btnAnalyze.addEventListener("click", () => {
    analyzeUrl(urlInput.value.trim());
  });

  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      analyzeUrl(urlInput.value.trim());
    }
  });

  // Inspect Active Tab Button
  btnInspectTab.addEventListener("click", () => {
    if (!currentActiveTab) return;
    inspectActiveTab(currentActiveTab);
  });

  // Copy JSON action
  btnCopyJson.addEventListener("click", () => {
    if (!lastAnalysisData) return;
    navigator.clipboard.writeText(JSON.stringify(lastAnalysisData, null, 2))
      .then(() => {
        const originalText = btnCopyJson.innerHTML;
        btnCopyJson.innerHTML = `✓ Copied!`;
        setTimeout(() => {
          btnCopyJson.innerHTML = originalText;
        }, 1500);
      })
      .catch((err) => {
        console.error("Failed to copy JSON:", err);
      });
  });

  // Open Full Tab action
  btnOpenFull.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("popup/popup.html") });
  });

  /**
   * Run URL analysis via background worker
   */
  function analyzeUrl(url) {
    if (!url) return;

    hideError();
    showLoading(true);
    flowContainer.classList.add("hidden");

    chrome.runtime.sendMessage({
      type: "ANALYZE_URL",
      url,
      mode: executionMode,
      backendUrl: backendUrlInput.value.trim()
    }, (response) => {
      showLoading(false);
      if (chrome.runtime.lastError) {
        showError(chrome.runtime.lastError.message);
        return;
      }
      if (!response || !response.success) {
        showError(response ? response.error : "Unknown error during analysis");
        return;
      }

      renderResults(response.data);
    });
  }

  /**
   * Inspect current tab directly using Navigation Timings
   */
  function inspectActiveTab(tab) {
    hideError();
    showLoading(true);
    flowContainer.classList.add("hidden");

    chrome.runtime.sendMessage({
      type: "INSPECT_ACTIVE_TAB",
      tabId: tab.id,
      tabUrl: tab.url
    }, (response) => {
      showLoading(false);
      if (chrome.runtime.lastError) {
        showError(chrome.runtime.lastError.message);
        return;
      }
      if (!response || !response.success) {
        showError(response ? response.error : "Could not inspect active tab");
        return;
      }

      renderResults(response.data);
    });
  }

  /**
   * Render metrics & diagram
   */
  function renderResults(data) {
    lastAnalysisData = data;

    // Summary bar
    const totalLatency = Math.round((Number(data.dns_time_ms || 0) + Number(data.response_time_ms || 0)) * 10) / 10;
    document.getElementById("metricTotalTime").textContent = `${totalLatency} ms`;

    const statusEl = document.getElementById("metricStatus");
    const statusCode = data.status_code || 0;
    statusEl.textContent = statusCode ? `${statusCode}` : "Err";
    statusEl.className = `metric-val status-badge ${getStatusClass(statusCode)}`;

    document.getElementById("metricSize").textContent = formatBytes(data.response_size_bytes || 0);

    // Waterfall bar
    renderWaterfall(data, totalLatency);

    // Step 1: Client
    document.getElementById("clientProtocol").textContent = data.protocol || "HTTPS";
    document.getElementById("clientTargetUrl").textContent = data.targetUrl || data.domain;

    // Step 2: DNS Lookup
    document.getElementById("dnsTimeBadge").textContent = `${data.dns_time_ms || 0} ms`;
    document.getElementById("stepDomain").textContent = data.domain || "--";
    document.getElementById("stepIp").textContent = data.ip || "Unknown";
    document.getElementById("stepDnsProvider").textContent = data.dns_provider || "Standard Resolver";

    // Step 3: HTTP Request
    document.getElementById("httpTimeBadge").textContent = `${data.response_time_ms || 0} ms`;
    const stepStatusEl = document.getElementById("stepStatusCode");
    stepStatusEl.textContent = statusCode ? `${statusCode} ${data.status_text || ""}` : "Request Failed";
    stepStatusEl.className = `kv-val status-pill ${getStatusClass(statusCode)}`;

    const rowServer = document.getElementById("rowServer");
    if (data.server && data.server !== "unknown" && data.server !== "N/A") {
      rowServer.classList.remove("hidden");
      document.getElementById("stepServer").textContent = data.server;
    } else {
      rowServer.classList.add("hidden");
    }

    // Step 4: Request Complete
    document.getElementById("stepSize").textContent = formatBytes(data.response_size_bytes || 0);
    const rowContentType = document.getElementById("rowContentType");
    if (data.content_type && data.content_type !== "unknown" && data.content_type !== "N/A") {
      rowContentType.classList.remove("hidden");
      document.getElementById("stepContentType").textContent = data.content_type;
    } else {
      rowContentType.classList.add("hidden");
    }

    flowContainer.classList.remove("hidden");
  }

  /**
   * Render timing breakdown waterfall
   */
  function renderWaterfall(data, totalMs) {
    const dnsMs = Number(data.dns_time_ms || 0);
    const handshakeMs = Number(data.tcp_time_ms || 0) + Number(data.tls_time_ms || 0);
    const responseMs = Math.max(1, Number(data.response_time_ms || 0) - handshakeMs);

    const safeTotal = Math.max(1, dnsMs + handshakeMs + responseMs);

    const dnsPct = Math.max(4, Math.round((dnsMs / safeTotal) * 100));
    const handshakePct = handshakeMs > 0 ? Math.max(4, Math.round((handshakeMs / safeTotal) * 100)) : 0;
    const responsePct = Math.max(10, 100 - dnsPct - handshakePct);

    document.getElementById("wfDns").style.width = `${dnsPct}%`;
    document.getElementById("wfHandshake").style.width = `${handshakePct}%`;
    document.getElementById("wfResponse").style.width = `${responsePct}%`;

    document.getElementById("wfDnsVal").textContent = `${dnsMs}ms`;
    document.getElementById("wfHandshakeVal").textContent = `${handshakeMs}ms`;
    document.getElementById("wfResponseVal").textContent = `${responseMs}ms`;
    document.getElementById("waterfallTotalLabel").textContent = `${Math.round(safeTotal)} ms total`;
  }

  function getStatusClass(code) {
    if (code >= 200 && code < 300) return "status-2xx";
    if (code >= 300 && code < 400) return "status-3xx";
    if (code >= 400 && code < 500) return "status-4xx";
    return "status-5xx";
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]} (${bytes.toLocaleString()} B)`;
  }

  function showLoading(show) {
    if (show) {
      loadingBox.classList.remove("hidden");
      btnAnalyze.disabled = true;
      btnAnalyze.textContent = "Analyzing...";
    } else {
      loadingBox.classList.add("hidden");
      btnAnalyze.disabled = false;
      btnAnalyze.textContent = "Analyze";
    }
  }

  function showError(msg) {
    errorMessage.textContent = msg;
    errorBox.classList.remove("hidden");
  }

  function hideError() {
    errorBox.classList.add("hidden");
    errorMessage.textContent = "";
  }
});
