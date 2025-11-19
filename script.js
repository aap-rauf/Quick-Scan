// URL to fetch your sheet as JSON
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

let data = [];
let dataReady = false;
let loadFailed = false;
let progressInterval;
let loaderFill, loaderText, resultEl, searchBox, themeToggle;

// ===============================================================
// FUNCTION: Load Google Sheet Data (used on startup + header tap)
// ===============================================================
function loadSheetData() {
  dataReady = false;
  loadFailed = false;

  // Loader UI
  resultEl.innerHTML = `
    <div class="loader-container" aria-hidden="false">
      <div class="loader-bar"><div id="loaderFill" class="loader-fill" style="width:0%"></div></div>
      <div id="loaderText" class="loader-text">Loading... 0%</div>
    </div>
  `;

  loaderFill = document.getElementById("loaderFill");
  loaderText = document.getElementById("loaderText");

  // Fake loading % animation
  let progress = 0;
  clearInterval(progressInterval);
  progressInterval = setInterval(() => {
    if (progress < 92) {
      progress = Math.min(92, progress + Math.random() * 6);
      loaderFill.style.width = progress + "%";
      loaderText.textContent = `Loading... ${Math.floor(progress)}%`;
    }
  }, 140);

  // Fetch sheet ------------------------------
  fetch(SHEET_URL, { cache: "no-store" })   // ⬅️ IMPORTANT: skip browser cache
    .then(res => res.text())
    .then(txt => {
      const json = JSON.parse(txt.substr(47).slice(0, -2));

      data = json.table.rows.map((r) => {
        const skuOriginal = r.c[0]?.v || "";
        const nameOriginal = r.c[1]?.v || "";
        const barcodeCell = (r.c[2]?.v || "").toString().trim();
        const barcodeList = barcodeCell
          ? barcodeCell.split(",").map(b => b.trim()).filter(Boolean)
          : [];

        return {
          sku: skuOriginal,
          name: nameOriginal,
          barcodes: barcodeList,
          primaryBarcode: barcodeList[0] || "",
          searchSku: skuOriginal.toLowerCase(),
          searchBarcodes: barcodeList.map(b => b.toLowerCase()),
        };
      });

      // Finish loader
      clearInterval(progressInterval);
      loaderFill.style.width = "100%";
      loaderText.textContent = "Loading... 100%";
      dataReady = true;

      setTimeout(() => {
        resultEl.innerHTML =
          `<div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">Sheet Updated ✓</div>`;
      }, 200);
    })
    .catch(err => {
      console.error("Failed:", err);

      clearInterval(progressInterval);
      loadFailed = true;
      loaderFill.style.width = "100%";
      loaderText.textContent = "Error!";

      resultEl.innerHTML = `
        <div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">
          Unable to load.<br>Check internet.<br><br>
          <button id="retrySheet" style="
            background: transparent;
            border: 1px solid var(--color-accent);
            color: var(--color-accent);
            border-radius: 8px;
            padding: 8px 16px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
          ">⟳ Retry</button>
        </div>
      `;

      document.getElementById("retrySheet")
        .addEventListener("click", loadSheetData);
    });
}

// ===============================================================
// INIT APP
// ===============================================================
document.addEventListener("DOMContentLoaded", () => {
  resultEl = document.getElementById("result");
  searchBox = document.getElementById("searchBox");
  themeToggle = document.getElementById("themeToggle");

  // Load sheet immediately on startup
  loadSheetData();

  // Tap header to reload sheet (NOT whole app)
  document.getElementById("reloadData").addEventListener("click", () => {
    loadSheetData();
  });

  // SEARCH -------------------------------------------------------
  searchBox.addEventListener("input", (e) => {
    if (loadFailed || !dataReady) return;

    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      resultEl.innerHTML = "";
      return;
    }

    const results = data.filter(item =>
      item.searchBarcodes.some(b => b.endsWith(q)) ||
      item.searchSku.endsWith(q)
    );

    if (results.length === 0) {
      resultEl.innerHTML =
        `<div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">No matching item found</div>`;
      return;
    }

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
        <div class="barcode-img"><svg id="barcodeSvg"></svg></div>
      </div>
    `;

    const more = document.querySelector(".more");
    if (more)
      more.addEventListener("click", () =>
        (document.querySelector(".barcode-list").innerText =
          item.barcodes.join(", "))
      );

    // Offline Barcode Generator
    const barcodeSvg = document.getElementById("barcodeSvg");
    if (barcodeSvg && item.primaryBarcode) {
      JsBarcode(barcodeSvg, item.primaryBarcode, {
        format: "code128",
        lineColor: "#000",
        width: 2.2,
        height: 100,
        displayValue: false,
        margin: 8
      });
    }
  });

  // THEME --------------------------------------------------------
  themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    const current = html.getAttribute("data-theme");
    const next = current === "light" ? "dark" : "light";
    html.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    themeToggle.textContent = next === "light" ? "🌙" : "☀️";
  });

  // RESTORE SAVED THEME
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  themeToggle.textContent = savedTheme === "light" ? "🌙" : "☀️";
});

// HTML escape helper
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[m]));
}
