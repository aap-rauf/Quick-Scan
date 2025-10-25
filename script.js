// URL to fetch your sheet as JSON
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

const CACHE_KEY = "easyScanSheetCache_v1"; // cache name
let data = [];
let dataReady = false;
let loadFailed = false;

const resultEl = document.getElementById("result");
const searchBox = document.getElementById("searchBox");

// initial loader
resultEl.innerHTML = loaderHTML("Loading...");

// Try to load from cache first
const cached = localStorage.getItem(CACHE_KEY);
if (cached) {
  try {
    data = JSON.parse(cached);
    if (Array.isArray(data) && data.length > 0) {
      dataReady = true;
      resultEl.innerHTML = `
        <div style="text-align:center;color:var(--text-color,#FFD700);font-weight:500;margin-top:20px;">
          Ready to search items (cached)
        </div>`;
      // Try background refresh silently
      refreshSheetInBackground();
    } else {
      fetchSheet(); // no valid cache
    }
  } catch {
    fetchSheet(); // parse error
  }
} else {
  fetchSheet(); // no cache found
}

// Main fetch function
function fetchSheet() {
  resultEl.innerHTML = loaderHTML("Loading data...");
  fetch(SHEET_URL)
    .then((res) => res.text())
    .then((txt) => {
      const json = JSON.parse(txt.substr(47).slice(0, -2));
      data = json.table.rows.map((r) => {
        const skuOriginal = r.c[0]?.v || "";
        const nameOriginal = r.c[1]?.v || "";
        const barcodeCell = (r.c[2]?.v || "").trim();
        const barcodeList = barcodeCell
          .split(",")
          .map((b) => b.trim())
          .filter((b) => b);
        return {
          sku: skuOriginal,
          name: nameOriginal,
          barcodes: barcodeList,
          primaryBarcode: barcodeList[0] || "",
          searchSku: skuOriginal.toLowerCase(),
          searchBarcodes: barcodeList.map((b) => b.toLowerCase()),
        };
      });

      localStorage.setItem(CACHE_KEY, JSON.stringify(data)); // save for next time
      console.log("Loaded", data.length, "rows, cached ✅");
      dataReady = true;
      resultEl.innerHTML = `
        <div style="text-align:center;color:var(--text-color,#FFD700);font-weight:500;margin-top:20px;">
          Ready to search items
        </div>`;
    })
    .catch((err) => {
      console.error("Failed to load sheet:", err);
      loadFailed = true;
      resultEl.innerHTML = `
        <div style="
          color: var(--text-color, #FFD700);
          text-align: center;
          font-weight: 500;
          margin-top: 20px;
        ">
          Unable to load data.<br>
          Please check your connection.<br><br>
          <button id="reloadBtn" style="
            background: transparent;
            border: 1px solid var(--text-color, #FFD700);
            color: var(--text-color, #FFD700);
            border-radius: 8px;
            padding: 8px 16px;
            font-size: 15px;
            font-weight: 500;
            cursor: pointer;
          ">⟳ Reload</button>
        </div>
      `;
      document.getElementById("reloadBtn").addEventListener("click", () => {
        resultEl.innerHTML = loaderHTML("Reloading...");
        fetchSheet();
      });
    });
}

// Background refresh (used when cached data exists)
function refreshSheetInBackground() {
  fetch(SHEET_URL)
    .then((res) => res.text())
    .then((txt) => {
      const json = JSON.parse(txt.substr(47).slice(0, -2));
      const fresh = json.table.rows.map((r) => {
        const skuOriginal = r.c[0]?.v || "";
        const nameOriginal = r.c[1]?.v || "";
        const barcodeCell = (r.c[2]?.v || "").trim();
        const barcodeList = barcodeCell
          .split(",")
          .map((b) => b.trim())
          .filter((b) => b);
        return {
          sku: skuOriginal,
          name: nameOriginal,
          barcodes: barcodeList,
          primaryBarcode: barcodeList[0] || "",
          searchSku: skuOriginal.toLowerCase(),
          searchBarcodes: barcodeList.map((b) => b.toLowerCase()),
        };
      });
      localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
      console.log("Background refresh complete ✅");
    })
    .catch(() => {
      console.log("Background refresh skipped (offline)");
    });
}

// Handle Easy Scan tap → refresh and cache again
const easyScanBtn = document.getElementById("easyScan");
if (easyScanBtn) {
  easyScanBtn.addEventListener("click", () => {
    resultEl.innerHTML = loaderHTML("Reloading latest data...");
    fetchSheet();
  });
}

// live search
searchBox.addEventListener("input", onSearchInput);

function onSearchInput(e) {
  if (loadFailed) return;
  if (!dataReady) return;

  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    resultEl.innerHTML = "";
    return;
  }

  const results = data.filter(
    (item) =>
      item.searchBarcodes.some((b) => b.endsWith(q)) ||
      item.searchSku.endsWith(q)
  );

  if (results.length === 0) {
    resultEl.innerHTML = `
      <div style="
        color: var(--text-color, #FFD700);
        text-align: center;
        font-weight: 500;
        margin-top: 20px;
        font-size: 1rem;
      ">
        No matching item found
      </div>`;
  } else {
    const item = results[0];
    const barcodeDisplay =
      item.barcodes.length > 1
        ? `${item.barcodes[0]} <span class='more'>…</span>`
        : item.barcodes[0];

    resultEl.innerHTML = `
      <div class="card">
        <strong>${escapeHtml(item.name)}</strong><br>
        SKU: ${escapeHtml(item.sku)}<br>
        Barcodes: <span class="barcode-list">${barcodeDisplay}</span><br><br>
        <div class="barcode-img">
          <img src="https://barcodeapi.org/api/code128/${encodeURIComponent(
            item.primaryBarcode
          )}" alt="Barcode" />
        </div>
      </div>`;
    const more = document.querySelector(".more");
    if (more) {
      more.addEventListener("click", () => {
        document.querySelector(".barcode-list").innerText =
          item.barcodes.join(", ");
      });
    }
  }
}

function loaderHTML(text) {
  return `
    <div class="loader-container">
      <div class="loader"></div>
      <div class="loader-text">${text}</div>
    </div>`;
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => {
    return (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ] || m
    );
  });
}

// Theme toggle (same as before)
const themeToggle = document.getElementById("themeToggle");
const html = document.documentElement;
const savedTheme = localStorage.getItem("theme") || "light";
html.setAttribute("data-theme", savedTheme);
themeToggle.textContent = savedTheme === "light" ? "🌙" : "☀️";
themeToggle.addEventListener("click", () => {
  const current = html.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  html.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  themeToggle.textContent = next === "light" ? "🌙" : "☀️";
});
