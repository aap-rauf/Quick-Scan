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

// --- Build one loader inside #loading ---
const loadingDiv = document.getElementById("loading");
loadingDiv.innerHTML = `
  <div class="loader-wrapper">
    <div class="loader-bar"><div class="loader-fill" id="loaderFill"></div></div>
    <p class="loader-text" id="loaderText">Loading... 0%</p>
  </div>
`;

const loaderFill = document.getElementById("loaderFill");
const loaderText = document.getElementById("loaderText");

function updateProgress(percent) {
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
let loadedFiles = 0;
Promise.all(
  LOCAL_JSON_PARTS.map(url =>
    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => {
        loadedFiles++;
        const percent = Math.floor((loadedFiles / LOCAL_JSON_PARTS.length) * 100);
        updateProgress(percent);
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
    updateProgress(100);

    // smooth fade out loader
    setTimeout(() => {
      loadingDiv.style.opacity = "0";
      setTimeout(() => {
        loadingDiv.style.display = "none";
        document.getElementById("result").innerHTML = `
          <div class="ready-text">Ready to search items</div>
        `;
      }, 500);
    }, 600);
  })
  .catch(err => {
    console.error("JSON load error:", err);
    loadFailed = true;
    loaderText.textContent = "Unable to load data";
    loaderFill.style.background = "red";
    loaderFill.style.width = "100%";
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
      <div class="no-result">No matching item found</div>
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
