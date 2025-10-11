// URL to fetch your sheet as JSON
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

let data = [];
let dataReady = false;
document.getElementById("result").innerHTML = '<div class="loader"></div><div style="text-align:center;">Loading...</div>';

// load sheet data
fetch(SHEET_URL)
  .then((res) => res.text())
  .then((txt) => {
    const json = JSON.parse(txt.substr(47).slice(0, -2));
    data = json.table.rows.map((r) => {
      const barcodeCell = (r.c[2]?.v || "").trim();
      const barcodeList = barcodeCell
        .split(",")
        .map((b) => b.trim())
        .filter((b) => b);

      return {
        sku: r.c[0]?.v || "",
        name: r.c[1]?.v || "",
        barcodes: barcodeList,
        primaryBarcode: barcodeList[0] || "",
      };
    });
    console.log("Loaded", data.length, "rows");
    dataReady = true;
document.getElementById("result").innerHTML =
  '<div style="text-align:center;color:#ffcc00;">Ready to search items</div>';
  })
  .catch((err) => {
    console.error("Failed to load sheet:", err);
    document.getElementById("result").innerText =
      "Unable to fetch data.";
  });

// live search
document
  .getElementById("searchBox")
  .addEventListener("input", onSearchInput);

function onSearchInput(e) {
  if (!dataReady) {
  document.getElementById("result").innerHTML = '<div class="loader"></div><div style="text-align:center;">Please wait, loading data...</div>';
  return;
}
  const q = e.target.value.trim();
  if (!q) {
    document.getElementById("result").innerHTML = "";
    return;
  }

  const results = data.filter(
    (item) =>
      item.barcodes.some((b) => b.endsWith(q)) ||
      (item.sku && item.sku.toString().endsWith(q))
  );

  if (results.length === 0) {
    document.getElementById("result").innerHTML = "No item found";
  } else {
    const item = results[0];
    const barcodeDisplay =
      item.barcodes.length > 2
        ? `${item.barcodes.slice(0, 2).join(", ")} <span class='more'>…</span>`
        : item.barcodes.join(", ");

    document.getElementById("result").innerHTML = `
      <div class="card">
        <strong>${escapeHtml(item.name)}</strong><br>
        SKU: ${escapeHtml(item.sku)}<br>
        Barcodes: <span class="barcode-list">${barcodeDisplay}</span><br><br>
        <div class="barcode-img">
          <img src="https://barcodeapi.org/api/code128/${encodeURIComponent(
            item.primaryBarcode
          )}" alt="Barcode" />
        </div>
      </div>
    `;

    // tap on “…” to expand
    const more = document.querySelector(".more");
    if (more) {
      more.addEventListener("click", () => showFullDetails(item));
    }
  }
}

function showFullDetails(item) {
  const allBarcodes = item.barcodes.join(", ");
  const resultDiv = document.getElementById("result");

  // overlay background
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="card expanded">
      <strong>${escapeHtml(item.name)}</strong><br>
      SKU: ${escapeHtml(item.sku)}<br>
      Barcodes: ${escapeHtml(allBarcodes)}<br><br>
      <div class="barcode-img">
        <img src="https://barcodeapi.org/api/code128/${encodeURIComponent(
          item.primaryBarcode
        )}" alt="Barcode" />
      </div>
    </div>
  `;
  resultDiv.appendChild(overlay);

  // tap outside card to close
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, function (m) {
    return (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ] || m
    );
  });
}

// dark / light toggle
const themeToggle = document.getElementById("themeToggle");
themeToggle.addEventListener("click", () => {
  const html = document.documentElement;
  const current = html.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  html.setAttribute("data-theme", next);
});
