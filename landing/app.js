/**
 * LoadLab Landing Page — Interactive Application Logic
 * Pure JavaScript with zero external runtime dependencies.
 */

(function () {
  'use strict';

  // Configuration
  const GITHUB_REPO = 'Darshan-A-S/LoadLab';
  const GITHUB_API_RELEASES = `https://api.github.com/repos/${GITHUB_REPO}/releases`;
  const WINDOWS_EXE_URL = `https://github.com/${GITHUB_REPO}/releases/download/v0.1.3/LoadLab.Setup.0.1.3.exe`;
  const RELEASES_PAGE_URL = `https://github.com/${GITHUB_REPO}/releases`;
  
  // 100% Strictly Real Downloads directly from GitHub Releases API (Zero artificial baseline)
  const BASE_OFFLINE_DOWNLOADS = 0;

  // DOM Elements
  const totalDownloadsCountEl = document.getElementById('totalDownloadsCount');
  const downloadsPillEl = document.getElementById('downloadsPill');
  const btnDownloadWin = document.getElementById('btnDownloadWin');
  const btnDownloadMac = document.getElementById('btnDownloadMac');
  const btnDownloadLinux = document.getElementById('btnDownloadLinux');
  const toastContainer = document.getElementById('toastContainer');
  
  // Simulator DOM Elements
  const simToggleBtn = document.getElementById('simToggleBtn');
  const simBtnText = document.getElementById('simBtnText');
  const metricRpsEl = document.getElementById('metricRps');
  const metricLatencyEl = document.getElementById('metricLatency');
  const valP50El = document.getElementById('valP50');
  const valP95El = document.getElementById('valP95');
  const valP99El = document.getElementById('valP99');
  const metricTotalReqsEl = document.getElementById('metricTotalReqs');
  const canvas = document.getElementById('liveTelemetryCanvas');
  const activeEngineIndicator = document.getElementById('activeEngineIndicator');
  const engineTabs = document.querySelectorAll('.engine-tab');

  // Modal DOM Elements
  const downloadModal = document.getElementById('downloadModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalActionBtn = document.getElementById('modalActionBtn');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalDismissBtn = document.getElementById('modalDismissBtn');

  // Simulator State
  let isSimRunning = true;
  let totalRequestsCount = 492600;
  let activeEngine = 'autocannon';
  let chartPoints = [];
  const MAX_POINTS = 50;

  // Engine Performance Profiles for Simulation
  const ENGINE_PROFILES = {
    autocannon: {
      name: 'Autocannon (Node.js)',
      baseRps: 16400,
      rpsVariance: 1200,
      baseLatency: 2.8,
      p50: '2.1ms',
      p95: '5.6ms',
      p99: '11.4ms'
    },
    oha: {
      name: 'oha (Rust CLI)',
      baseRps: 34200,
      rpsVariance: 1800,
      baseLatency: 1.3,
      p50: '0.9ms',
      p95: '2.4ms',
      p99: '4.8ms'
    },
    bombardier: {
      name: 'Bombardier (Go CLI)',
      baseRps: 28900,
      rpsVariance: 1500,
      baseLatency: 1.6,
      p50: '1.2ms',
      p95: '3.1ms',
      p99: '6.2ms'
    },
    artillery: {
      name: 'Artillery (Scenarios)',
      baseRps: 12100,
      rpsVariance: 900,
      baseLatency: 3.9,
      p50: '3.1ms',
      p95: '8.2ms',
      p99: '17.5ms'
    }
  };

  /* ------------------------------------------------------------------
     1. TOTAL DOWNLOADS FETCHER & COUNTER (100% Real GitHub Count)
     ------------------------------------------------------------------ */
  async function fetchTotalDownloads() {
    let githubDownloads = 0;
    let fetchSuccessful = false;

    try {
      const response = await fetch(GITHUB_API_RELEASES, {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });
      
      if (response.ok) {
        const releases = await response.json();
        if (Array.isArray(releases)) {
          releases.forEach(rel => {
            if (Array.isArray(rel.assets)) {
              rel.assets.forEach(asset => {
                githubDownloads += (asset.download_count || 0);
              });
            }
          });
          fetchSuccessful = true;
          localStorage.setItem('loadlab_cached_real_downloads', githubDownloads.toString());
        }
      }
    } catch (err) {
      console.warn('GitHub API releases fetch error:', err);
    }

    if (!fetchSuccessful) {
      // Use last cached real count from GitHub if network/rate-limited
      githubDownloads = parseInt(localStorage.getItem('loadlab_cached_real_downloads') || '0', 10);
    }

    // Display the exact real number statically (no count-up animation)
    totalDownloadsCountEl.innerText = githubDownloads.toLocaleString();
  }

  /* ------------------------------------------------------------------
     2. OPERATING SYSTEM AUTO-DETECTION (Highlights matching OS button)
     ------------------------------------------------------------------ */
  function detectClientOS() {
    const userAgent = navigator.userAgent.toLowerCase();
    const platform = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
    
    let detected = 'unknown';

    if (platform.includes('win') || userAgent.includes('windows')) {
      detected = 'windows';
    } else if (platform.includes('mac') || userAgent.includes('macintosh') || userAgent.includes('mac os')) {
      detected = 'mac';
    } else if (platform.includes('linux') || userAgent.includes('linux') || userAgent.includes('x11')) {
      detected = 'linux';
    }

    // Subtly highlight matching OS button without displaying device name text
    if (detected === 'windows' && btnDownloadWin) {
      btnDownloadWin.classList.add('recommended');
    } else if (detected === 'mac' && btnDownloadMac) {
      btnDownloadMac.classList.add('recommended');
    } else if (detected === 'linux' && btnDownloadLinux) {
      btnDownloadLinux.classList.add('recommended');
    }
  }

  /* ------------------------------------------------------------------
     3. DOWNLOAD BUTTON ACTIONS & MODAL HANDLERS
     ------------------------------------------------------------------ */
  btnDownloadWin.addEventListener('click', function (e) {
    showToast('Downloading LoadLab for Windows (v0.1.3)...');
    // Allow natural download link to proceed to LoadLab.Setup.0.1.3.exe
  });

  btnDownloadMac.addEventListener('click', function (e) {
    e.preventDefault();
    openModal(
      'Download LoadLab for macOS',
      `<p>LoadLab for macOS is packaged as universal release assets supporting both <strong>Apple Silicon (M1/M2/M3/M4)</strong> and <strong>Intel Macs</strong>.</p>
       <div style="margin-top: 12px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 6px; font-family: monospace; font-size: 0.8rem;">
         brew install --cask loadlab <span style="color:#64748b;"># Or download DMG below</span>
       </div>
       <p style="margin-top: 12px; font-size: 0.8rem; color: #94a3b8;">Click below to download the latest macOS release asset directly from GitHub.</p>`,
      RELEASES_PAGE_URL
    );
  });

  btnDownloadLinux.addEventListener('click', function (e) {
    e.preventDefault();
    openModal(
      'Download LoadLab for Linux',
      `<p>LoadLab for Linux is available as an <strong>AppImage</strong> and <strong>.deb</strong> package for Debian / Ubuntu / Fedora / Arch distributions.</p>
       <div style="margin-top: 12px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 6px; font-family: monospace; font-size: 0.8rem;">
         chmod +x LoadLab-0.1.3.AppImage<br>./LoadLab-0.1.3.AppImage
       </div>
       <p style="margin-top: 12px; font-size: 0.8rem; color: #94a3b8;">Click below to download the latest Linux binaries from GitHub Releases.</p>`,
      RELEASES_PAGE_URL
    );
  });

  function openModal(title, htmlContent, actionUrl) {
    modalTitle.innerText = title;
    modalBody.innerHTML = htmlContent;
    modalActionBtn.href = actionUrl;
    downloadModal.classList.add('active');
  }

  function closeModal() {
    downloadModal.classList.remove('active');
  }

  modalCloseBtn.addEventListener('click', closeModal);
  modalDismissBtn.addEventListener('click', closeModal);
  downloadModal.addEventListener('click', (e) => {
    if (e.target === downloadModal) closeModal();
  });

  /* ------------------------------------------------------------------
     4. TOAST NOTIFICATIONS
     ------------------------------------------------------------------ */
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span class="toast-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </span>
      <span>${message}</span>
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  /* ------------------------------------------------------------------
     5. LOADLAB LIVE DESKTOP SIMULATOR (Canvas + Metrics Ticker)
     ------------------------------------------------------------------ */
  function initTelemetryChart() {
    // Fill initial data buffer
    const profile = ENGINE_PROFILES[activeEngine];
    for (let i = 0; i < MAX_POINTS; i++) {
      const variation = (Math.random() - 0.5) * profile.rpsVariance;
      chartPoints.push(profile.baseRps + variation);
    }
    resizeCanvas();
  }

  function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
  }

  window.addEventListener('resize', resizeCanvas);

  function renderChart() {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    if (chartPoints.length < 2) return;

    // Draw horizontal grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let y = 0.25; y < 1; y += 0.25) {
      ctx.beginPath();
      ctx.moveTo(0, height * y);
      ctx.lineTo(width, height * y);
      ctx.stroke();
    }

    const minVal = Math.min(...chartPoints) * 0.9;
    const maxVal = Math.max(...chartPoints) * 1.08;
    const stepX = width / (MAX_POINTS - 1);

    // Create Path for Smooth Wave
    ctx.beginPath();
    const pointsCoords = chartPoints.map((val, idx) => {
      const normY = (val - minVal) / (maxVal - minVal || 1);
      const x = idx * stepX;
      const y = height - (normY * height * 0.8 + height * 0.1);
      return { x, y };
    });

    ctx.moveTo(pointsCoords[0].x, pointsCoords[0].y);
    for (let i = 0; i < pointsCoords.length - 1; i++) {
      const xc = (pointsCoords[i].x + pointsCoords[i + 1].x) / 2;
      const yc = (pointsCoords[i].y + pointsCoords[i + 1].y) / 2;
      ctx.quadraticCurveTo(pointsCoords[i].x, pointsCoords[i].y, xc, yc);
    }
    const lastPt = pointsCoords[pointsCoords.length - 1];
    ctx.lineTo(lastPt.x, lastPt.y);

    // Save path for stroke
    ctx.strokeStyle = '#ff6c37';
    ctx.lineWidth = 2.5 * window.devicePixelRatio;
    ctx.shadowColor = 'rgba(255, 108, 55, 0.6)';
    ctx.shadowBlur = 12;
    ctx.stroke();
    ctx.shadowBlur = 0; // reset shadow

    // Fill underneath curve
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, 'rgba(255, 108, 55, 0.25)');
    gradient.addColorStop(0.7, 'rgba(255, 108, 55, 0.05)');
    gradient.addColorStop(1, 'rgba(255, 108, 55, 0)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw active pulsing point at head
    ctx.beginPath();
    ctx.arc(lastPt.x - 2, lastPt.y, 4 * window.devicePixelRatio, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#ff6c37';
    ctx.lineWidth = 2 * window.devicePixelRatio;
    ctx.stroke();
  }

  // Simulator Loop (Updating numbers and advancing the chart)
  let lastMetricUpdateTime = 0;
  function updateSimulator(timestamp) {
    if (isSimRunning) {
      if (timestamp - lastMetricUpdateTime > 140) {
        lastMetricUpdateTime = timestamp;

        const profile = ENGINE_PROFILES[activeEngine];
        const variance = (Math.random() - 0.5) * profile.rpsVariance;
        const currentRps = Math.round(profile.baseRps + variance);

        // Advance chart buffer
        chartPoints.push(currentRps);
        if (chartPoints.length > MAX_POINTS) {
          chartPoints.shift();
        }

        // Advance total requests
        totalRequestsCount += Math.round(currentRps * 0.14);
        metricTotalReqsEl.innerText = totalRequestsCount.toLocaleString();

        // Update RPS display
        metricRpsEl.innerText = currentRps.toLocaleString();

        // Update latency slight jitter
        const latencyJitter = (Math.random() * 0.4 - 0.2);
        const curLatency = (profile.baseLatency + latencyJitter).toFixed(1);
        metricLatencyEl.innerHTML = `${curLatency} <span class="metric-unit">ms</span>`;
      }
    }

    renderChart();
    requestAnimationFrame(updateSimulator);
  }

  // Toggle Run / Pause in Simulator
  simToggleBtn.addEventListener('click', () => {
    isSimRunning = !isSimRunning;
    if (isSimRunning) {
      simToggleBtn.classList.remove('paused');
      simBtnText.innerText = 'RUNNING';
    } else {
      simToggleBtn.classList.add('paused');
      simBtnText.innerText = 'PAUSED';
    }
  });

  // Pluggable Engine Switcher Tabs
  engineTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      engineTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const engineKey = tab.dataset.engine;
      if (ENGINE_PROFILES[engineKey]) {
        activeEngine = engineKey;
        const profile = ENGINE_PROFILES[engineKey];
        
        activeEngineIndicator.innerText = profile.name;
        valP50El.innerText = profile.p50;
        valP95El.innerText = profile.p95;
        valP99El.innerText = profile.p99;

        // Reset chart points around new profile baseline
        chartPoints = [];
        for (let i = 0; i < MAX_POINTS; i++) {
          const v = (Math.random() - 0.5) * profile.rpsVariance;
          chartPoints.push(profile.baseRps + v);
        }

        showToast(`Switched engine to ${profile.name}`);
      }
    });
  });

  /* ------------------------------------------------------------------
     INITIALIZATION ON DOM CONTENT LOADED
     ------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', () => {
    detectClientOS();
    fetchTotalDownloads();
    initTelemetryChart();
    requestAnimationFrame(updateSimulator);
  });

})();
