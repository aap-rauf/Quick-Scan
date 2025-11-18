/* ---------- CONFIG ---------- */
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

let data = [];
let loaded = false;
let loadError = false;

/* ---------- INITIAL LOADER ---------- */
document.getElementById("result").innerHTML = `
  <div class="loader-container">
    <div class="loader-bar">
      <div id="loaderFill" class="loader-fill"></div>
    </div>
    <div id="loaderText" class="loader-text">Loading... 0%</div>
  </div>
`;

let progress = 0;
const loaderFill = document.getElementById("loaderFill");
const loaderText = document.getElementById("loaderText");

const progressTimer = setInterval(() => {
  if (progress < 90) {
    progress += Math.random() * 6;
    loaderFill.style.width = progress + "%";
    loaderText.textContent = `Loading... ${Math.floor(progress)}%`;
  }
}, 140);

/* ---------- FETCH DATA ---------- */
fetch(SHEET_URL)
  .then(res => res.text())
  .then(raw => {
    const json = JSON.parse(raw.substring(47).slice(0, -2));

    data = json.table.rows.map(r => {
      const sku = r.c[0]?.v || "";
      const name = r.c[1]?.v || "";
      const barcodes = (r.c[2]?.v || "")
        .split(",")
        .map(b => b.trim())
        .filter(Boolean);

      return {
        sku,
        name,
        barcodes,
        primary: barcodes[0] || "",
        searchSku: sku.toLowerCase(),
        searchBarcodes: barcodes.map(b => b.toLowerCase()),
      };
    });

    clearInterval(progressTimer);

    loaderFill.style.width = "100%";
    loaderText.textContent = "Loading... 100%";

    setTimeout(() => {
      document.getElementById("result").innerHTML = `
        <div style="text-align:center;color:${loaderText.style.color};
        font-weight:600;margin-top:20px;">Ready to search items</div>`;
    }, 300);

    loaded = true;
  })
  .catch(err => {
    console.error("Load error:", err);
    loadError = true;
    clearInterval(progressTimer);

    loaderFill.style.width = "100%";
    loaderText.textContent = "Error!";

    document.getElementById("result").innerHTML = `
      <div style="text-align:center;color:var(--gold);font-weight:600;margin-top:20px;">
        Unable to load data.<br><br>
        <button id="reloadBtn" style="
          padding:8px 16px;border-radius:8px;background:none;
          border:1px solid var(--gold);color:var(--gold);cursor:pointer;">
          Reload
        </button>
      </div>
    `;

    document.getElementById("reloadBtn").onclick = () => location.reload();
  });

/* ---------- SEARCH ---------- */
document.getElementById("searchBox").addEventListener("input", (e) => {
  if (!loaded || loadError) return;

  const q = e.target.value.trim().toLowerCase();
  if (q === "") return (document.getElementById("result").innerHTML = "");

  const results = data.filter(item =>
    item.searchSku.endsWith(q) ||
    item.searchBarcodes.some(b => b.endsWith(q))
  );

  if (!results.length) {
    document.getElementById("result").innerHTML = `
      <div style="text-align:center;color:var(--gold);font-weight:600;margin-top:20px;">
        No matching item found
      </div>`;
    return;
  }

  const item = results[0];

  const bar = item.barcodes.length > 1
    ? `${item.barcodes[0]} <span class="more">…</span>`
    : item.barcodes[0];

  document.getElementById("result").innerHTML = `
    <div class="card">
      <strong>${escape(item.name)}</strong><br>
      SKU: ${escape(item.sku)}<br>
      Barcodes: <span class="barcode-list">${bar}</span>

      <div class="barcode-img">
        <img src="https://barcodeapi.org/api/code128/${encodeURIComponent(
          item.primary
        )}">
      </div>
    </div>
  `;

  const more = document.querySelector(".more");
  if (more) {
    more.onclick = () => {
      document.querySelector(".barcode-list").innerText =
        item.barcodes.join(", ");
    };
  }
});

/* ---------- UTIL ---------- */
function escape(s) {
  return String(s || "").replace(/[&<>"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[c]));
}

/* ---------- THEME ---------- */
const themeToggle = document.getElementById("themeToggle");
const html = document.documentElement;

const saved = localStorage.getItem("theme") || "light";
html.setAttribute("data-theme", saved);
themeToggle.textContent = saved === "light" ? "🌙" : "☀️";

themeToggle.onclick = () => {
  const now = html.dataset.theme === "light" ? "dark" : "light";
  html.dataset.theme = now;
  themeToggle.textContent = now === "light" ? "🌙" : "☀️";
  localStorage.setItem("theme", now);
};
