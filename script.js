// URL to fetch your sheet as JSON
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

let data = [];
let dataReady = false;

const resultBox = document.getElementById("result");
const CACHE_KEY = "sheetCache";
const CACHE_TIME_KEY = "sheetCacheTime";
const CACHE_VALID_MS = 6 * 60 * 60 * 1000; // 6 hours cache validity

// show loader
resultBox.innerHTML = `
  <div class="loader-container">
    <div class="loader"></div>
    <div class="loader-text">Loading...</div>
  </div>
`;

// Load data (from cache if valid)
loadSheetData();

async function loadSheetData(force = false) {
  const now = Date.now();
  const cachedData = localStorage.getItem(CACHE_KEY);
  const cachedTime = localStorage.getItem(CACHE_TIME_KEY);

  // ✅ Use cached data if it's not expired
  if (!force && cachedData && cachedTime && now - cachedTime < CACHE_VALID_MS) {
    data = JSON.parse(cachedData);
    dataReady = true;
    console.log("Loaded data from cache");
    resultBox.innerHTML = `<div style="text-align:center;color:#FFD700;">Ready to search items (cached)</div>`;
    return;
  }

  console.log("Fetching fresh data...");
  try {
    const res = await fetch(SHEET_URL);
    const txt = await res.text();
    const json = JSON.parse(txt.substr(47).slice(0, -2));

    data = json.table.rows.map((r) => {
      const barcodeCell = (r.c[2]?.v || "").trim();
      const barcodeList = barcodeCell
        .split(",")
        .map((b) => b.trim())
        .filter((b) => b);

      return {
        sku: r.c[0]?.v || "",
        name: r.c[1]?.v || "",
        barcodes: barcodeList,
        primaryBarcode: barcodeList[0] || "",
      };
    });

    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_TIME_KEY, now);

    dataReady = true;
    console.log("Fetched fresh data:", data.length, "rows");
    resultBox.innerHTML = `<div style="text-align:center;color:#FFD700;">Ready to search items</div>`;
  } catch (err) {
    console.error("Failed to load sheet:", err);
    resultBox.innerText = "Unable to fetch data.";
  }
}

// Live search
document.getElementById("searchBox").addEventListener("input", onSearchInput);

function onSearchInput(e) {
  if (!dataReady) {
    resultBox.innerHTML = `
      <div class="loader-container">
        <div class="loader"></div>
        <div class="loader-text">Please wait, loading data...</div>
      </div>`;
    return;
  }

  const q = e.target.value.trim();
  if (!q) {
    resultBox.innerHTML = "";
    return;
  }

  const results = data.filter(
    (item) =>
      item.barcodes.some((b) => b.endsWith(q)) ||
      (item.sku && item.sku.toString().endsWith(q))
  );

  if (results.length === 0) {
    resultBox.innerHTML = "No item found";
  } else {
    const item = results[0];
    const barcodeDisplay =
      item.barcodes.length > 1
        ? `${item.barcodes[0]} <span class='more'>…</span>`
        : item.barcodes[0];

    resultBox.innerHTML = `
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
    if (more) {
      more.addEventListener("click", () => {
        document.querySelector(".barcode-list").innerText =
          item.barcodes.join(", ");
      });
    }
  }
}

function showFullDetails(item) {
  const allBarcodes = item.barcodes.join(", ");
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="card expanded">
      <strong>${escapeHtml(item.name)}</strong><br>
      SKU: ${escapeHtml(item.sku)}<br>
      Barcodes: ${escapeHtml(allBarcodes)}<br><br>
      <div class="barcode-img">
        <img src="https://barcodeapi.org/api/code128/${encodeURIComponent(
          item.primaryBarcode
        )}" alt="Barcode" />
      </div>
    </div>
  `;
  document.getElementById("result").appendChild(overlay);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
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

// Dark / Light theme toggle with memory
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
