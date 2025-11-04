// --- UI Elements ---
const searchInput = document.getElementById("searchInput");
const resultsContainer = document.getElementById("results");
const loadingEl = document.getElementById("loading");
const statusText = document.getElementById("status-text");

// --- JSON file parts (local) ---
const LOCAL_JSON_PARTS = [
  "./data_part_1.json",
  "./data_part_2.json",
  "./data_part_3.json",
  "./data_part_4.json"
];

let allData = [];
let dataLoaded = false;

// --- Show temporary messages on screen (useful on iOS) ---
function showError(msg) {
  const div = document.createElement("div");
  div.style.cssText = `
    position: fixed;
    bottom: 15px;
    left: 15px;
    right: 15px;
    background: rgba(255, 0, 0, 0.85);
    color: white;
    padding: 12px;
    border-radius: 8px;
    text-align: center;
    font-size: 14px;
    z-index: 9999;
    font-family: sans-serif;
  `;
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 4000);
}

// --- Load all JSON files ---
async function loadAllData() {
  loadingEl.style.display = "block";
  statusText.textContent = "Loading local data...";

  try {
    const fetchPromises = LOCAL_JSON_PARTS.map(url => fetch(url).then(res => {
      if (!res.ok) throw new Error(`Failed to load ${url}`);
      return res.json();
    }));

    const parts = await Promise.all(fetchPromises);
    allData = parts.flat();

    dataLoaded = true;
    loadingEl.style.display = "none";
    statusText.textContent = "Ready to search ✓";
  } catch (err) {
    console.error("JSON load error:", err);
    loadingEl.style.display = "none";
    statusText.textContent = "Unable to load data ❌";
    showError("Unable to load local JSON files");
  }
}

// --- Search functionality ---
function searchItems(query) {
  if (!dataLoaded) {
    statusText.textContent = "Please wait, loading data...";
    return;
  }

  const term = query.toLowerCase().trim();
  if (!term) {
    resultsContainer.innerHTML = "";
    return;
  }

  const results = allData.filter(item =>
    item.SKU?.toLowerCase().includes(term) ||
    item["Product Name"]?.toLowerCase().includes(term) ||
    item.Barcodes?.toLowerCase().includes(term) ||
    item.Category?.toLowerCase().includes(term)
  );

  displayResults(results);
}

// --- Display search results ---
function displayResults(items) {
  resultsContainer.innerHTML = "";

  if (items.length === 0) {
    resultsContainer.innerHTML = "<p>No results found.</p>";
    return;
  }

  items.forEach(item => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <h3>${item["Product Name"] || "Unnamed Product"}</h3>
      <p><strong>SKU:</strong> ${item.SKU || "-"}</p>
      <p><strong>Barcode:</strong> ${item.Barcodes || "-"}</p>
      <p><strong>Category:</strong> ${item.Category || "-"}</p>
    `;
    resultsContainer.appendChild(div);
  });
}

// --- Event listeners ---
searchInput.addEventListener("input", e => searchItems(e.target.value));

// --- Start loading on page load ---
document.addEventListener("DOMContentLoaded", loadAllData);
