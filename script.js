// script.js - full replacement
// URL to fetch your sheet as JSON
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

let data = [];
let dataReady = false;
let loadFailed = false;
let progressInterval = null;

document.addEventListener("DOMContentLoaded", () => {
  const resultEl = document.getElementById("result");
  const searchBox = document.getElementById("searchBox");
  const themeToggle = document.getElementById("themeToggle");
  const reloadHeader = document.getElementById("reloadData"); // the header you added

  // If we have cached sheet data, load it immediately for instant start
  const cached = localStorage.getItem("sheetCache");
  if (cached) {
    try {
      data = JSON.parse(cached);
      dataReady = true;
      console.log("Loaded data from cache:", data.length, "rows");
      resultEl.innerHTML = `<div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">Ready to Search Items (cached)</div>`;
    } catch (e) {
      console.warn("Failed to parse cache", e);
    }
  } else {
    // show loader placeholder until we fetch first time
    showLoaderUI(resultEl);
  }

  // Always attempt to fetch fresh data in background on initial load
  loadSheetData(false).catch(() => {
    // already handled inside loadSheetData
  });

  // Clicking header triggers manual sheet refresh (only sheet, no page reload)
  if (reloadHeader) {
    reloadHeader.style.cursor = "pointer";
    reloadHeader.addEventListener("click", (e) => {
      e.preventDefault();
      loadSheetData(true); // show loader and fetch fresh data
    });
  }

  // Search handler
  searchBox.addEventListener("input", (e) => {
    if (loadFailed || !dataReady) return;

    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      resultEl.innerHTML = "";
      return;
    }

    const results = data.filter(item =>
      (item.searchBarcodes || []).some(b => b.endsWith(q)) ||
      (item.searchSku || "").endsWith(q)
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
      item.barcodes && item.barcodes.length > 1
        ? `${item.barcodes[0]} <span class='more'>…</span>`
        : (item.barcodes && item.barcodes[0]) || "";

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

    // LOCAL BARCODE GENERATION (OFFLINE) using JsBarcode
    const barcodeSvg = document.getElementById("barcodeSvg");
    if (barcodeSvg && item.primaryBarcode && typeof JsBarcode === "function") {
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

  // Theme toggle
  themeToggle.addEventListener("click", () => {
    const html = document.documentElement;
    const current = html.getAttribute("data-theme") || "light";
    const next = current === "light" ? "dark" : "light";
    html.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
    themeToggle.textContent = next === "light" ? "🌙" : "☀️";
  });

  // restore theme
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  themeToggle.textContent = savedTheme === "light" ? "🌙" : "☀️";
});

/**
 * loadSheetData(showLoader = true)
 * Fetches the sheet JSON, updates `data`, writes cache, updates UI.
 * showLoader true => show loader UI and fake progress; false => quieter update (used for background refresh).
 */
async function loadSheetData(showLoader = true) {
  const resultEl = document.getElementById("result");

  try {
    if (showLoader) showLoaderUI(resultEl);

    // start fake progress
    let progress = 0;
    const loaderFill = document.getElementById("loaderFill");
    const loaderText = document.getElementById("loaderText");
    if (loaderFill && loaderText) {
      clearInterval(progressInterval);
      progressInterval = setInterval(() => {
        if (progress < 92) {
          progress = Math.min(92, progress + Math.random() * 6);
          loaderFill.style.width = progress + "%";
          loaderText.textContent = `Loading... ${Math.floor(progress)}%`;
        }
      }, 140);
    }

    const res = await fetch(SHEET_URL);
    const txt = await res.text();
    // parse gviz response
    const json = JSON.parse(txt.substr(47).slice(0, -2));

    // map rows to objects
    const newData = json.table.rows.map((r) => {
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

    // update data and cache
    data = newData;
    localStorage.setItem("sheetCache", JSON.stringify(data));
    dataReady = true;
    loadFailed = false;

    // finish progress UI
    clearInterval(progressInterval);
    if (document.getElementById("loaderFill")) {
      document.getElementById("loaderFill").style.width = "100%";
    }
    if (document.getElementById("loaderText")) {
      document.getElementById("loaderText").textContent = "Loading... 100%";
    }

    // show brief ready message then clear or keep a small status
    setTimeout(() => {
      if (resultEl) resultEl.innerHTML = `<div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">Ready to Search Items</div>`;
    }, 260);

    console.log("Sheet loaded:", data.length, "rows");
    return data;
  } catch (err) {
    console.error("Failed to load sheet:", err);
    clearInterval(progressInterval);
    loadFailed = true;
    const loaderFill = document.getElementById("loaderFill");
    if (loaderFill) loaderFill.style.width = "100%";
    const loaderText = document.getElementById("loaderText");
    if (loaderText) loaderText.textContent = "Error!";

    const resultEl = document.getElementById("result");
    if (resultEl) {
      resultEl.innerHTML = `
        <div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">
          Unable to load.<br>
          Please check your internet connection.<br><br>
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
      if (reloadBtn) reloadBtn.addEventListener("click", () => loadSheetData(true));
    }
    throw err;
  }
}

/** Utility to show loader UI inside result area (keeps search input above) */
function showLoaderUI(resultEl) {
  if (!resultEl) return;
  resultEl.innerHTML = `
    <div class="loader-container" aria-hidden="false">
      <div class="loader-bar"><div id="loaderFill" class="loader-fill" style="width:0%"></div></div>
      <div id="loaderText" class="loader-text">Loading... 0%</div>
    </div>
  `;
}

/** Escape HTML helper */
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
