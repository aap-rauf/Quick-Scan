// URL to fetch your sheet as JSON
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

let data = [];
let dataReady = false;
let loadFailed = false;
let progressInterval;

// ---------- History data ----------
let historyData = JSON.parse(localStorage.getItem("scanHistory") || "[]"); // { q: string, name: string, time: timestamp }
const MAX_HISTORY = 30;

// helpers
function escapeHtml(s){ return String(s||"").replace(/[&<>"']/g, m=> ({ "&":"&amp;","<":"&lt;",">":"&gt;", '"':"&quot;", "'":"&#39;" }[m])); }
function saveHistoryItem(q, name){
  if (!q) return;
  // create entry
  const text = q.trim();
  if (!text) return;
  // remove any existing same text
  historyData = historyData.filter(it => it.q !== text);
  // add to top
  historyData.unshift({ q: text, name: name || "", t: Date.now() });
  // limit
  historyData = historyData.slice(0, MAX_HISTORY);
  localStorage.setItem("scanHistory", JSON.stringify(historyData));
  renderHistory();
}
function renderHistory(){
  const list = document.getElementById("historyList");
  if (!list) return;
  if (historyData.length === 0) {
    list.innerHTML = `<div style="padding:12px;color:#888">No history yet</div>`;
    return;
  }
  list.innerHTML = historyData.map(it => {
    const time = new Date(it.t).toLocaleString();
    const label = escapeHtml(it.q);
    const name = escapeHtml(it.name || "");
    return `<div class="history-item" data-q="${label}">
              <div>
                <div class="label">${label}</div>
                <div class="meta">${name ? name + " • " : ""}${time}</div>
              </div>
              <div class="meta">›</div>
            </div>`;
  }).join("");
  // attach click handlers
  list.querySelectorAll(".history-item").forEach(el=>{
    el.addEventListener("click", ()=>{
      const q = el.dataset.q || "";
      document.getElementById("searchBox").value = q;
      document.getElementById("searchBox").dispatchEvent(new Event("input"));
      closeHistory();
    });
  });
}

// Initialize UI + data fetching
document.addEventListener("DOMContentLoaded", () => {
  const resultEl = document.getElementById("result");
  const searchBox = document.getElementById("searchBox");
  const themeToggle = document.getElementById("themeToggle");
  const refreshHeader = document.getElementById("refreshDataButton");
  const historySheet = document.getElementById("historySheet");
  const historyHandle = document.getElementById("historyHandle");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");

  // initial render history
  renderHistory();

  // Show initial loader (keeps search above)
  resultEl.innerHTML = `
    <div class="loader-container" aria-hidden="false">
      <div class="loader-bar"><div id="loaderFill" class="loader-fill" style="width:0%"></div></div>
      <div id="loaderText" class="loader-text">Loading... 0%</div>
    </div>
  `;
  const loaderFill = document.getElementById("loaderFill");
  const loaderText = document.getElementById("loaderText");

  // Fake progressive animation until loaded
  let progress = 0;
  progressInterval = setInterval(()=>{
    if (progress < 92){
      progress = Math.min(92, progress + Math.random()*6);
      loaderFill.style.width = progress + "%";
      loaderText.textContent = `Loading... ${Math.floor(progress)}%`;
    }
  }, 140);

  // Load sheet initially
  loadSheetData();

  // Manual refresh when tapping header
  refreshHeader.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    reloadSheetData();
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

  // ---------- SEARCH behavior ----------
  // We want instant results (no result delay) but only save history after 2s idle and only when a result is shown.
  let saveTimer = null;
  let lastSavedQuery = null; // prevent duplicates saved repeatedly

  searchBox.addEventListener("input", (e) => {
    if (loadFailed || !dataReady) return;

    const q = e.target.value.trim().toLowerCase();

    // Clear any pending save timer
    if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }

    if (!q) {
      resultEl.innerHTML = "";
      return;
    }

    // perform search immediately (no delay)
    const results = data.filter(item =>
      item.searchBarcodes.some(b => b.endsWith(q)) ||
      item.searchSku.endsWith(q)
    );

    if (results.length === 0) {
      resultEl.innerHTML = `<div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">Not Found</div>`;
      return;
    }

    const item = results[0];
    const barcodeDisplay = item.barcodes.length > 1 ? `${item.barcodes[0]} <span class='more'>…</span>` : item.barcodes[0];

    resultEl.innerHTML = `
      <div class="card">
        <strong>${escapeHtml(item.name)}</strong><br>
        SKU: ${escapeHtml(item.sku)}<br>
        Barcodes: <span class="barcode-list">${escapeHtml(barcodeDisplay)}</span><br><br>
        <div class="barcode-img">
          <svg id="barcodeSvg"></svg>
        </div>
      </div>
    `;

    // expand "more"
    const more = document.querySelector(".more");
    if (more) more.addEventListener("click", ()=>{
      const list = document.querySelector(".barcode-list");
      if (list) list.innerText = item.barcodes.join(", ");
    });

    // local barcode generation
    const barcodeSvg = document.getElementById("barcodeSvg");
    if (barcodeSvg && item.primaryBarcode) {
      // Use recommended sizing: width between 2 and 3 (you asked width >2 <3). Keep 2.2 default; change height to 100
      JsBarcode(barcodeSvg, item.primaryBarcode, {
        format: "code128",
        lineColor: "#000",
        width: 2.2,
        height: 100,
        displayValue: false,
        margin: 8
      });
    }

    // Schedule save after 2 seconds of idle ONLY if results present
    saveTimer = setTimeout(() => {
      const queryText = e.target.value.trim();
      // Avoid saving same as last saved at top repeatedly
      if (queryText && lastSavedQuery !== queryText) {
        saveHistoryItem(queryText, item.name || "");
        lastSavedQuery = queryText;
      }
      saveTimer = null;
    }, 2000);
  });

  // ---------- History sheet controls ----------
  // Open/close bottom sheet programmatically
  function openHistory(){ historySheet.classList.add("open"); historySheet.setAttribute("aria-hidden","false"); }
  function closeHistory(){ historySheet.classList.remove("open"); historySheet.setAttribute("aria-hidden","true"); }

  // Clear history button
  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", () => {
      historyData = [];
      localStorage.setItem("scanHistory", "[]");
      renderHistory();
    });
  }

  // Attach handle tap to toggle sheet
  if (historyHandle) {
    historyHandle.addEventListener("click", () => {
      if (historySheet.classList.contains("open")) closeHistory(); else openHistory();
    });
  }

  // Swipe up from screen bottom to open history:
  let touchStartY = null;
  let touchStartX = null;
  document.addEventListener("touchstart", (ev) => {
    if (!ev.touches || ev.touches.length === 0) return;
    const t = ev.touches[0];
    touchStartY = t.clientY;
    touchStartX = t.clientX;
  }, {passive:true});
  document.addEventListener("touchend", (ev) => {
    if (touchStartY === null) return;
    const t = ev.changedTouches && ev.changedTouches[0];
    if (!t) { touchStartY = null; return; }
    const dy = touchStartY - t.clientY;
    const dx = Math.abs(t.clientX - touchStartX);
    // if swipe up more than 80px and mostly vertical, open history
    if (dy > 80 && dx < 80 && touchStartY > (window.innerHeight - 150)) {
      openHistory();
    }
    touchStartY = null;
    touchStartX = null;
  }, {passive:true});

  // Close sheet by tapping outside (click main) or swipe down on sheet
  document.addEventListener("click", (ev) => {
    const path = ev.composedPath ? ev.composedPath() : (ev.path || []);
    if (!path.includes(historySheet) && historySheet.classList.contains("open")) {
      closeHistory();
    }
  });

  // sheet swipe-down to close
  let sheetStartY = null;
  historySheet.addEventListener("touchstart", (ev) => {
    const t = ev.touches && ev.touches[0];
    if (!t) return;
    sheetStartY = t.clientY;
  }, {passive:true});
  historySheet.addEventListener("touchmove", (ev) => {
    // allow native dragging feel - optional; not doing complex transform here
  }, {passive:true});
  historySheet.addEventListener("touchend", (ev) => {
    const t = ev.changedTouches && ev.changedTouches[0];
    if (!t || sheetStartY === null) { sheetStartY = null; return; }
    const dy = t.clientY - sheetStartY;
    if (dy > 80) closeHistory();
    sheetStartY = null;
  }, {passive:true});

  // ---------- allow keyboard "Escape" to close sheet ----------
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && historySheet.classList.contains("open")) closeHistory();
  });

  // ---------- ensure history rendered initially ----------
  renderHistory();

}); // DOMContentLoaded end

