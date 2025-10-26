// ✅ Replace with your Apps Script API URL
const API_URL = "https://script.google.com/macros/s/AKfycbxPpQ8aHgOwTQWi10zYdv84latlSyBG1i0ZqZM2Uwq1qyPa_DrJCPIpeMMN4ji5n8aN/exec";

let data = [];
let dataReady = false;

// ✅ Show initial loader
document.getElementById("result").innerHTML = `
  <div class="loader-container">
    <div class="loader"></div>
    <div class="loader-text">Loading...</div>
  </div>
`;

// ✅ Load cached data first for instant use
const cached = localStorage.getItem("sheetCache");
if (cached) {
  try {
    data = JSON.parse(cached);
    dataReady = true;
    console.log("Loaded from cache:", data.length, "rows");
    document.getElementById("result").innerHTML = `
      <div style="text-align:center;color:var(--text-color,#FFD700);margin-top:20px;">
        Ready to search items
      </div>
    `;
  } catch (e) {
    console.warn("Cache parse error", e);
  }
}

// ✅ Fetch fresh data in background
fetch(API_URL, { cache: "no-store" })
  .then(res => res.json())
  .then(json => {
    if (Array.isArray(json)) {
      data = json;
      localStorage.setItem("sheetCache", JSON.stringify(json));
      console.log("Updated from API:", data.length, "rows");
      if (!dataReady) {
        dataReady = true;
        document.getElementById("result").innerHTML = `
          <div style="text-align:center;color:var(--text-color,#FFD700);margin-top:20px;">
            Ready to search items
          </div>
        `;
      }
    } else {
      throw new Error("Invalid API response");
    }
  })
  .catch(err => {
    console.error("Failed to fetch data:", err);
    if (!dataReady) {
      document.getElementById("result").innerHTML = `
        <div style="color:#FFD700;text-align:center;margin-top:20px;">
          Unable to load data.<br>Check your internet connection and try again.
        </div>
      `;
    }
  });

// ✅ Live search
document.getElementById("searchBox").addEventListener("input", e => {
  if (!dataReady) return;
  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    document.getElementById("result").innerHTML = "";
    return;
  }

  const results = data.filter(item =>
    item.barcode?.toString().toLowerCase().endsWith(q) ||
    item.sku?.toString().toLowerCase().endsWith(q)
  );

  if (results.length === 0) {
    document.getElementById("result").innerHTML = `
      <div style="color:#FFD700;text-align:center;margin-top:20px;">
        No matching item found
      </div>
    `;
  } else {
    const item = results[0];
    document.getElementById("result").innerHTML = `
      <div class="card">
        <strong>${escapeHtml(item.name || "Unnamed")}</strong><br>
        SKU: ${escapeHtml(item.sku || "N/A")}<br>
        Barcode: ${escapeHtml(item.barcode || "N/A")}<br><br>
        <div class="barcode-img">
          <img src="https://barcodeapi.org/api/code128/${encodeURIComponent(item.barcode)}" alt="Barcode" />
        </div>
      </div>
    `;
  }
});

// ✅ Escape HTML helper
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, m => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m] || m
  ));
}

// ✅ Dark / Light theme toggle
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
