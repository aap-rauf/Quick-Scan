const LOCAL_JSON_PARTS = [

  "https://aap-rauf.github.io/Quick-Scan/data_part_1.json",
  "https://aap-rauf.github.io/Quick-Scan/data_part_2.json",
  "https://aap-rauf.github.io/Quick-Scan/data_part_3.json",
  "https://aap-rauf.github.io/Quick-Scan/data_part_4.json"
];

let data = [];
let dataReady = false;
let loadFailed = false;

// Inject loader UI once
const resultDiv = document.getElementById("result");
resultDiv.innerHTML = `
  <div class="loader-container">
    <div class="loader-bar">
      <div class="loader-fill" id="loaderFill" style="width:0%"></div>
    </div>
    <div class="loader-text" id="loaderText">Loading... 0%</div>
  </div>
`;

const loaderFill = document.getElementById("loaderFill");
const loaderText = document.getElementById("loaderText");
let loadedFiles = 0;

// update progress display
function updateProgress() {
  const percent = Math.floor((loadedFiles / LOCAL_JSON_PARTS.length) * 100);
  loaderFill.style.width = `${percent}%`;

  if (percent >= 70 && percent < 100) {
    loaderText.textContent = `Almost ready... ${percent}%`;
  } else if (percent >= 100) {
    loaderText.textContent = `Ready to search!`;
  } else {
    loaderText.textContent = `Loading... ${percent}%`;
  }
}

// fetch and merge all JSON files
Promise.all(
  LOCAL_JSON_PARTS.map(url =>
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        loadedFiles++;
        updateProgress();
        return json;
      })
  )
)
  .then(parts => {
    const combined = parts.flat();
    data = combined.map(r => {
      const skuOriginal = r.sku || "";
      const nameOriginal = r.name || "";
      const barcodeCell = (r.barcode || "").trim();
      const barcodeList = barcodeCell
        .split(",")
        .map(b => b.trim())
        .filter(b => b);

      return {
        sku: skuOriginal,
        name: nameOriginal,
        barcodes: barcodeList,
        primaryBarcode: barcodeList[0] || "",
        searchSku: skuOriginal.toLowerCase(),
        searchBarcodes: barcodeList.map(b => b.toLowerCase())
      };
    });

    dataReady = true;
    updateProgress();

    // show “Ready” message in same style
    setTimeout(() => {
      resultDiv.innerHTML = `
        <div style="
          text-align:center;
          color:#FFD700;
          font-weight:600;
          font-size:18px;
          letter-spacing:0.5px;
          margin-top:20px;
        ">
          Ready to search items
        </div>`;
    }, 400);
  })
  .catch(err => {
    console.error("Failed to load JSON:", err);
    loadFailed = true;
    resultDiv.innerHTML = `
      <div style="
        color:#FFD700;
        text-align:center;
        font-weight:600;
        font-size:18px;
        margin-top:20px;
        letter-spacing:0.5px;
      ">
        Unable to load data.<br><br>
        <button id="reloadBtn" style="
          background:transparent;
          border:1px solid #FFD700;
          color:#FFD700;
          border-radius:8px;
          padding:8px 16px;
          font-size:15px;
          font-weight:500;
          cursor:pointer;
          transition:0.3s;
        ">⟳ Reload</button>
      </div>
    `;
    document.getElementById("reloadBtn").addEventListener("click", () => location.reload());
  });

// live search
document.getElementById("searchBox").addEventListener("input", e => {
  if (loadFailed || !dataReady) return;

  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    resultDiv.innerHTML = "";
    return;
  }

  const results = data.filter(
    item =>
      item.searchBarcodes.some(b => b.endsWith(q)) ||
      item.searchSku.endsWith(q)
  );

  if (results.length === 0) {
    resultDiv.innerHTML = `
      <div style="
        color:#FFD700;
        text-align:center;
        font-weight:500;
        margin-top:20px;
        letter-spacing:0.5px;
        font-size:1rem;
      ">
        No matching item found
      </div>
    `;
  } else {
    const item = results[0];
    const barcodeDisplay =
      item.barcodes.length > 1
        ? `${item.barcodes[0]} <span class='more'>…</span>`
        : item.barcodes[0];

    resultDiv.innerHTML = `
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
    if (more) {
      more.addEventListener("click", () => {
        document.querySelector(".barcode-list").innerText = item.barcodes.join(", ");
      });
    }
  }
});

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[m] || m));
}

// theme toggle
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
function logToScreen(message) {
  const logDiv = document.createElement("div");
  logDiv.style.cssText = "color:#FFD700;font-size:12px;margin:5px;padding:5px;border-top:1px solid #333;word-break:break-all;";
  logDiv.textContent = message;
  document.body.appendChild(logDiv);
  console.log(message);
}

// Replace console.log calls to also show on screen
const oldLog = console.log;
console.log = function(...args) {
  oldLog(...args);
  logToScreen(args.join(" "));
};
