// ====================== script.js ======================

// URL to fetch your sheet as JSON
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

const CACHE_KEY = "easyScanCache";
const CACHE_EXPIRY_HOURS = 12; // refresh every 12h

let data = [];
let dataReady = false;
let loadFailed = false;

const resultEl = document.getElementById("result");

// Show initial loader
resultEl.innerHTML = `
  <div class="loader-container">
    <div class="loader"></div>
    <div class="loader-text">Loading...</div>
  </div>
`;

// Try loading cached data
loadFromCache();

// Then refresh data (in background)
fetchSheetData();

// ================== FUNCTIONS ==================

// Load from cache first for instant start
function loadFromCache() {
  const cached = localStorage.getItem(CACHE_KEY);
  if (!cached) return;
  try {
    const { data: cachedData, time } = JSON.parse(cached);
    if (Date.now() - time > CACHE_EXPIRY_HOURS * 60 * 60 * 1000) {
      console.log("Cache expired, refreshing...");
      return;
    }
    data = cachedData;
    dataReady = true;
    showReadyMessage("cached");
    console.log("Loaded from cache", data.length, "rows");
  } catch (e) {
    console.warn("Cache error:", e);
  }
}

// Fetch from Google Sheets (slow but background)
async function fetchSheetData() {
  try {
    const res = await fetch(SHEET_URL, { cache: "no-store" });
    const txt = await res.text();
    const json = JSON.parse(txt.substr(47).slice(0, -2));

    data = json.table.rows.map((r) => {
      const sku = r.c[0]?.v || "";
      const name = r.c[1]?.v || "";
      const barcodeCell = (r.c[2]?.v || "").trim();
      const barcodeList = barcodeCell
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean);

      return {
        sku,
        name,
        barcodes: barcodeList,
        searchSku: sku.toLowerCase(),
        searchBarcodes: barcodeList.map((b) => b.toLowerCase()),
      };
    });

    dataReady = true;
    loadFailed = false;
    showReadyMessage("fresh");

    // Cache the data
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ data, time: Date.now() })
    );

    console.log("Fetched fresh data", data.length, "rows");
  } catch (err) {
    console.error("Failed to fetch:", err);
    if (!dataReady) {
      showErrorMessage();
      loadFailed = true;
    } else {
      console.log("Using cached data (refresh failed)");
    }
  }
}

// Show messages
function showReadyMessage(source) {
  resultEl.innerHTML = `
    <div style="text-align:center;color:#FFD700;font-weight:500;margin-top:20px;">
      Ready to search items (${source})
    </div>`;
}

function showErrorMessage() {
  resultEl.innerHTML = `
    <div style="
      color: #FFD700;
      text-align: center;
      font-weight: 500;
      margin-top: 20px;
    ">
      Unable to load data.<br>
      Please check your internet connection.<br><br>
      <button id="reloadBtn" style="
        background: transparent;
        border: 1px solid #FFD700;
        color: #FFD700;
        border-radius: 8px;
        padding: 8px 16px;
        font-size: 15px;
        font-weight: 500;
        cursor: pointer;
      ">⟳ Reload</button>
    </div>`;
  document.getElementById("reloadBtn").addEventListener("click", () => {
    resultEl.innerHTML = `
      <div class="loader-container">
        <div class="loader"></div>
        <div class="loader-text">Reloading...</div>
      </div>`;
    fetchSheetData();
  });
}

// SEARCH logic
document.getElementById("searchBox").addEventListener("input", (e) => {
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

  if (!results.length) {
    resultEl.innerHTML = `
      <div style="color:#FFD700;text-align:center;font-weight:500;margin-top:20px;">
        No matching item found
      </div>`;
  } else {
    const item = results[0];
    const primary = item.barcodes[0] || "";
    const displayBarcode =
      item.barcodes.length > 1
        ? `${item.barcodes[0]} <span class='more'>…</span>`
        : item.barcodes[0];

    resultEl.innerHTML = `
      <div class="card">
        <strong>${escapeHtml(item.name)}</strong><br>
        SKU: ${escapeHtml(item.sku)}<br>
        Barcodes: <span class="barcode-list">${displayBarcode}</span><br><br>
        <div class="barcode-img">
          <img src="https://barcodeapi.org/api/code128/${encodeURIComponent(
            primary
          )}" alt="Barcode" />
        </div>
      </div>
    `;

    const more = document.querySelector(".more");
    if (more) {
      more.addEventListener("click", () => {
        document.querySelector(".barcode-list").innerText =
          item.barcodes.join(", ");
      });
    }
  }
});

// Escape HTML
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => {
    return (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ] || m
    );
  });
}
