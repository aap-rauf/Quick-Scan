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

  // 1) inject loader into result (so search remains above)
  resultEl.innerHTML = `
    <div class="loader-container" aria-hidden="false">
      <div class="loader-bar"><div id="loaderFill" class="loader-fill" style="width:0%"></div></div>
      <div id="loaderText" class="loader-text">Loading... 0%</div>
    </div>
  `;
  const loaderFill = document.getElementById("loaderFill");
  const loaderText = document.getElementById("loaderText");

  // fake progress while loading (stops at 92% until fetch resolves)
  let progress = 0;
  progressInterval = setInterval(() => {
    if (progress < 92) {
      progress = Math.min(92, progress + Math.random() * 6);
      loaderFill.style.width = progress + "%";
      loaderText.textContent = `Loading... ${Math.floor(progress)}%`;
    }
  }, 140);

  // fetch sheet JSON
  fetch(SHEET_URL)
    .then(res => res.text())
    .then(txt => {
      // parse gviz response
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

      // show ready message briefly then clear (so results area is clean)
      setTimeout(() => {
        resultEl.innerHTML = `<div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">Ready to search items</div>`;
      }, 260);
    })
    .catch(err => {
      console.error("Failed to load sheet:", err);
      clearInterval(progressInterval);
      loadFailed = true;
      loaderFill.style.width = "100%";
      loaderText.textContent = "Error!";
      resultEl.innerHTML = `
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
            font-weight: 500;
            cursor: pointer;
            transition: 0.2s;
          ">⟳ Reload</button>
        </div>
      `;
      const reloadBtn = document.getElementById("reloadBtn");
      if (reloadBtn) reloadBtn.addEventListener("click", () => location.reload());
    });

  // search handler
  searchBox.addEventListener("input", (e) => {
    if (loadFailed) return;      // don't change result if load failed
    if (!dataReady) return;      // ignore until data loaded

    const q = e.target.value.trim().toLowerCase();
    if (!q) {
      resultEl.innerHTML = "";   // clear results when empty
      return;
    }

    const results = data.filter(item =>
      item.searchBarcodes.some(b => b.endsWith(q)) ||
      item.searchSku.endsWith(q)
    );

    if (results.length === 0) {
      resultEl.innerHTML = `<div style="text-align:center;color:var(--color-accent);font-weight:600;margin-top:8px;">No matching item found</div>`;
      return;
    }

    const item = results[0];
    const barcodeDisplay = item.barcodes.length > 1 ? `${item.barcodes[0]} <span class='more'>…</span>` : item.barcodes[0];

    resultEl.innerHTML = `
      <div class="card">
        <strong>${escapeHtml(item.name)}</strong><br>
        SKU: ${escapeHtml(item.sku)}<br>
        Barcodes: <span class="barcode-list">${barcodeDisplay}</span><br><br>
        <div class="barcode-img">
          <img src="https://barcodeapi.org/api/code128/${encodeURIComponent(item.primaryBarcode)}" alt="Barcode" />
        </div>
      </div>
    `;

    const more = document.querySelector(".more");
    if (more) more.addEventListener("click", () => {
      const list = document.querySelector(".barcode-list");
      if (list) list.innerText = item.barcodes.join(", ");
    });
  });

  // theme toggle
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

// small helper
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, function (m) {
    return ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[m] || m);
  });
}