// ---------- Load sheet once (initial) ----------
function loadSheetData(){
  const resultEl = document.getElementById("result");
  const loaderFill = document.getElementById("loaderFill");
  const loaderText = document.getElementById("loaderText");

  // fetch sheet
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
      if (loaderFill) loaderFill.style.width = "100%";
      if (loaderText) loaderText.textContent = "Loading... 100%";
      dataReady = true;

      setTimeout(() => {
        if (resultEl) resultEl.innerHTML = `<div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">Ready to Search</div>`;
      }, 260);
    })
    .catch(err => {
      console.error("Failed to load sheet:", err);
      clearInterval(progressInterval);
      loadFailed = true;
      if (loaderFill) loaderFill.style.width = "100%";
      if (loaderText) loaderText.textContent = "Error!";
      if (resultEl) resultEl.innerHTML = `
        <div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">
          Unable to load data.<br>
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
      if (reloadBtn) reloadBtn.addEventListener("click", () => loadSheetData());
    });
}

// ---------- Manual refresh function used when tapping header ----------
function reloadSheetData(){
  const resultEl = document.getElementById("result");
  // show refreshing loader
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
  const interval = setInterval(() => {
    if (progress < 93) {
      progress += Math.random()*6;
      if (loaderFill) loaderFill.style.width = progress + "%";
      if (loaderText) loaderText.textContent = `Refreshing... ${Math.floor(progress)}%`;
    }
  }, 130);

  // fetch fresh JSON with nocache param
  fetch(SHEET_URL + "&nocache=" + Date.now())
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

      clearInterval(interval);
      if (loaderFill) loaderFill.style.width = "100%";
      if (loaderText) loaderText.textContent = "Refreshing... 100%";

      setTimeout(()=> {
        if (resultEl) resultEl.innerHTML = `<div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">Refreshed — Ready to Search</div>`;
      }, 260);
    })
    .catch(err => {
      console.error("Refresh failed:", err);
      clearInterval(interval);
      // show error + reload button
      resultEl.innerHTML = `
        <div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">
          Unable to Refresh.<br>
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
      if (reloadBtn) reloadBtn.addEventListener("click", () => reloadSheetData());
    });
}
