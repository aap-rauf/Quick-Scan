// ✅ Google Sheet URL
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

const CACHE_KEY = "easyScanSheetCache_v2";
let data = [];
let dataReady = false;
let loadFailed = false;

const resultEl = document.getElementById("result");
const searchBox = document.getElementById("searchBox");

// initial loader
resultEl.innerHTML = loaderHTML("Loading...");

// Try loading cached data first
loadFromCache();

// Try background refresh silently
refreshSheetInBackground();

// ------------------------
// FUNCTIONS
// ------------------------
function loadFromCache() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        data = parsed;
        dataReady = true;
        console.log("Loaded from cache ✅", data.length, "rows");
        resultEl.innerHTML = `
          <div style="text-align:center;color:var(--text-color,#FFD700);font-weight:500;margin-top:20px;">
            Ready to search items (cached)
          </div>`;
        return;
      }
    }
  } catch (err) {
    console.warn("Cache error:", err);
  }

  // If no valid cache, fetch fresh data
  fetchSheet();
}

function fetchSheet() {
  resultEl.innerHTML = loaderHTML("Fetching data...");
  fetch(SHEET_URL)
    .then((res) => res.text())
    .then((txt) => {
      // Fix for Google gviz format (starts with "/*O_o*/")
      const start = txt.indexOf("{");
      const end = txt.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("Invalid sheet data");
      const json = JSON.parse(txt.substring(start, end + 1));

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

      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      console.log("Fetched & cached ✅", data.length, "rows");
      dataReady = true;
      resultEl.innerHTML = `
        <div style="text-align:center;color:var(--text-color,#FFD700);font-weight:500;margin-top:20px;">
          Ready to search items
        </div>`;
    })
    .catch((err) => {
      console.error("Fetch failed:", err);
      loadFailed = true;
      resultEl.innerHTML = `
        <div style="color:var(--text-color,#FFD700);text-align:center;margin-top:20px;">
          Unable to load data.<br>Please check your connection.<br><br>
          <button id="reloadBtn" style="
            background:transparent;
            border:1px solid var(--text-color,#FFD700);
            color:var(--text-color,#FFD700);
            border-radius:8px;
            padding:8px 16px;
            cursor:pointer;
          ">⟳ Reload</button>
        </div>`;
      document.getElementById("reloadBtn").addEventListener("click", () => {
        resultEl.innerHTML = loaderHTML("Reloading...");
        fetchSheet();
      });
    });
}

// Background refresh after load
function refreshSheetInBackground() {
  fetch(SHEET_URL)
    .then((res) => res.text())
    .then((txt) => {
      const start = txt.indexOf("{");
      const end = txt.lastIndexOf("}");
      if (start === -1 || end === -1) return;
      const json = JSON.parse(txt.substring(start, end + 1));

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

// Handle Easy Scan → force reload from sheet
const easyScanBtn = document.getElementById("easyScan");
if (easyScanBtn) {
  easyScanBtn.addEventListener("click", () => {
    resultEl.innerHTML = loaderHTML("Refreshing...");
    fetchSheet();
  });
}

// ------------------------
// SEARCH
// ------------------------
searchBox.addEventListener("input", (e) => {
  if (loadFailed || !dataReady) return;

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
      <div style="color:var(--text-color,#FFD700);text-align:center;margin-top:20px;font-weight:500;">
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
});

// ------------------------
// HELPERS
// ------------------------
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

// ------------------------
// THEME TOGGLE
// ------------------------
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
