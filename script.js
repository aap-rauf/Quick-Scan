// --- JSON file parts ---
const LOCAL_JSON_PARTS = [
  "./data_part_1.json",
  "./data_part_2.json",
  "./data_part_3.json",
  "./data_part_4.json"
];

let data = [];
let dataReady = false;
let loadFailed = false;

const loadingDiv = document.getElementById("loading");
const loaderText = document.createElement("p");
loaderText.className = "loader-text";
loaderText.textContent = "Loading... 0%";

const loaderBar = document.createElement("div");
loaderBar.className = "loader-bar";
const loaderFill = document.createElement("div");
loaderFill.className = "loader-fill";
loaderFill.style.width = "0%";
loaderBar.appendChild(loaderFill);

loadingDiv.innerHTML = "";
loadingDiv.appendChild(loaderBar);
loadingDiv.appendChild(loaderText);

function updateProgress(loadedFiles) {
  const percent = Math.floor((loadedFiles / LOCAL_JSON_PARTS.length) * 100);
  loaderFill.style.width = percent + "%";
  if (percent >= 70 && percent < 100) {
    loaderText.textContent = `Almost ready... ${percent}%`;
  } else if (percent >= 100) {
    loaderText.textContent = `Ready to search!`;
  } else {
    loaderText.textContent = `Loading... ${percent}%`;
  }
}

// --- Load JSON files ---
Promise.all(
  LOCAL_JSON_PARTS.map(url =>
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        updateProgress(LOCAL_JSON_PARTS.indexOf(url) + 1);
        return json;
      })
  )
)
  .then(parts => {
    data = parts.flat().map(r => {
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
        searchBarcodes: barcodeList.map(b => b.toLowerCase()),
      };
    });

    dataReady = true;
    loaderText.textContent = "Ready to search!";
    setTimeout(() => {
      loadingDiv.style.display = "none";
    }, 700);
  })
  .catch(err => {
    console.error("JSON load error:", err);
    loadFailed = true;
    loaderText.textContent = "Error loading data";
  });

// --- Search function ---
const searchBox = document.getElementById("searchBox");
const resultDiv = document.getElementById("result");

searchBox.addEventListener("input", (e) => {
  if (loadFailed || !dataReady) return;
  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    resultDiv.innerHTML = "";
    return;
  }

  const results = data.filter(
    (item) =>
      item.searchBarcodes.some((b) => b.endsWith(q)) ||
      item.searchSku.endsWith(q)
  );

  if (results.length === 0) {
    resultDiv.innerHTML = `
      <div style="color:var(--text-color,#FFD700);text-align:center;">No matching item found</div>
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
});

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, (m) => {
    return (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        m
      ] || m
    );
  });
}

// --- Theme toggle ---
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
