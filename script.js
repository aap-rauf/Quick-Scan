// Replace with your Apps Script JSON API URL
const API_URL = "https://script.google.com/macros/s/AKfycbxPpQ8aHgOwTQWi10zYdv84latlSyBG1i0ZqZM2Uwq1qyPa_DrJCPIpeMMN4ji5n8aN/exec";

let data = [];
let dataReady = false;

// Load cached data first (for instant start)
const cached = localStorage.getItem("sheetCache");
if (cached) {
  try {
    data = JSON.parse(cached);
    dataReady = true;
    console.log("Loaded from cache:", data.length, "rows");
    document.getElementById("result").innerHTML =
      '<div style="text-align:center;color:var(--text-color,#FFD700);margin-top:20px;">Ready to search items</div>';
  } catch (e) {
    console.warn("Cache parse error", e);
  }
}

// Always try to refresh in background
fetch(API_URL, { cache: "no-store" })
  .then(res => res.json())
  .then(json => {
    data = json;
    localStorage.setItem("sheetCache", JSON.stringify(json));
    if (!dataReady) {
      dataReady = true;
      document.getElementById("result").innerHTML =
        '<div style="text-align:center;color:var(--text-color,#FFD700);margin-top:20px;">Ready to search items</div>';
    }
    console.log("Updated from API:", data.length, "rows");
  })
  .catch(err => {
    console.error("Failed to fetch data:", err);
    if (!dataReady) {
      document.getElementById("result").innerHTML = `
        <div style="color:#FFD700;text-align:center;margin-top:20px;">
          Unable to load data.<br>Check your internet and try again.
        </div>`;
    }
  });

// Your search function stays the same ↓
document.getElementById("searchBox").addEventListener("input", (e) => {
  if (!dataReady) return;

  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    document.getElementById("result").innerHTML = "";
    return;
  }

  const results = data.filter(
    item =>
      (item["Barcode"] || "").toString().toLowerCase().endsWith(q) ||
      (item["Sku"] || "").toString().toLowerCase().endsWith(q)
  );

  if (results.length === 0) {
    document.getElementById("result").innerHTML =
      '<div style="color:#FFD700;text-align:center;margin-top:20px;">No matching item found</div>';
  } else {
    const item = results[0];
    const barcodes = (item["Barcode"] || "").toString();
    document.getElementById("result").innerHTML = `
      <div class="card">
        <strong>${item["Name"] || "Unnamed"}</strong><br>
        SKU: ${item["Sku"] || "N/A"}<br>
        Barcode: ${barcodes}<br><br>
        <div class="barcode-img">
          <img src="https://barcodeapi.org/api/code128/${encodeURIComponent(barcodes)}" alt="Barcode" />
        </div>
      </div>
    `;
  }
});

// live search
document.getElementById("searchBox").addEventListener("input", onSearchInput);

function onSearchInput(e) {
  if (loadFailed) return; // <--- do nothing if load failed
  if (!dataReady) return; // <--- removed the “Please wait” screen

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
      <div style="
        color: var(--text-color, #FFD700);
        text-align: center;
        font-weight: 500;
        margin-top: 20px;
        letter-spacing: 0.5px;
        font-size: 1rem;
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

function showFullDetails(item) {
  const allBarcodes = item.barcodes.join(", ");
  const resultDiv = document.getElementById("result");
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
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => {
    return (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ] || m
    );
  });
}

// Dark / Light theme toggle with memory
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
