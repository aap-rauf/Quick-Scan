// =============================
// ⚡ EASY SCAN APP (iOS SAFE + FAST)
// =============================

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

let data = [];
let dataReady = false;
let loadFailed = false;
const CACHE_KEY = "sheetCache_v2";

const resultEl = document.getElementById("result");

// Show loading
resultEl.innerHTML = `
  <div class="loader-container">
    <div class="loader"></div>
    <div class="loader-text">Loading...</div>
  </div>
`;

// -----------------------------
// Load sheet with cache + fallback
// -----------------------------
async function loadSheet() {
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      data = JSON.parse(cached);
      dataReady = true;
      showReady();
      console.log("Loaded from cache:", data.length);
    } catch (e) {
      console.warn("Bad cache:", e);
      localStorage.removeItem(CACHE_KEY);
    }
  }

  try {
    const res = await fetch(SHEET_URL, { cache: "no-store" });
    const txt = await res.text();

    // Fix for iOS blank fetches
    if (!txt || !txt.startsWith("/*O_o*/")) throw new Error("Invalid data");

    const json = JSON.parse(txt.substr(47).slice(0, -2));
    const rows = json.table.rows || [];

    const fresh = rows.map((r) => {
      const sku = r.c[0]?.v || "";
      const name = r.c[1]?.v || "";
      const barcodeCell = (r.c[2]?.v || "").trim();
      const barcodes = barcodeCell
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean);

      return {
        sku,
        name,
        barcodes,
        primaryBarcode: barcodes[0] || "",
        searchSku: sku.toLowerCase(),
        searchBarcodes: barcodes.map((b) => b.toLowerCase()),
      };
    });

    if (fresh.length > 0) {
      data = fresh;
      localStorage.setItem(CACHE_KEY, JSON.stringify(fresh));
      dataReady = true;
      showReady();
      console.log("Fetched fresh:", data.length);
    } else {
      throw new Error("Empty sheet");
    }
  } catch (err) {
    console.error("Load failed:", err);
    if (!dataReady) showError();
    loadFailed = true;
  }
}

loadSheet();

// -----------------------------
// Show ready message
// -----------------------------
function showReady() {
  resultEl.innerHTML = `
    <div style="text-align:center;color:var(--text-color,#FFD700);font-weight:500;margin-top:20px;">
      Ready to search items
    </div>
  `;
}

// -----------------------------
// Show error message
// -----------------------------
function showError() {
  resultEl.innerHTML = `
    <div style="color:var(--text-color,#FFD700);text-align:center;font-weight:500;margin-top:20px;">
      Unable to load data.<br>
      Please check your internet connection and try again.<br><br>
      <button id="reloadBtn" style="
        background:transparent;
        border:1px solid var(--text-color,#FFD700);
        color:var(--text-color,#FFD700);
        border-radius:8px;
        padding:8px 16px;
        font-size:15px;
        font-weight:500;
        cursor:pointer;
      ">⟳ Reload</button>
    </div>
  `;
  document.getElementById("reloadBtn").addEventListener("click", () => {
    localStorage.removeItem(CACHE_KEY);
    resultEl.innerHTML = `
      <div class="loader-container">
        <div class="loader"></div>
        <div class="loader-text">Reloading...</div>
      </div>`;
    loadSheet();
  });
}

// -----------------------------
// Search logic
// -----------------------------
document.getElementById("searchBox").addEventListener("input", (e) => {
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
      <div style="
        color:var(--text-color,#FFD700);
        text-align:center;
        font-weight:500;
        margin-top:20px;
        font-size:1rem;
      ">No matching item found</div>
    `;
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
      </div>
    `;

    const more = document.querySelector(".more");
    if (more)
      more.addEventListener("click", () => {
        document.querySelector(".barcode-list").innerText =
          item.barcodes.join(", ");
      });
  }
});

// -----------------------------
// Escape HTML
// -----------------------------
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => {
    return (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ] || m
    );
  });
}

// -----------------------------
// Theme toggle
// -----------------------------
const themeToggle = document.getElementById("themeToggle");
const html = document.documentElement;
const saved = localStorage.getItem("theme") || "light";

html.setAttribute("data-theme", saved);
themeToggle.textContent = saved === "light" ? "🌙" : "☀️";

themeToggle.addEventListener("click", () => {
  const next = html.getAttribute("data-theme") === "light" ? "dark" : "light";
  html.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  themeToggle.textContent = next === "light" ? "🌙" : "☀️";
});
