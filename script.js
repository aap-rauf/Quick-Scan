// ✅ Google Sheet URL
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

let data = [];
let dataReady = false;
let loadFailed = false;

// show loading animation
const resultDiv = document.getElementById("result");
resultDiv.innerHTML = `
  <div class="loader-container">
    <div class="loader"></div>
    <div class="loader-text">Loading...</div>
  </div>
`;

// 🧩 Try loading from localStorage first
const cached = localStorage.getItem("sheetData");
if (cached) {
  try {
    data = JSON.parse(cached);
    dataReady = true;
    console.log("✅ Loaded data from cache:", data.length);
    resultDiv.innerHTML = `
      <div style="text-align:center;color:var(--color-accent);font-weight:500;margin-top:20px;">
        Ready to search items (Offline)
      </div>`;
  } catch {
    console.warn("⚠️ Cache corrupted, refetching...");
  }
}

// 🧩 Fetch live data (if online)
if (navigator.onLine) {
  fetch(SHEET_URL)
    .then((res) => res.text())
    .then((txt) => {
      const json = JSON.parse(txt.substr(47).slice(0, -2));
      data = json.table.rows.map((r) => {
        const sku = r.c[0]?.v || "";
        const name = r.c[1]?.v || "";
        const barcodeCell = (r.c[2]?.v || "").trim();
        const barcodeList = barcodeCell
          .split(",")
          .map((b) => b.trim())
          .filter((b) => b);

        return {
          sku,
          name,
          barcodes: barcodeList,
          primaryBarcode: barcodeList[0] || "",
          searchSku: sku.toLowerCase(),
          searchBarcodes: barcodeList.map((b) => b.toLowerCase()),
        };
      });

      localStorage.setItem("sheetData", JSON.stringify(data)); // save to cache
      dataReady = true;

      console.log("✅ Data fetched and cached:", data.length);
      resultDiv.innerHTML = `
        <div style="text-align:center;color:var(--color-accent);font-weight:500;margin-top:20px;">
          Ready to search items
        </div>`;
    })
    .catch((err) => {
      console.error("❌ Failed to fetch:", err);
      loadFailed = true;
      if (!dataReady) showLoadError();
    });
} else if (!dataReady) {
  showOfflineError();
}

// 🔍 Handle Search
document.getElementById("searchBox").addEventListener("input", (e) => {
  if (loadFailed) return; // stop if load failed
  if (!dataReady) return; // stop if data not ready

  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    resultDiv.innerHTML = "";
    return;
  }

  const results = data.filter(
    (item) =>
      item.searchBarcodes.some((b) => b.endsWith(q)) ||
      item.searchSku.endsWith(q)
  );

  if (results.length === 0) {
    resultDiv.innerHTML = `
      <div style="color:var(--color-accent);text-align:center;font-weight:500;margin-top:20px;">
        No matching item found
      </div>`;
  } else {
    const item = results[0];
    const barcodeDisplay =
      item.barcodes.length > 1
        ? `${item.barcodes[0]} <span class="more">…</span>`
        : item.barcodes[0];

    resultDiv.innerHTML = `
      <div class="card">
        <strong>${escapeHtml(item.name)}</strong><br>
        SKU: ${escapeHtml(item.sku)}<br>
        Barcodes: <span class="barcode-list">${barcodeDisplay}</span><br><br>
        <div class="barcode-img">
          <img src="https://barcodeapi.org/api/code128/${encodeURIComponent(
            item.primaryBarcode
          )}" alt="Barcode"/>
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

// 🧩 Helper: escape HTML
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => {
    return (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ] || m
    );
  });
}

// 🧩 Helper: Show error messages
function showLoadError() {
  resultDiv.innerHTML = `
    <div style="color:var(--color-accent);text-align:center;font-weight:500;margin-top:20px;">
      Unable to load data.<br>
      Please check your internet connection.<br><br>
      <button id="reloadBtn" style="
        background: transparent;
        border: 1px solid var(--color-accent);
        color: var(--color-accent);
        border-radius: 8px;
        padding: 8px 16px;
        font-size: 15px;
        font-weight: 500;
        cursor: pointer;
        transition: 0.3s;
      ">⟳ Reload</button>
    </div>`;
  const reloadBtn = document.getElementById("reloadBtn");
  if (reloadBtn) reloadBtn.addEventListener("click", () => location.reload());
}

function showOfflineError() {
  resultDiv.innerHTML = `
    <div style="color:var(--color-accent);text-align:center;font-weight:500;margin-top:20px;">
      No internet connection and no cached data found.<br>
      Please connect and reload.
    </div>`;
}

// 🌙 Theme Toggle
const themeToggle = document.getElementById("themeToggle");
const html = document.documentElement;
const savedTheme = localStorage.getItem("theme") || "light";
html.setAttribute("data-theme", savedTheme);
themeToggle.textContent = savedTheme === "light" ? "🌙" : "☀️";

themeToggle.addEventListener("click", () => {
  const current = html.getAttribute("data-theme");
  const next = current === "light" ? "dark" : "light";
  html.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  themeToggle.textContent = next === "light" ? "🌙" : "☀️";
});

// 🔄 Optional manual refresh button
const refreshBtn = document.getElementById("refreshData");
if (refreshBtn) {
  refreshBtn.addEventListener("click", () => {
    localStorage.removeItem("sheetData");
    location.reload();
  });
}
