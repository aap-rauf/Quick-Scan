// URL to fetch your sheet as JSON
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

let data = [];
let dataReady = false;
let loadFailed = false;

// Initial loader with bar + text
document.getElementById("result").innerHTML = `
  <div class="loader-container">
    <div class="loader-bar">
      <div class="loader-fill" id="loaderFill"></div>
    </div>
    <div class="loader-text" id="loaderText">Loading... 0%</div>
  </div>
`;

const loaderFill = document.getElementById("loaderFill");
const loaderText = document.getElementById("loaderText");

let progress = 0;
const progressInterval = setInterval(() => {
  if (progress < 70) {
    progress += Math.floor(Math.random() * 5) + 1; // increase slowly
    loaderFill.style.width = progress + "%";
    loaderText.textContent = `Loading... ${progress}%`;
  }
}, 200);

// Fetch sheet data
fetch(SHEET_URL)
  .then((res) => res.text())
  .then((txt) => {
    clearInterval(progressInterval);
    progress = 80;
    loaderFill.style.width = progress + "%";
    loaderText.textContent = `Loading... ${progress}%`;

    const json = JSON.parse(txt.substr(47).slice(0, -2));
    data = json.table.rows.map((r) => {
      const skuOriginal = r.c[0]?.v || "";
      const nameOriginal = r.c[1]?.v || "";
      const barcodeCell = (r.c[2]?.v || "").trim();
      const barcodeList = barcodeCell
        .split(",")
        .map((b) => b.trim())
        .filter((b) => b);

      return {
        sku: skuOriginal,
        name: nameOriginal,
        barcodes: barcodeList,
        primaryBarcode: barcodeList[0] || "",
        searchSku: skuOriginal.toLowerCase(),
        searchBarcodes: barcodeList.map((b) => b.toLowerCase()),
      };
    });

    // Simulate finishing load
    let finishProgress = 80;
    const finishInterval = setInterval(() => {
      finishProgress += 4;
      loaderFill.style.width = finishProgress + "%";
      loaderText.textContent = `Loading... ${finishProgress}%`;
      if (finishProgress >= 100) {
        clearInterval(finishInterval);
        loaderFill.style.width = "100%";
        loaderText.textContent = "✅ Ready to search items";

        setTimeout(() => {
          document.getElementById("result").innerHTML =
            '<div style="text-align:center;color:var(--text-color,#FFD700);font-weight:500;margin-top:20px;letter-spacing:0.5px;">Ready to search items</div>';
        }, 600);
      }
    }, 120);

    dataReady = true;
  })
  .catch((err) => {
    console.error("Failed to load sheet:", err);
    clearInterval(progressInterval);
    loadFailed = true;

    loaderFill.style.width = "100%";
    loaderText.textContent = "❌ Failed to load";

    setTimeout(() => {
      document.getElementById("result").innerHTML = `
        <div style="
          color: var(--text-color, #FFD700);
          text-align: center;
          font-weight: 500;
          margin-top: 20px;
          letter-spacing: 0.5px;
        ">
          Unable to load data.<br>
          Please check your internet connection.<br><br>
          <button id="reloadBtn" style="
            background: transparent;
            border: 1px solid var(--text-color, #FFD700);
            color: var(--text-color, #FFD700);
            border-radius: 8px;
            padding: 8px 16px;
            font-size: 15px;
            font-weight: 500;
            cursor: pointer;
          ">⟳ Reload</button>
        </div>
      `;

      const reloadBtn = document.getElementById("reloadBtn");
      if (reloadBtn) reloadBtn.addEventListener("click", () => location.reload());
    }, 800);
  });

// Live search
document.getElementById("searchBox").addEventListener("input", onSearchInput);

function onSearchInput(e) {
  if (loadFailed || !dataReady) return;

  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    document.getElementById("result").innerHTML = "";
    return;
  }

  const results = data.filter(
    (item) =>
      item.searchBarcodes.some((b) => b.endsWith(q)) ||
      item.searchSku.endsWith(q)
  );

  if (results.length === 0) {
    document.getElementById("result").innerHTML = `
      <div style="color: var(--text-color, #FFD700);text-align: center;font-weight: 500;margin-top: 20px;letter-spacing: 0.5px;font-size: 1rem;">
        No matching item found
      </div>
    `;
  } else {
    const item = results[0];
    const barcodeDisplay =
      item.barcodes.length > 1
        ? `${item.barcodes[0]} <span class='more'>…</span>`
        : item.barcodes[0];

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

    const more = document.querySelector(".more");
    if (more) {
      more.addEventListener("click", () => {
        document.querySelector(".barcode-list").innerText =
          item.barcodes.join(", ");
      });
    }
  }
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => {
    return (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m] ||
      m
    );
  });
}

// Dark / Light theme toggle
const themeToggle = document.getElementById("themeToggle");
const html = document.documentElement;
const savedTheme = localStorage.getItem("theme") || "light";
html.setAttribute("data-theme", savedTheme);
themeToggle.textContent = savedTheme === "light" ? "🌙" : "☀️";

themeToggle.addEventListener("click", () => {
  const current = html.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  html.setAttribute("data-theme", next);
  localStorage.setItem("theme", next);
  themeToggle.textContent = next === "light" ? "🌙" : "☀️";
});
