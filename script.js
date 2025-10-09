// URL to fetch your sheet as JSON
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

let data = [];

// load sheet data
fetch(SHEET_URL)
  .then((res) => res.text())
  .then((txt) => {
    // Google wraps JSON in a prefix, so strip it
    const json = JSON.parse(txt.substr(47).slice(0, -2));
    data = json.table.rows.map((r) => {
  const barcodeCell = (r.c[2]?.v || "").trim();
  const barcodeList = barcodeCell.split(",").map(b => b.trim()).filter(b => b);
  return {
    sku: r.c[0]?.v || "",
    name: r.c[1]?.v || "",
    barcodes: barcodeList, // store all barcodes
    primaryBarcode: barcodeList[0] || "", // first one for display
    category: r.c[3]?.v || "",
  };
});
    console.log('Loaded', data.length, 'rows');
  })
  .catch((err) => {
    console.error("Failed to load sheet:", err);
    document.getElementById("result").innerText =
      "⚠️ Unable to fetch data. Make sure the sheet is shared as 'Anyone with the link can view'.";
  });

// live search
document
  .getElementById("searchBox")
  .addEventListener("input", onSearchInput);

function onSearchInput(e) {
  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    document.getElementById("result").innerHTML = "";
    return;
  }

  // 🔍 find matches by name, SKU, or any barcode
  let results = data.filter(item =>
    item.name.toLowerCase().includes(q) ||
    (item.sku && item.sku.toString().toLowerCase().includes(q)) ||
    item.barcodes.some(b => b.toLowerCase().includes(q))
  );

  // 🧹 remove duplicates (same barcode or SKU)
  const seen = new Set();
  results = results.filter(item => {
    const key = item.primaryBarcode || item.sku;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 🟡 show all matches
  if (results.length === 0) {
    document.getElementById("result").innerHTML = "❌ No item found";
  } else {
    document.getElementById("result").innerHTML = results
      .map(item => `
        <div style="margin-bottom:20px; border-bottom:1px solid #ddd; padding-bottom:10px;">
          <strong>${escapeHtml(item.name)}</strong><br>
          SKU: ${escapeHtml(item.sku)}<br>
          Category: ${escapeHtml(item.category)}<br><br>
          ${item.primaryBarcode
            ? `<img src="https://barcodeapi.org/api/auto/${encodeURIComponent(item.primaryBarcode)}" alt="Barcode" />`
            : `<div style='color:red'>⚠️ No valid barcode</div>`}
        </div>
      `)
      .join("");
  }
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[m]; });
}

// dark / light toggle
const themeToggle = document.getElementById("themeToggle");
themeToggle.addEventListener("click", () => {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme") || 'light';
  const next = current === "light" ? "dark" : "light";
  html.setAttribute("data-theme", next);
});
