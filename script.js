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
document.getElementById("refreshDataButton").addEventListener("click", () => {
  reloadSheetData();
});
  // Loader UI
  resultEl.innerHTML = `
    <div class="loader-container" aria-hidden="false">
      <div class="loader-bar"><div id="loaderFill" class="loader-fill" style="width:0%"></div></div>
      <div id="loaderText" class="loader-text">Loading... 0%</div>
    </div>
  `;
  const loaderFill = document.getElementById("loaderFill");
  const loaderText = document.getElementById("loaderText");

  // Fake progress
  let progress = 0;
  progressInterval = setInterval(() => {
    if (progress < 92) {
      progress = Math.min(92, progress + Math.random() * 6);
      loaderFill.style.width = progress + "%";
      loaderText.textContent = `Loading... ${Math.floor(progress)}%`;
    }
  }, 140);

  // Fetch Sheet
  fetch(SHEET_URL)
    .then(res => res.text())
    .then(txt => {
      const json = JSON.parse(txt.substr(47).slice(0, -2));

      data = json.table.rows.map((r) => {
        const skuOriginal = r.c[0]?.v || "";
        const nameOriginal = r.c[1]?.v || "";
        const barcodeCell = (r.c[2]?.v || "").toString().trim();
        const barcodeList = barcodeCell ? barcodeCell.split(",").map(b => b.trim()).filter(Boolean) : [];

        return {
          sku: skuOriginal,
          name: nameOriginal,
          barcodes: barcodeList,
          primaryBarcode: barcodeList[0] || "",
          searchSku: skuOriginal.toLowerCase(),
          searchBarcodes: barcodeList.map(b => b.toLowerCase()),
        };
      });

      clearInterval(progressInterval);
      loaderFill.style.width = "100%";
      loaderText.textContent = "Loading... 100%";
      dataReady = true;

      setTimeout(() => {
        resultEl.innerHTML = `<div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">Ready to Search</div>`;
      }, 260);
    })
    .catch(err => {
      console.error("Loading Failed.:", err);
      clearInterval(progressInterval);
      loadFailed = true;
      loaderFill.style.width = "100%";
      loaderText.textContent = "Error!";
      resultEl.innerHTML = `
        <div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">
          Loading Failed,<br>
          Check your Network Connection.<br><br>
          <button id="reloadBtn" style="
            background: transparent;
            border: 1px solid var(--color-accent);
            color: var(--color-accent);
            border-radius: 8px;
            padding: 8px 16px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: 0.2s;
          ">⟳ Reload</button>
        </div>
      `;
      const reloadBtn = document.getElementById("reloadBtn");
      if (reloadBtn) reloadBtn.addEventListener("click", () => location.reload());
    });
  function reloadSheetData() {
  const resultEl = document.getElementById("result");

  // Show loader again
  resultEl.innerHTML = `
    <div class="loader-container">
      <div class="loader-bar">
        <div id="loaderFill" class="loader-fill" style="width:0%"></div>
      </div>
      <div id="loaderText" class="loader-text">Refreshing... 0%</div>
    </div>
  `;

  let loaderFill = document.getElementById("loaderFill");
  let loaderText = document.getElementById("loaderText");

  let progress = 0;
  let interval = setInterval(() => {
    if (progress < 93) {
      progress += Math.random() * 6;
      loaderFill.style.width = progress + "%";
      loaderText.textContent = `Refreshing... ${Math.floor(progress)}%`;
    }
  }, 130);

  // Fetch fresh data from Google Sheet
  fetch(SHEET_URL + "&nocache=" + Date.now())  // prevent caching
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

      clearInterval(interval);
      loaderFill.style.width = "100%";
      loaderText.textContent = "Refreshing... 100%";

      setTimeout(() => {
        resultEl.innerHTML = `
          <div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">
            Refreshed — Ready to Search
          </div>
        `;
      }, 260);
    })
    .catch(err => {
      console.error("Refresh failed:", err);
      resultEl.innerHTML = `
        <div style="text-align:center;color:red;margin-top:8px;">
          Failed to Refresh.
        </div>
      `;
    });
}

  // SEARCH =====================================================================
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
      resultEl.innerHTML = `
        <div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">
          Not Found
        </div>`;
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
        <div class="barcode-img">
          <svg id="barcodeSvg"></svg>
        </div>
      </div>
    `;

    // CLICK TO EXPAND ALL BARCODES
    const more = document.querySelector(".more");
    if (more) {
      more.addEventListener("click", () => {
        const list = document.querySelector(".barcode-list");
        if (list) list.innerText = item.barcodes.join(", ");
      });
    }

    // LOCAL BARCODE GENERATION (OFFLINE)
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

  // THEME TOGGLE ===============================================================
  themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    const current = html.getAttribute("data-theme");
    const next = current === "light" ? "dark" : "light";
    html.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    themeToggle.textContent = next === "light" ? "🌙" : "☀️";
  });

  // RESTORE THEME
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  themeToggle.textContent = savedTheme === "light" ? "🌙" : "☀️";
});

// Escape HTML
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, function (m) {
    return ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[m] || m);
  });
}
