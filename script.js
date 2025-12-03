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
        <div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">
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

  /* ============================
   SEARCH HISTORY SYSTEM
   ============================ */

let historyData = JSON.parse(localStorage.getItem("searchHistory") || "[]");
let typingTimer; 

const historySheet = document.getElementById("historySheet");
const historyList = document.getElementById("historyList");

// Render history items
function renderHistory() {
  historyList.innerHTML = "";

  historyData.forEach((h, index) => {
    const div = document.createElement("div");
    div.className = "history-item";

    div.innerHTML = `
      <div class="history-text">
        <strong>${escapeHtml(h.text)}</strong><br>
        <span style="font-size:13px;opacity:0.7">${escapeHtml(h.name)}</span>
      </div>
      <button class="delete-history" data-index="${index}">×</button>
    `;

    historyList.appendChild(div);
  });

  document.querySelectorAll(".delete-history").forEach(btn => {
    btn.addEventListener("click", e => {
      const i = e.target.getAttribute("data-index");
      historyData.splice(i, 1);
      localStorage.setItem("searchHistory", JSON.stringify(historyData));
      renderHistory();
    });
  });
}

// Open sheet
function openHistory() {
  historySheet.style.bottom = "0";
}

// Close sheet
function closeHistory() {
  historySheet.style.bottom = "-70%";
}

/* =====================================================
   DRAGGABLE BOTTOM SHEET (REAL DRAG WITH FINGER)
   ===================================================== */

let dragStartY = 0;
let sheetStartY = 0;
let isDragging = false;

const sheetHeight = window.innerHeight * 0.70; // your sheet is 70%
let currentBottom = -sheetHeight;

// Set initial position
historySheet.style.bottom = currentBottom + "px";

// Apply smooth animation when NOT dragging
historySheet.style.transition = "bottom 0.28s ease";

/* Helper functions */
function openHistory() {
  currentBottom = 0;
  historySheet.style.transition = "bottom 0.28s ease";
  historySheet.style.bottom = "0px";
}

function closeHistory() {
  currentBottom = -sheetHeight;
  historySheet.style.transition = "bottom 0.28s ease";
  historySheet.style.bottom = currentBottom + "px";
}

/* Start drag */
historySheet.addEventListener("touchstart", e => {
  dragStartY = e.touches[0].clientY;
  sheetStartY = historySheet.getBoundingClientRect().bottom;
  isDragging = true;

  // Disable animation while dragging
  historySheet.style.transition = "none";
});

/* Dragging */
historySheet.addEventListener("touchmove", e => {
  if (!isDragging) return;

  const currentY = e.touches[0].clientY;
  const diff = dragStartY - currentY;

  let newBottom = currentBottom + diff;

  // Limit drag area
  if (newBottom > 0) newBottom = 0;
  if (newBottom < -sheetHeight) newBottom = -sheetHeight;

  historySheet.style.bottom = newBottom + "px";
});

/* Release */
historySheet.addEventListener("touchend", e => {
  isDragging = false;

  const endY = e.changedTouches[0].clientY;
  const dragDistance = dragStartY - endY;

  // Decide open or close based on drag
  if (dragDistance > 80) {
    openHistory();
  } else if (dragDistance < -80) {
    closeHistory();
  } else {
    // Return to original position if small pull
    currentBottom > -sheetHeight / 2 ? openHistory() : closeHistory();
  }
});

// ============= SAVE HISTORY AFTER 2 SEC STOP TYPING ==============

// Modify your searchBox input handler:

searchBox.addEventListener("input", () => {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(saveSearchHistory, 2000);
});

function saveSearchHistory() {
  const q = searchBox.value.trim().toLowerCase();
  if (!q) return;

  // Find item
  const match = data.find(item =>
    item.searchBarcodes.some(b => b.endsWith(q)) ||
    item.searchSku.endsWith(q)
  );

  if (!match) return;

  // Prevent duplicates
  historyData = historyData.filter(h => h.text !== q);

  // Add new entry
  historyData.unshift({
    text: q,
    name: match.name
  });

  // Limit history
  if (historyData.length > 30) historyData.pop();

  // Save
  localStorage.setItem("searchHistory", JSON.stringify(historyData));

  // Update UI
  renderHistory();
}

// Load saved history on startup
renderHistory();
  
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
