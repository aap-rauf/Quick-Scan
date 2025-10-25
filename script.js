// Robust sheet loader: tries GViz JSON first, then CSV fallback.
// Paste this entire file as script.js

const SHEET_ID = "1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM"; // your sheet id
const GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
const CSV_GID = "0"; // change if your data is on another tab (check url gid=)
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${CSV_GID}`;

const FETCH_TIMEOUT = 12000; // ms
const CACHE_KEY = "sheetCache_v_try_both";
let data = [];
let dataReady = false;
let loadFailed = false;

const resultEl = document.getElementById("result");
resultEl.innerHTML = loaderHTML("Loading...");

// small loader HTML helper
function loaderHTML(text="Loading..."){
  return `<div class="loader-container">
    <div class="loader"></div>
    <div class="loader-text">${escapeHtml(text)}</div>
  </div>`;
}

function escapeHtml(s){
  return String(s||"").replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[m]));
}

// timeout wrapper for fetch
function fetchWithTimeout(url, opts = {}, timeout = FETCH_TIMEOUT){
  return Promise.race([
    fetch(url, opts),
    new Promise((_, rej) => setTimeout(()=> rej(new Error("timeout")), timeout))
  ]);
}

// Try load from cache first
(function tryCacheThenFetch(){
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached) {
    try {
      data = JSON.parse(cached);
      if (Array.isArray(data) && data.length>0) {
        dataReady = true;
        resultEl.innerHTML = `<div style="text-align:center;color:var(--color-accent,#FFD700);font-weight:600;margin-top:16px;">Ready to search items (cached)</div>`;
        // still refresh in background
        fetchSheetBoth();
        return;
      }
    } catch(e){
      console.warn("cache parse", e);
      localStorage.removeItem(CACHE_KEY);
    }
  }
  // no valid cache -> fetch now
  fetchSheetBoth();
})();

// Attempt GViz JSON, if failure attempt CSV
async function fetchSheetBoth(){
  resultEl.innerHTML = loaderHTML("Loading sheet...");
  try {
    console.log("Trying GViz JSON...", GVIZ_URL);
    const r = await fetchWithTimeout(GVIZ_URL, {cache: "no-store"});
    const txt = await r.text();
    // GViz responses are wrapped: find first { and last }
    const start = txt.indexOf("{");
    const end = txt.lastIndexOf("}") + 1;
    if (start === -1 || end === -1) throw new Error("GViz parse failed");
    const json = JSON.parse(txt.substring(start,end));
    if (!json.table || !Array.isArray(json.table.rows)) throw new Error("GViz structure missing");
    data = json.table.rows.map(rowToItemFromGViz);
    finalizeLoad("gviz");
    return;
  } catch (gvErr) {
    console.warn("GViz failed:", gvErr);
    // try CSV fallback
    try {
      console.log("Trying CSV fallback...", CSV_URL);
      const r2 = await fetchWithTimeout(CSV_URL, {cache: "no-store"});
      const txt2 = await r2.text();
      data = parseCSVTextToData(txt2);
      if (!Array.isArray(data) || data.length===0) throw new Error("CSV parse empty");
      finalizeLoad("csv");
      return;
    } catch (csvErr) {
      console.error("CSV fallback failed:", csvErr);
      showFinalLoadError(gvErr, csvErr);
    }
  }
}

function rowToItemFromGViz(r){
  // r.c contains columns; handle missing cells
  const sku = r.c[0]?.v || "";
  const name = r.c[1]?.v || "";
  const barcodeCell = (r.c[2]?.v || "").toString().trim();
  const barcodeList = barcodeCell.split(",").map(b=>b.trim()).filter(Boolean);
  return {
    sku,
    name,
    barcodes: barcodeList,
    primaryBarcode: barcodeList[0]||"",
    searchSku: sku.toLowerCase(),
    searchBarcodes: barcodeList.map(b=>b.toLowerCase())
  };
}

// Basic CSV parser for simple CSV without embedded newlines
function parseCSVTextToData(txt){
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const rows = [];
  // If first line contains headers, try to detect: assume header if contains 'sku' or 'barcode' or 'name'
  const first = lines[0].toLowerCase();
  let startIndex = 0;
  if (first.includes("sku") || first.includes("barcode") || first.includes("name")) startIndex = 1;
  for (let i = startIndex; i < lines.length; i++){
    // split on commas but handle quotes simply
    const cols = csvSplitLine(lines[i]);
    // map first 3 columns to sku, name, barcode
    const sku = cols[0] || "";
    const name = cols[1] || "";
    const barcodeCell = (cols[2] || "").toString().trim();
    const barcodeList = barcodeCell.split(",").map(b=>b.trim()).filter(Boolean);
    rows.push({
      sku, name, barcodes: barcodeList, primaryBarcode: barcodeList[0]||"",
      searchSku: sku.toLowerCase(), searchBarcodes: barcodeList.map(b=>b.toLowerCase())
    });
  }
  return rows;
}

function csvSplitLine(line){
  const out = [];
  let cur = "";
  let inQuotes=false;
  for (let i=0;i<line.length;i++){
    const ch = line[i];
    if (ch === '"' ) {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function finalizeLoad(sourceLabel){
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch(e){ console.warn("cache save failed", e); }
  dataReady = true;
  resultEl.innerHTML = `<div style="text-align:center;color:var(--color-accent,#FFD700);font-weight:600;margin-top:16px;">Ready to search items (${escapeHtml(sourceLabel)})</div>`;
  console.log("Data ready, rows:", data.length, "source:", sourceLabel);
}

// Show final error with helpful steps & open-sheet button
function showFinalLoadError(err1, err2){
  loadFailed = true;
  console.error("Both loaders failed:", err1, err2);
  resultEl.innerHTML = `
    <div style="color:var(--color-accent,#FFD700);text-align:center;font-weight:500;margin-top:16px;line-height:1.4;">
      Unable to load data from Google Sheets.<br>
      Common fixes: make the sheet "Anyone with the link" → Viewer, or check network.<br><br>
      <div style="display:flex;justify-content:center;gap:8px;margin-top:8px;">
        <button id="openSheet" style="padding:8px 12px;border-radius:8px;border:1px solid var(--color-accent,#FFD700);background:transparent;color:var(--color-accent,#FFD700);cursor:pointer;">Open sheet</button>
        <button id="retryLoad" style="padding:8px 12px;border-radius:8px;border:1px solid var(--color-accent,#FFD700);background:transparent;color:var(--color-accent,#FFD700);cursor:pointer;">Retry</button>
      </div>
      <pre id="errlog" style="text-align:left;max-height:120px;overflow:auto;margin-top:12px;background:rgba(0,0,0,0.03);padding:8px;border-radius:6px;font-size:12px;color:#333;">GViz error: ${escapeHtml(String(err1))}\nCSV error: ${escapeHtml(String(err2))}</pre>
    </div>
  `;
  document.getElementById("openSheet").addEventListener("click", ()=> {
    window.open(`https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit`, "_blank");
  });
  document.getElementById("retryLoad").addEventListener("click", ()=> {
    resultEl.innerHTML = loaderHTML("Retrying...");
    loadFailed = false;
    fetchSheetBoth();
  });
}

// ---------- SEARCH ----------
document.getElementById("searchBox").addEventListener("input", (e)=>{
  if (loadFailed) return; // if failed show stay as-is
  if (!dataReady) return;
  const q = e.target.value.trim().toLowerCase();
  if (!q) { resultEl.innerHTML = ""; return; }

  // best-effort search: SKU or barcode suffix
  const results = data.filter(item =>
    (item.searchBarcodes || []).some(b => b.endsWith(q)) ||
    (item.searchSku || "").endsWith(q)
  );

  if (!results.length) {
    resultEl.innerHTML = `<div style="text-align:center;color:var(--color-accent,#FFD700);font-weight:500;margin-top:16px;">No matching item found</div>`;
    return;
  }

  const item = results[0];
  const barcodeDisplay = item.barcodes.length > 1 ? `${item.barcodes[0]} <span class="more">…</span>` : (item.barcodes[0]||"");

  resultEl.innerHTML = `
    <div class="card">
      <strong>${escapeHtml(item.name)}</strong><br>
      SKU: ${escapeHtml(item.sku)}<br>
      Barcodes: <span class="barcode-list">${escapeHtml(barcodeDisplay)}</span><br><br>
      <div class="barcode-img">
        <img src="https://barcodeapi.org/api/code128/${encodeURIComponent(item.primaryBarcode)}" alt="Barcode"/>
      </div>
    </div>
  `;
  const more = document.querySelector(".more");
  if (more) more.addEventListener("click", ()=> { document.querySelector(".barcode-list").innerText = item.barcodes.join(", "); });
});
