/**
 * Internet Request Visualizer - Popup Controller
 * Supports Single Flow Inspection & Multi-Site Comparison Benchmark
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Navigation Tabs
  const tabBtnSingle = document.getElementById("tabBtnSingle");
  const tabBtnCompare = document.getElementById("tabBtnCompare");
  const singleView = document.getElementById("singleView");
  const compareView = document.getElementById("compareView");
  const compareBadgeCount = document.getElementById("compareBadgeCount");

  // Single Flow Elements
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

  // Multi-Site Compare Elements
  const compareSiteInput = document.getElementById("compareSiteInput");
  const btnAddSite = document.getElementById("btnAddSite");
  const presetTech = document.getElementById("presetTech");
  const presetDev = document.getElementById("presetDev");
  const presetSocial = document.getElementById("presetSocial");
  const sitesCount = document.getElementById("sitesCount");
  const btnClearAllSites = document.getElementById("btnClearAllSites");
  const sitesTagsContainer = document.getElementById("sitesTagsContainer");
  const btnRunBenchmark = document.getElementById("btnRunBenchmark");

  const compareLoadingBox = document.getElementById("compareLoadingBox");
  const compareProgressLabel = document.getElementById("compareProgressLabel");
  const compareProgressBar = document.getElementById("compareProgressBar");
  const compareErrorBox = document.getElementById("compareErrorBox");
  const compareErrorMessage = document.getElementById("compareErrorMessage");
  const compareResultsContainer = document.getElementById("compareResultsContainer");

  const winnerHost = document.getElementById("winnerHost");
  const winnerTotalTime = document.getElementById("winnerTotalTime");
  const winnerSpeedDiff = document.getElementById("winnerSpeedDiff");
  const fastestDnsHost = document.getElementById("fastestDnsHost");
  const lightestHost = document.getElementById("lightestHost");
  const sortSelect = document.getElementById("sortSelect");
  const comparisonBars = document.getElementById("comparisonBars");
  const leaderboardTbody = document.getElementById("leaderboardTbody");
  const btnCopyCompareJson = document.getElementById("btnCopyCompareJson");
  const btnOpenFullCompare = document.getElementById("btnOpenFullCompare");

  // State
  let currentActiveTab = null;
  let lastAnalysisData = null;
  let executionMode = "standalone";
  let sitesToCompare = ["google.com", "github.com", "wikipedia.org"];
  let lastBenchmarkResults = [];

  // =========================================================================
  // TAB NAVIGATION
  // =========================================================================
  tabBtnSingle.addEventListener("click", () => switchTab("single"));
  tabBtnCompare.addEventListener("click", () => switchTab("compare"));

  function switchTab(tab) {
    if (tab === "single") {
      tabBtnSingle.classList.add("active");
      tabBtnCompare.classList.remove("active");
      singleView.classList.add("active");
      compareView.classList.remove("active");
    } else {
      tabBtnSingle.classList.remove("active");
      tabBtnCompare.classList.add("active");
      singleView.classList.remove("active");
      compareView.classList.add("active");
    }
  }

  // =========================================================================
  // SETTINGS & STORAGE
  // =========================================================================
  if (chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(["executionMode", "backendUrl", "savedCompareSites"], (res) => {
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
      if (res.savedCompareSites && Array.isArray(res.savedCompareSites) && res.savedCompareSites.length > 0) {
        sitesToCompare = res.savedCompareSites;
      }
      renderSitesTags();
    });
  } else {
    renderSitesTags();
  }

  // Detect Current Active Tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs && tabs.length > 0 && tabs[0].url) {
      currentActiveTab = tabs[0];
      const parsedUrl = new URL(currentActiveTab.url);

      if (parsedUrl.protocol.startsWith("http")) {
        activeTabHost.textContent = parsedUrl.hostname;
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
        backendUrl: backendUrlInput.value.trim(),
        savedCompareSites: sitesToCompare
      });
    }
  }

  // =========================================================================
  // VIEW 1: SINGLE FLOW ANALYZER
  // =========================================================================
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      urlInput.value = chip.dataset.url;
      analyzeSingleUrl(chip.dataset.url);
    });
  });

  btnAnalyze.addEventListener("click", () => {
    analyzeSingleUrl(urlInput.value.trim());
  });

  urlInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      analyzeSingleUrl(urlInput.value.trim());
    }
  });

  btnInspectTab.addEventListener("click", () => {
    if (!currentActiveTab) return;
    inspectActiveTab(currentActiveTab);
  });

  btnCopyJson.addEventListener("click", () => {
    if (!lastAnalysisData) return;
    navigator.clipboard.writeText(JSON.stringify(lastAnalysisData, null, 2))
      .then(() => {
        const originalText = btnCopyJson.innerHTML;
        btnCopyJson.innerHTML = `✓ Copied!`;
        setTimeout(() => {
          btnCopyJson.innerHTML = originalText;
        }, 1500);
      });
  });

  btnOpenFull.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("popup/popup.html") });
  });

  function analyzeSingleUrl(url) {
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
      renderSingleResults(response.data);
    });
  }

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
      renderSingleResults(response.data);
    });
  }

  function renderSingleResults(data) {
    lastAnalysisData = data;

    const totalLatency = Math.round((Number(data.dns_time_ms || 0) + Number(data.response_time_ms || 0)) * 10) / 10;
    document.getElementById("metricTotalTime").textContent = `${totalLatency} ms`;

    const statusEl = document.getElementById("metricStatus");
    const statusCode = data.status_code || 0;
    statusEl.textContent = statusCode ? `${statusCode}` : "Err";
    statusEl.className = `metric-val status-badge ${getStatusClass(statusCode)}`;

    document.getElementById("metricSize").textContent = formatBytes(data.response_size_bytes || 0);

    renderWaterfall(data, totalLatency);

    document.getElementById("clientProtocol").textContent = data.protocol || "HTTPS";
    document.getElementById("clientTargetUrl").textContent = data.targetUrl || data.domain;

    document.getElementById("dnsTimeBadge").textContent = `${data.dns_time_ms || 0} ms`;
    document.getElementById("stepDomain").textContent = data.domain || "--";
    document.getElementById("stepIp").textContent = data.ip || "Unknown";
    document.getElementById("stepDnsProvider").textContent = data.dns_provider || "Standard Resolver";

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

  // =========================================================================
  // VIEW 2: MULTI-SITE COMPARISON BENCHMARK
  // =========================================================================
  btnAddSite.addEventListener("click", () => addCompareSite());
  compareSiteInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addCompareSite();
  });

  presetTech.addEventListener("click", () => {
    setSitesList(["google.com", "github.com", "cloudflare.com", "apple.com"]);
  });

  presetDev.addEventListener("click", () => {
    setSitesList(["github.com", "npmjs.com", "stackoverflow.com", "developer.mozilla.org"]);
  });

  presetSocial.addEventListener("click", () => {
    setSitesList(["reddit.com", "x.com", "youtube.com", "linkedin.com"]);
  });

  btnClearAllSites.addEventListener("click", () => {
    sitesToCompare = [];
    renderSitesTags();
    saveSettings();
  });

  function addCompareSite() {
    let site = compareSiteInput.value.trim().toLowerCase();
    site = site.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!site) return;

    if (!sitesToCompare.includes(site)) {
      sitesToCompare.push(site);
      renderSitesTags();
      saveSettings();
    }
    compareSiteInput.value = "";
    compareSiteInput.focus();
  }

  function setSitesList(list) {
    sitesToCompare = [...list];
    renderSitesTags();
    saveSettings();
  }

  function renderSitesTags() {
    sitesTagsContainer.innerHTML = "";
    sitesCount.textContent = sitesToCompare.length;
    compareBadgeCount.textContent = sitesToCompare.length;

    if (sitesToCompare.length === 0) {
      sitesTagsContainer.innerHTML = `<span class="text-muted" style="font-size: 11px; padding: 4px;">No sites added yet. Add websites above or click a preset!</span>`;
      return;
    }

    sitesToCompare.forEach((site, index) => {
      const tag = document.createElement("div");
      tag.className = "site-tag";
      tag.innerHTML = `
        <span>${escapeHtml(site)}</span>
        <button class="site-tag-remove" data-index="${index}" title="Remove ${escapeHtml(site)}">×</button>
      `;
      sitesTagsContainer.appendChild(tag);
    });

    sitesTagsContainer.querySelectorAll(".site-tag-remove").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const idx = parseInt(e.target.dataset.index, 10);
        sitesToCompare.splice(idx, 1);
        renderSitesTags();
        saveSettings();
      });
    });
  }

  btnRunBenchmark.addEventListener("click", () => {
    runBenchmark();
  });

  sortSelect.addEventListener("change", () => {
    if (lastBenchmarkResults.length > 0) {
      renderComparisonDashboard(lastBenchmarkResults);
    }
  });

  btnCopyCompareJson.addEventListener("click", () => {
    if (!lastBenchmarkResults || lastBenchmarkResults.length === 0) return;
    navigator.clipboard.writeText(JSON.stringify(lastBenchmarkResults, null, 2))
      .then(() => {
        const originalText = btnCopyCompareJson.innerHTML;
        btnCopyCompareJson.innerHTML = `✓ Copied Benchmark JSON!`;
        setTimeout(() => {
          btnCopyCompareJson.innerHTML = originalText;
        }, 1500);
      });
  });

  btnOpenFullCompare.addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("popup/popup.html") });
  });

  async function runBenchmark() {
    if (sitesToCompare.length === 0) {
      showCompareError("Please add at least one website to compare.");
      return;
    }

    hideCompareError();
    compareResultsContainer.classList.add("hidden");
    compareLoadingBox.classList.remove("hidden");
    btnRunBenchmark.disabled = true;

    const total = sitesToCompare.length;
    let completed = 0;
    const results = [];

    compareProgressLabel.textContent = `Benchmarking 0 of ${total} sites...`;
    compareProgressBar.style.width = "0%";

    // Run parallel queries
    const promises = sitesToCompare.map(async (domain) => {
      try {
        const res = await new Promise((resolve, reject) => {
          chrome.runtime.sendMessage({
            type: "ANALYZE_URL",
            url: domain,
            mode: executionMode,
            backendUrl: backendUrlInput.value.trim()
          }, (response) => {
            if (chrome.runtime.lastError) {
              return reject(new Error(chrome.runtime.lastError.message));
            }
            if (!response || !response.success) {
              return reject(new Error(response ? response.error : "Failed"));
            }
            resolve(response.data);
          });
        });

        const totalTime = Math.round((Number(res.dns_time_ms || 0) + Number(res.response_time_ms || 0)) * 10) / 10;
        results.push({
          domain: res.domain || domain,
          ip: res.ip || "Unknown",
          dns_time_ms: Number(res.dns_time_ms || 0),
          response_time_ms: Number(res.response_time_ms || 0),
          total_time_ms: totalTime,
          status_code: res.status_code || 0,
          response_size_bytes: res.response_size_bytes || 0,
          server: res.server || "unknown",
          success: true
        });
      } catch (err) {
        results.push({
          domain,
          ip: "Error",
          dns_time_ms: 0,
          response_time_ms: 0,
          total_time_ms: 99999,
          status_code: 0,
          response_size_bytes: 0,
          server: "N/A",
          success: false,
          error: err.message
        });
      } finally {
        completed++;
        const pct = Math.round((completed / total) * 100);
        compareProgressBar.style.width = `${pct}%`;
        compareProgressLabel.textContent = `Benchmarking ${completed} of ${total} (${domain})...`;
      }
    });

    await Promise.all(promises);

    compareLoadingBox.classList.add("hidden");
    btnRunBenchmark.disabled = false;

    if (results.length === 0) {
      showCompareError("Benchmark failed to produce results.");
      return;
    }

    lastBenchmarkResults = results;
    renderComparisonDashboard(results);
  }

  function renderComparisonDashboard(results) {
    const sortBy = sortSelect.value;
    const sorted = [...results].sort((a, b) => {
      if (sortBy === "total") return a.total_time_ms - b.total_time_ms;
      if (sortBy === "dns") return a.dns_time_ms - b.dns_time_ms;
      if (sortBy === "response") return a.response_time_ms - b.response_time_ms;
      if (sortBy === "name") return a.domain.localeCompare(b.domain);
      return 0;
    });

    // Valid successes
    const valid = sorted.filter(r => r.success && r.total_time_ms < 99999);
    if (valid.length === 0) {
      showCompareError("All sites failed to respond. Check your internet connection.");
      return;
    }

    // Determine Winner & Stats
    const fastestOverall = [...valid].sort((a, b) => a.total_time_ms - b.total_time_ms)[0];
    const slowestOverall = [...valid].sort((a, b) => b.total_time_ms - a.total_time_ms)[0];
    const fastestDns = [...valid].sort((a, b) => a.dns_time_ms - b.dns_time_ms)[0];
    const lightest = [...valid].sort((a, b) => a.response_size_bytes - b.response_size_bytes)[0];

    winnerHost.textContent = fastestOverall.domain;
    winnerTotalTime.textContent = `${fastestOverall.total_time_ms} ms`;

    if (slowestOverall && slowestOverall !== fastestOverall && fastestOverall.total_time_ms > 0) {
      const ratio = (slowestOverall.total_time_ms / fastestOverall.total_time_ms).toFixed(1);
      winnerSpeedDiff.textContent = `${ratio}x faster than ${slowestOverall.domain}`;
    } else {
      winnerSpeedDiff.textContent = "Top speed achieved";
    }

    fastestDnsHost.textContent = `${fastestDns.domain} (${fastestDns.dns_time_ms} ms)`;
    lightestHost.textContent = `${lightest.domain} (${formatBytes(lightest.response_size_bytes)})`;

    // Max total latency to scale the bars
    const maxLatency = Math.max(...valid.map(r => r.total_time_ms), 1);

    // Render Bars
    comparisonBars.innerHTML = "";
    sorted.forEach((item, index) => {
      const isWinner = item.domain === fastestOverall.domain;
      const rank = index + 1;
      const rankBadge = isWinner
        ? `🥇 1st`
        : rank === 2
        ? `🥈 2nd`
        : rank === 3
        ? `🥉 3rd`
        : `#${rank}`;

      const totalPct = Math.max(8, Math.min(100, Math.round((item.total_time_ms / maxLatency) * 100)));

      // Split breakdown within the bar
      const dnsRatio = item.total_time_ms > 0 ? item.dns_time_ms / item.total_time_ms : 0.2;
      const dnsPct = Math.max(4, Math.round(dnsRatio * 100));
      const responsePct = Math.max(4, 100 - dnsPct);

      const barRow = document.createElement("div");
      barRow.className = "bar-row";
      barRow.innerHTML = `
        <div class="bar-meta">
          <div class="bar-left">
            <span class="rank-badge ${isWinner ? 'rank-1' : ''}">${rankBadge}</span>
            <span class="bar-domain">${escapeHtml(item.domain)}</span>
            <span class="badge ${item.status_code >= 200 && item.status_code < 400 ? 'badge-success' : 'status-5xx'}" style="font-size: 9px; padding: 1px 4px;">
              ${item.status_code || 'Err'}
            </span>
          </div>
          <div class="bar-total-time">${item.success ? `${item.total_time_ms} ms` : 'Failed'}</div>
        </div>
        <div class="bar-track" style="width: 100%;">
          <div style="width: ${totalPct}%; display: flex; height: 100%;">
            <div class="bar-seg bar-seg-dns" style="width: ${dnsPct}%;" title="DNS: ${item.dns_time_ms} ms"></div>
            <div class="bar-seg bar-seg-response" style="width: ${responsePct}%;" title="Response: ${item.response_time_ms} ms"></div>
          </div>
        </div>
      `;
      comparisonBars.appendChild(barRow);
    });

    // Render Leaderboard Table
    leaderboardTbody.innerHTML = "";
    sorted.forEach((item, index) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td class="td-rank">#${index + 1}</td>
        <td class="td-domain">${escapeHtml(item.domain)}</td>
        <td>${item.dns_time_ms} ms</td>
        <td>${item.response_time_ms} ms</td>
        <td>${formatBytes(item.response_size_bytes)}</td>
        <td class="td-total">${item.total_time_ms} ms</td>
      `;
      leaderboardTbody.appendChild(tr);
    });

    compareResultsContainer.classList.remove("hidden");
  }

  function showCompareError(msg) {
    compareErrorMessage.textContent = msg;
    compareErrorBox.classList.remove("hidden");
  }

  function hideCompareError() {
    compareErrorBox.classList.add("hidden");
    compareErrorMessage.textContent = "";
  }

  // Utility helpers
  function getStatusClass(code) {
    if (code >= 200 && code < 300) return "status-2xx";
    if (code >= 300 && code < 400) return "status-3xx";
    if (code >= 400 && code < 500) return "status-4xx";
    return "status-5xx";
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
});
