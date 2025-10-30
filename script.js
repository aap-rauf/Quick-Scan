// ---------- START script.js (replace whole file) ----------
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

const CACHE_KEY = "sheetCache";
const CACHE_TIME_KEY = "sheetCacheTime";
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours

let data = [];
let dataReady = false;
let loadFailed = false;
let fakeProgressTimer = null;

function updateProgressBar(percent) {
  const fill = document.getElementById("loaderFill");
  const text = document.getElementById("loaderText");

  if (fill) {
    fill.style.width = percent + "%";
  }
  if (text) {
    // Keep text width fixed to prevent layout jump
    text.textContent = `Loading... ${percent}%`;
  }
}
// update visible progress (0..100)
function setProgress(pct) {
  const fill = document.getElementById("loaderFill");
  const txt  = document.getElementById("loaderText");
  if (fill) fill.style.width = Math.max(0, Math.min(100, pct)) + "%";
  if (txt)  txt.textContent = pct >= 100 ? "Ready" : "Loading... " + Math.floor(pct) + "%";
  if (pct >= 100 && txt) txt.classList.add("loader-ready");
}

// algorithm for fake progress while fetching (keeps UI lively)
function startFakeProgress() {
  let progress = 0;
  setProgress(0);
  clearInterval(fakeProgressTimer);
  fakeProgressTimer = setInterval(() => {
    // slowly climb to 90-95; when real fetch finishes we jump to 100
    if (progress < 92) {
      progress += 1 + Math.random() * 2; // faster random climb
      setProgress(Math.floor(progress));
    }
  }, 130);
}

// stop fake progress
function stopFakeProgress() {
  if (fakeProgressTimer) clearInterval(fakeProgressTimer);
  fakeProgressTimer = null;
}

// show friendly error with reload button
function showLoadError() {
  const result = document.getElementById("result");
  if (!result) return;
  result.innerHTML = `
    <div style="color:var(--color-accent,#FFD700);text-align:center;font-weight:600;margin-top:20px;line-height:1.4;">
      Unable to load data.<br>
      Please check your internet connection and try again.<br><br>
      <button id="reloadBtn" style="
        background: transparent;
        border: 1px solid var(--color-accent,#FFD700);
        color: var(--color-accent,#FFD700);
        border-radius: 10px;
        padding: 8px 16px;
        font-size: 15px;
        font-weight:600;
        cursor:pointer;
      ">⟳ Reload</button>
    </div>
  `;
  const reloadBtn = document.getElementById("reloadBtn");
  if (reloadBtn) {
    reloadBtn.addEventListener("click", () => {
      fetchSheetData(true);
    });
  }
}

// parse Google Sheets gviz JSON -> array of items
function parseGviz(txt) {
  // the gviz response has `/*O_o*/` prefix and `);` suffix — we strip them
  const json = JSON.parse(txt.substr(47).slice(0, -2));
  const rows = json.table.rows || [];
  return rows.map(r => {
    const skuOriginal = r.c[0]?.v || "";
    const nameOriginal = r.c[1]?.v || "";
    const barcodeCell = (r.c[2]?.v || "").toString().trim();
    const barcodeList = barcodeCell === "" ? [] : barcodeCell.split(",").map(b => b.trim()).filter(Boolean);
    return {
      sku: skuOriginal,
      name: nameOriginal,
      barcodes: barcodeList,
      primaryBarcode: barcodeList[0] || "",
      searchSku: skuOriginal.toString().toLowerCase(),
      searchBarcodes: barcodeList.map(b => b.toString().toLowerCase())
    };
  });
}

