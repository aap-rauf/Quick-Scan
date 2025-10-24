// ====== CONFIG ======
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";
const CACHE_KEY = "easyScanCache";
const CACHE_TIME = 12 * 60 * 60 * 1000; // 12 hours

let data = [];
let dataReady = false;

// ====== INITIAL LOAD ======
loadSheetData();

// ====== LOAD DATA FUNCTION ======
async function loadSheetData(forceReload = false) {
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = `
    <div class="loader-container">
      <div class="loader"></div>
      <div class="loader-text">${forceReload ? "Reloading..." : "Loading..."}</div>
    </div>
  `;

  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "{}");
    const now = Date.now();
    const expired = !cached.timestamp || now - cached.timestamp > CACHE_TIME;

    if (cached.data && !forceReload && !expired) {
      console.log("Loaded from cache", cached.data.length);
      data = cached.data;
      dataReady = true;
      showReadyMessage("(cached)");
      return;
    }

    // fetch new data
    const res = await fetch(SHEET_URL);
    const txt = await res.text();
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

    console.log("Loaded fresh data", data.length);
    dataReady = true;
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({ timestamp: now, data })
    );

    showReadyMessage("(fresh)");
  } catch (err) {
    console.error("Failed to load sheet:", err);
    document.getElementById("result").innerHTML = `
      <div style="
        color: var(--text-color, #FFD700);
        text-align: center;
        font-weight: 500;
        margin-top: 20px;
      ">
        Unable to load data.<br>
        Please check your network connection and reopen the app.
      </div>`;
  }
}

function showReadyMessage(source) {
  document.getElementById("result").innerHTML = `
    <div style="
      text-align: center;
      color: var(--text-color,#FFD700);
      font-weight: 500;
      margin-top: 20px;
      letter-spacing: 0.5px;
    ">
      Ready to search items ${source}
    </div>`;
}

// ====== SEARCH ======
document.getElementById("searchBox").addEventListener("input", onSearchInput);

function onSearchInput(e) {
  if (!dataReady) {
    document.getElementById("result").innerHTML = `
      <div class="loader-container">
        <div class="loader"></div>
        <div class="loader-text">Please wait, loading data...</div>
      </div>`;
    return;
  }

  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    document.getElementById("result").innerHTML = "";
    return;
  }

  const results = data.filter(
    (item) =>
      item.searchBarcodes.some((b) => b.endsWith(q)) ||
      item.searchSku.endsWith(q)
  );

  if (results.length === 0) {
    document.getElementById("result").innerHTML = `
      <div style="
        color: var(--text-color, #FFD700);
        text-align: center;
        font-weight: 500;
        margin-top: 20px;
        letter-spacing: 0.5px;
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

    document.getElementById("result").innerHTML = `
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

// ====== ESCAPE HELPER ======
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (m) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
  );
}

// ====== THEME TOGGLE ======
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

// ====== RELOAD ON EASY SCAN TAP ======
document.getElementById("reloadApp").addEventListener("click", () => {
  loadSheetData(true);
});
