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
    data = json.table.rows.map((r) => ({
      sku: r.c[0]?.v || "",
      name: r.c[1]?.v || "",
      barcode: (r.c[2]?.v || "").split(",")[0].trim(),
      category: r.c[3]?.v || "",
    }));
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
  const q = e.target.value.trim();
  if (!q) {
    document.getElementById("result").innerHTML = "";
    return;
  }
  const results = data.filter(
    (i) => (i.barcode && i.barcode.toString().endsWith(q)) || (i.sku && i.sku.toString().endsWith(q))
  );

  if (results.length === 0) {
    document.getElementById("result").innerHTML = "❌ No item found";
  } else {
    // show first match
    const item = results[0];
    document.getElementById("result").innerHTML = `
      <strong>${escapeHtml(item.name)}</strong><br>
      SKU: ${escapeHtml(item.sku)}<br>
      Category: ${escapeHtml(item.category)}<br><br>
      <img src="https://barcodeapi.org/api/auto/${encodeURIComponent(item.barcode)}" alt="Barcode" />
    `;
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
