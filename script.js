// URL to fetch your sheet as JSON
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

let data = [];
let dataReady = false;
let loadFailed = false;
let progressInterval;

document.addEventListener("DOMContentLoaded", () => {
  const resultEl = document.getElementById("result");
  const searchBox = document.getElementById("searchBox");
  const themeToggle = document.getElementById("themeToggle");
  const headerTitle = document.querySelector("header h1"); // TAP TO RELOAD SHEET

  // ================================================================
  // 🔄 FUNCTION: LOAD SHEET (used at start + used on Easy Scan tap)
  // ================================================================
  function loadSheetData() {
    dataReady = false;
    loadFailed = false;

    // Show loader inside result area
    resultEl.innerHTML = `
      <div class="loader-container">
        <div class="loader-bar">
          <div id="loaderFill" class="loader-fill"></div>
        </div>
        <div id="loaderText" class="loader-text">Loading... 0%</div>
      </div>
    `;

    const loaderFill = document.getElementById("loaderFill");
    const loaderText = document.getElementById("loaderText");

    // Fake progress
    let progress = 0;
    clearInterval(progressInterval);

    progressInterval = setInterval(() => {
      if (progress < 92) {
        progress += Math.random() * 6;
        loaderFill.style.width = progress + "%";
        loaderText.textContent = `Loading... ${Math.floor(progress)}%`;
      }
    }, 140);

    // Fetch sheet
    fetch(SHEET_URL)
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

        // Finish loading
        clearInterval(progressInterval);
        loaderFill.style.width = "100%";
        loaderText.textContent = "Loading... 100%";

        dataReady = true;

        setTimeout(() => {
          resultEl.innerHTML = `
            <div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">
              Ready to Search Items
            </div>
          `;
        }, 260);
      })

      // ERROR HANDLING
      .catch(err => {
        console.error("Failed to load sheet:", err);
        clearInterval(progressInterval);
        loadFailed = true;

        resultEl.innerHTML = `
          <div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">
            Unable to load.<br>
            Please check your connection.<br><br>
            <button id="reloadBtn" style="
              background: transparent;
              border: 1px solid var(--color-accent);
              color: var(--color-accent);
              border-radius: 8px;
              padding: 8px 16px;
              font-size: 15px;
              font-weight: 600;
              cursor: pointer;
            ">⟳ Reload</button>
          </div>
        `;

        const btn = document.getElementById("reloadBtn");
        if (btn) btn.addEventListener("click", loadSheetData);
      });
  }

  // ================================================================
  // 🔄 TAP EASY SCAN HEADER → Reload Sheet Only (NO page reload)
  // ================================================================
  headerTitle.addEventListener("click", loadSheetData);

  // Load once on startup
  loadSheetData();

  // ================================================================
  // SEARCH BAR
  // ================================================================
  searchBox.addEventListener("input", (e) => {
    if (!dataReady || loadFailed) return;

    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      resultEl.innerHTML = "";
      return;
    }

    const results = data.filter(item =>
      item.searchSku.endsWith(q) ||
      item.searchBarcodes.some(b => b.endsWith(q))
    );

    if (results.length === 0) {
      resultEl.innerHTML = `
        <div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">
          No matching item found
        </div>`;
      return;
    }

    const item = results[0];
    const barcodeDisplay =
      item.barcodes.length > 1
        ? `${item.barcodes[0]} <span class="more">…</span>`
        : item.barcodes[0];

    resultEl.innerHTML = `
      <div class="card">
        <strong>${escapeHtml(item.name)}</strong><br>
        SKU: ${escapeHtml(item.sku)}<br>
        Barcodes: <span class="barcode-list">${barcodeDisplay}</span><br><br>

        <div class="barcode-img">
          <svg id="barcodeSvg"></svg>
        </div>
      </div>
    `;

    // Expand all barcodes on tap
    const more = document.querySelector(".more");
    if (more) {
      more.addEventListener("click", () => {
        const list = document.querySelector(".barcode-list");
        list.innerText = item.barcodes.join(", ");
      });
    }

    // Generate local barcode
    const svg = document.getElementById("barcodeSvg");
    if (svg && item.primaryBarcode) {
      JsBarcode(svg, item.primaryBarcode, {
        format: "code128",
        lineColor: "#000",
        width: 2.2,
        height: 100,
        displayValue: false,
        margin: 8
      });
    }
  });

  // ================================================================
  // THEME TOGGLE
  // ================================================================
  themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    const current = html.getAttribute("data-theme");
    const next = current === "light" ? "dark" : "light";
    html.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    themeToggle.textContent = next === "light" ? "🌙" : "☀️";
  });

  // Restore theme
  const saved = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", saved);
  themeToggle.textContent = saved === "light" ? "🌙" : "☀️";
});

// Escape HTML
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, m =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])
  );
}