// load data with caching logic
async function fetchSheetData(force = false) {
  const result = document.getElementById("result");
  loadFailed = false;
  dataReady = false;

  showProgressUI();
  startFakeProgress();

  // try cache first (unless force)
  try {
    const now = Date.now();
    const cached = localStorage.getItem(CACHE_KEY);
    const cachedTime = parseInt(localStorage.getItem(CACHE_TIME_KEY) || "0", 10);
    if (!force && cached && cachedTime && (now - cachedTime < CACHE_TTL)) {
      // use cache immediately
      data = JSON.parse(cached);
      dataReady = true;
      stopFakeProgress();
      setProgress(100);
      result.innerHTML = '<div style="text-align:center;color:var(--color-accent,#FFD700);font-weight:600;margin-top:18px;">Ready to search items</div>';
      // still attempt background refresh (without overriding UI), but do not show loader again
      backgroundRefresh();
      return;
    }
  } catch (e) {
    console.warn("Cache read error", e);
  }

  // fetch fresh
  try {
    const res = await fetch(SHEET_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("Network response not ok " + res.status);
    const txt = await res.text();
    const parsed = parseGviz(txt);
    // save to cache
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
      localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    } catch (e) {
      console.warn("Failed to write cache", e);
    }
    data = parsed;
    dataReady = true;
    stopFakeProgress();
    setProgress(100);
    result.innerHTML = '<div style="text-align:center;color:var(--color-accent,#FFD700);font-weight:600;margin-top:18px;">Ready to search items</div>';
  } catch (err) {
    stopFakeProgress();
    console.error("Sheet fetch failed", err);
    loadFailed = true;
    showLoadError();
  }
}

// background update attempt if cache used
async function backgroundRefresh() {
  try {
    const res = await fetch(SHEET_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("bg refresh failed " + res.status);
    const txt = await res.text();
    const parsed = parseGviz(txt);
    localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
    localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
    data = parsed;
    dataReady = true;
    console.log("Background refresh done:", data.length);
  } catch (e) {
    console.log("Background refresh skipped:", e.message);
  }
}

/* SEARCH BEHAVIOUR
   - If load failed: do nothing when typing (user must tap reload)
   - If not loaded yet: do nothing (silent)
   - After loaded: search last digits ending match for sku/barcode (case-insensitive)
*/
document.getElementById("searchBox").addEventListener("input", function (e) {
  if (loadFailed) return; // keep shown error UI intact
  if (!dataReady) return;   // nothing to show until ready

  const q = e.target.value.trim().toLowerCase();
  const result = document.getElementById("result");
  if (!q) {
    result.innerHTML = "";
    return;
  }

  const results = data.filter(item =>
    (item.searchBarcodes || []).some(b => b.endsWith(q)) ||
    (item.searchSku || "").endsWith(q)
  );

  if (!results || results.length === 0) {
    result.innerHTML = `<div style="text-align:center;color:var(--color-accent,#FFD700);font-weight:600;margin-top:18px;">No matching item found</div>`;
    return;
  }

  const item = results[0];
  const barcodeDisplay = (item.barcodes && item.barcodes.length > 1) ? `${item.barcodes[0]} <span class="more">…</span>` : (item.barcodes[0] || "");

  result.innerHTML = `
    <div class="card">
      <strong>${escapeHtml(item.name)}</strong><br>
      SKU: ${escapeHtml(item.sku)}<br>
      Barcodes: <span class="barcode-list">${escapeHtml(barcodeDisplay)}</span><br><br>
      <div class="barcode-img">
        <img src="https://barcodeapi.org/api/code128/${encodeURIComponent(item.primaryBarcode)}" alt="Barcode" />
      </div>
    </div>
  `;

  const more = document.querySelector(".more");
  if (more) {
    more.addEventListener("click", () => {
      document.querySelector(".barcode-list").innerText = item.barcodes.join(", ");
    });
  }
});

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, function (m) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]) || m;
  });
}

/* Theme toggle (keeps your existing behaviour) */
const themeToggle = document.getElementById("themeToggle");
const html = document.documentElement;
const savedTheme = localStorage.getItem("theme") || "light";
if (html) html.setAttribute("data-theme", savedTheme);
if (themeToggle) themeToggle.textContent = savedTheme === "light" ? "🌙" : "☀️";

if (themeToggle) themeToggle.addEventListener("click", () => {
  const current = html.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  html.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  themeToggle.textContent = next === "light" ? "🌙" : "☀️";
});

// Kick off sheet load (use cache if present)
fetchSheetData(false);

// ---------- END script.js ----------
