// ⚡ Fast cached Google Sheet loader
const SHEET_API_URL = "https://script.google.com/macros/s/AKfycbxPpQ8aHgOwTQWi10zYdv84latlSyBG1i0ZqZM2Uwq1qyPa_DrJCPIpeMMN4ji5n8aN/exec"; // 👈 replace with your Apps Script /exec URL

let data = [];
let dataReady = false;
let loadFailed = false;

// show loader
document.getElementById("result").innerHTML = `
  <div class="loader-container">
    <div class="loader"></div>
    <div class="loader-text">Loading...</div>
  </div>
`;

// try to load from cache first
const cached = localStorage.getItem("sheetData");
if (cached) {
  try {
    data = JSON.parse(cached);
    dataReady = true;
    console.log("Loaded from cache", data.length, "rows");
    document.getElementById("result").innerHTML =
      '<div style="text-align:center;color:var(--text-color,#FFD700);font-weight:500;margin-top:20px;">Ready to search items</div>';
  } catch {}
}

// always refresh in background
fetch(SHEET_API_URL)
  .then((res) => res.json())
  .then((json) => {
    if (Array.isArray(json)) {
      data = json.map((r) => ({
        sku: r.sku || "",
        name: r.name || "",
        barcodes: (r.barcode || "").split(",").map((b) => b.trim()),
        primaryBarcode: (r.barcode || "").split(",")[0] || "",
        searchSku: (r.sku || "").toLowerCase(),
        searchBarcodes: (r.barcode || "").split(",").map((b) => b.toLowerCase().trim())
      }));
      localStorage.setItem("sheetData", JSON.stringify(data));
      dataReady = true;
      console.log("Fetched fresh data", data.length, "rows");
      if (!cached)
        document.getElementById("result").innerHTML =
          '<div style="text-align:center;color:var(--text-color,#FFD700);font-weight:500;margin-top:20px;">Ready to search items</div>';
    } else {
      throw new Error("Invalid format");
    }
  })
  .catch((err) => {
    console.error("Fetch failed:", err);
    if (!cached) {
      loadFailed = true;
      document.getElementById("result").innerHTML = `
        <div style="color:var(--text-color,#FFD700);text-align:center;font-weight:500;margin-top:20px;">
          Unable to load data.<br>
          Please check your network and reload.<br><br>
          <button id="reloadBtn" style="border:1px solid var(--text-color,#FFD700);color:var(--text-color,#FFD700);background:transparent;border-radius:8px;padding:8px 16px;cursor:pointer;">⟳ Reload</button>
        </div>`;
      document.getElementById("reloadBtn").addEventListener("click", () => location.reload());
    }
  });

// search function
document.getElementById("searchBox").addEventListener("input", (e) => {
  if (loadFailed || !dataReady) return;
  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    document.getElementById("result").innerHTML = "";
    return;
  }

  const results = data.filter(
    (item) =>
      item.searchSku.endsWith(q) ||
      item.searchBarcodes.some((b) => b.endsWith(q))
  );

  if (!results.length) {
    document.getElementById("result").innerHTML = `
      <div style="text-align:center;color:var(--text-color,#FFD700);font-weight:500;margin-top:20px;">
        No matching item found
      </div>`;
  } else {
    const item = results[0];
    document.getElementById("result").innerHTML = `
      <div class="card">
        <strong>${escapeHtml(item.name)}</strong><br>
        SKU: ${escapeHtml(item.sku)}<br>
        Barcode: ${escapeHtml(item.primaryBarcode)}<br><br>
        <div class="barcode-img">
          <img src="https://barcodeapi.org/api/code128/${encodeURIComponent(item.primaryBarcode)}" alt="Barcode" />
        </div>
      </div>`;
  }
});

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}
