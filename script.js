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

/* ============================
   SEARCH HISTORY SYSTEM
   ============================ */

let historyData = JSON.parse(localStorage.getItem("searchHistory") || "[]");
let typingTimer;
const historySheet = document.getElementById("historySheet");
const historyList = document.getElementById("historyList");
const dragZone = document.getElementById("historyDragZone");

let isDragging = false;
let dragStartY = 0;
let sheetHeight = window.innerHeight * 0.70;
let currentBottom = -sheetHeight;

// Initial position
historySheet.style.bottom = currentBottom + "px";

function renderHistory() {
  historyList.innerHTML = "";

  historyData.forEach((h, i) => {
    let row = document.createElement("div");
    row.className = "history-item";

    row.innerHTML = `
      <div>
        <strong>${escapeHtml(h.text)}</strong><br>
        <span style="font-size:13px;opacity:0.7">${escapeHtml(h.name)}</span>
      </div>
      <button class="delete-history" data-i="${i}">×</button>
    `;

    historyList.appendChild(row);
  });

  document.querySelectorAll(".delete-history").forEach(btn => {
    btn.addEventListener("click", e => {
      let i = e.target.dataset.i;
      historyData.splice(i, 1);
      localStorage.setItem("searchHistory", JSON.stringify(historyData));
      renderHistory();
    });
  });
}

function openHistory() {
  currentBottom = 0;
  historySheet.style.transition = "bottom 0.25s ease";
  historySheet.style.bottom = "0px";
}

function closeHistory() {
  currentBottom = -sheetHeight;
  historySheet.style.transition = "bottom 0.25s ease";
  historySheet.style.bottom = currentBottom + "px";
}

/* Drag Zone = user swipes ANYWHERE from bottom half */
dragZone.addEventListener("touchstart", e => {
  dragStartY = e.touches[0].clientY;
});

/* Swipe Up Open */
dragZone.addEventListener("touchend", e => {
  let endY = e.changedTouches[0].clientY;
  if (dragStartY - endY > 70) openHistory();
});

/* Sheet Drag */
historySheet.addEventListener("touchstart", e => {
  isDragging = true;
  dragStartY = e.touches[0].clientY;
  historySheet.style.transition = "none";
});

historySheet.addEventListener("touchmove", e => {
  if (!isDragging) return;

  let diff = dragStartY - e.touches[0].clientY;
  let newPos = currentBottom + diff;

  if (newPos > 0) newPos = 0;
  if (newPos < -sheetHeight) newPos = -sheetHeight;

  historySheet.style.bottom = newPos + "px";
});

historySheet.addEventListener("touchend", e => {
  isDragging = false;
  let endY = e.changedTouches[0].clientY;
  let drag = dragStartY - endY;

  if (drag > 80) openHistory();
  else if (drag < -80) closeHistory();
  else currentBottom > -sheetHeight / 2 ? openHistory() : closeHistory();
});

/* Save history after 2 sec stop typing */
searchBox.addEventListener("input", () => {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(saveToHistory, 2000);
});

function saveToHistory() {
  const q = searchBox.value.trim().toLowerCase();
  if (!q) return;

  const match = data.find(item =>
    item.searchBarcodes.some(b => b.endsWith(q)) ||
    item.searchSku.endsWith(q)
  );
  if (!match) return;

  historyData = historyData.filter(h => h.text !== q);

  historyData.unshift({
    text: q,
    name: match.name
  });

  if (historyData.length > 50) historyData.pop();

  localStorage.setItem("searchHistory", JSON.stringify(historyData));
  renderHistory();
}

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
