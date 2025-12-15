const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

let data = [];
let historyData = JSON.parse(localStorage.getItem("searchHistory") || "[]");

document.addEventListener("DOMContentLoaded", () => {
  const searchBox = document.getElementById("searchBox");
  const resultEl = document.getElementById("result");
  const historySheet = document.getElementById("historySheet");
  const historyList = document.getElementById("historyList");
  const themeToggle = document.getElementById("themeToggle");

  fetch(SHEET_URL)
    .then(r => r.text())
    .then(txt => {
      const json = JSON.parse(txt.substr(47).slice(0, -2));
      data = json.table.rows.map(r => ({
        sku: r.c[0]?.v || "",
        name: r.c[1]?.v || "",
        barcodes: (r.c[2]?.v || "").toString().split(",").map(b => b.trim()),
        searchSku: (r.c[0]?.v || "").toLowerCase(),
        searchBarcodes: ((r.c[2]?.v || "") + "").toLowerCase().split(",")
      }));
    });

  searchBox.addEventListener("input", () => {
    const q = searchBox.value.trim().toLowerCase();
    if (!q) return resultEl.innerHTML = "";

    const item = data.find(i =>
      i.searchSku.endsWith(q) ||
      i.searchBarcodes.some(b => b.endsWith(q))
    );

    if (!item) {
      resultEl.innerHTML = "<div class='card glass'>Not Found</div>";
      return;
    }

    resultEl.innerHTML = `
      <div class="card glass">
        <strong>${item.name}</strong><br>
        SKU: ${item.sku}<br>
        Barcode: ${item.barcodes[0]}
        <svg id="barcodeSvg"></svg>
      </div>
    `;

    JsBarcode("#barcodeSvg", item.barcodes[0], { displayValue:false });

    saveHistory(q, item.name);
  });

  function saveHistory(text, name) {
    historyData = historyData.filter(h => h.text !== text);
    historyData.unshift({ text, name });
    if (historyData.length > 30) historyData.pop();
    localStorage.setItem("searchHistory", JSON.stringify(historyData));
    renderHistory();
  }

  function renderHistory() {
    historyList.innerHTML = "";
    historyData.forEach((h,i) => {
      const div = document.createElement("div");
      div.className = "history-item";
      div.innerHTML = `
        <div><strong>${h.text}</strong><br>${h.name}</div>
        <button onclick="deleteHistory(${i})">×</button>
      `;
      historyList.appendChild(div);
    });
  }

  window.deleteHistory = i => {
    historyData.splice(i,1);
    localStorage.setItem("searchHistory", JSON.stringify(historyData));
    renderHistory();
  };

  renderHistory();

  /* DRAG SHEET */
  let startY = 0, current = -historySheet.offsetHeight;

  historySheet.addEventListener("touchstart", e => {
    startY = e.touches[0].clientY;
    historySheet.style.transition = "none";
  });

  historySheet.addEventListener("touchmove", e => {
    let diff = startY - e.touches[0].clientY;
    let next = Math.min(0, Math.max(-historySheet.offsetHeight, current + diff));
    historySheet.style.bottom = next + "px";
  });

  historySheet.addEventListener("touchend", e => {
    historySheet.style.transition = "bottom 0.3s ease";
    historySheet.style.bottom =
      parseInt(historySheet.style.bottom) > -historySheet.offsetHeight / 2
        ? "0"
        : "-70%";
    current = parseInt(historySheet.style.bottom);
  });

  /* THEME */
  themeToggle.onclick = () => {
    const html = document.documentElement;
    const next = html.dataset.theme === "light" ? "dark" : "light";
    html.dataset.theme = next;
    localStorage.setItem("theme", next);
  };

  document.documentElement.dataset.theme =
    localStorage.getItem("theme") || "light";
});
