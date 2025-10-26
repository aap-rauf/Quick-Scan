// Replace with your Apps Script JSON API URL
const API_URL =
  "https://script.google.com/macros/s/AKfycbxPpQ8aHgOwTQWi10zYdv84latlSyBG1i0ZqZM2Uwq1qyPa_DrJCPIpeMMN4ji5n8aN/exec";

let data = [];
let dataReady = false;
let loadFailed = false;

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
  .then((res) => res.json())
  .then((json) => {
    data = json;
    localStorage.setItem("sheetCache", JSON.stringify(json));
    if (!dataReady) {
      dataReady = true;
      document.getElementById("result").innerHTML =
        '<div style="text-align:center;color:var(--text-color,#FFD700);margin-top:20px;">Ready to search items</div>';
    }
    console.log("Updated from API:", data.length, "rows");
  })
  .catch((err) => {
    console.error("Failed to fetch data:", err);
    loadFailed = true;
    if (!dataReady) {
      document.getElementById("result").innerHTML = `
        <div style="color:#FFD700;text-align:center;margin-top:20px;">
          Unable to load data.<br>Check your internet connection.<br><br>
          <button id="reloadBtn" style="
            background: transparent;
            border: 1px solid #FFD700;
            color: #FFD700;
            border-radius: 8px;
            padding: 8px 16px;
            font-size: 15px;
            font-weight: 500;
            cursor: pointer;
          ">⟳ Reload</button>
        </div>`;
      document.getElementById("reloadBtn").addEventListener("click", () =>
        location.reload()
      );
    }
  });

// --- Search logic ---
document.getElementById("searchBox").addEventListener("input", (e) => {
  if (loadFailed || !dataReady) return;

  const q = e.target.value.trim().toLowerCase();
  const resultDiv = document.getElementById("result");

  if (!q) {
    resultDiv.innerHTML = "";
    return;
  }

  const results = data.filter(
    (item) =>
      (item.Sku || "").toString().toLowerCase().endsWith(q) ||
      (item.Barcode || "").toString().toLowerCase().includes(q)
  );

  if (results.length === 0) {
    resultDiv.innerHTML = `
      <div style="color:#FFD700;text-align:center;margin-top:20px;">
        No matching item found
      </div>`;
  } else {
    const item = results[0];
    const name = item.Name || "Unnamed";
    const sku = item.Sku || "N/A";
    const barcodeList = (item.Barcode || "").split(",").map((b) => b.trim());
    const primaryBarcode = barcodeList[0] || "";

    resultDiv.innerHTML = `
      <div class="card">
        <strong>${escapeHtml(name)}</strong><br>
        SKU: ${escapeHtml(sku)}<br>
        Barcode: ${escapeHtml(barcodeList.join(", "))}<br><br>
        <div class="barcode-img">
          <img src="https://barcodeapi.org/api/code128/${encodeURIComponent(
            primaryBarcode
          )}" alt="Barcode" />
        </div>
      </div>`;
  }
});

// --- Helper for escaping HTML ---
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => {
    return (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ] || m
    );
  });
}

// --- Dark / Light theme toggle with memory ---
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
