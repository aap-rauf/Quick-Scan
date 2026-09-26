// ============================================================
// EASY SCAN
// Automatic Google Sheet update + offline inventory
// ============================================================

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

const INVENTORY_CACHE_KEY = "easyScanInventory";
const INVENTORY_VERSION_KEY = "easyScanInventoryVersion";

let data = [];
let dataReady = false;
let loadFailed = false;
let progressInterval;


// ============================================================
// START APP
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

  const resultEl = document.getElementById("result");
  const searchBox = document.getElementById("searchBox");
  const themeToggle = document.getElementById("themeToggle");
  const refreshButton = document.getElementById("refreshDataButton");


  // ==========================================================
  // THEME
  // ==========================================================

  const savedTheme =
    localStorage.getItem("theme") || "light";

  document.documentElement.setAttribute(
    "data-theme",
    savedTheme
  );

  if (themeToggle) {
    themeToggle.textContent =
      savedTheme === "light" ? "🌙" : "☀️";

    themeToggle.addEventListener("click", () => {

      const html = document.documentElement;

      const current =
        html.getAttribute("data-theme");

      const next =
        current === "light" ? "dark" : "light";

      html.setAttribute("data-theme", next);

      localStorage.setItem("theme", next);

      themeToggle.textContent =
        next === "light" ? "🌙" : "☀️";
    });
  }


  // ==========================================================
  // TITLE = REFRESH
  // ==========================================================

  if (refreshButton) {

    refreshButton.addEventListener("click", () => {
      reloadSheetData();
    });

  }


  // ==========================================================
  // FIRST: TRY SAVED INVENTORY
  // ==========================================================

  const savedInventory =
    getSavedInventory();


  if (savedInventory) {

    data = savedInventory;

    dataReady = true;
    loadFailed = false;

    resultEl.innerHTML = `
      <div style="
        text-align:center;
        color:var(--color-accent);
        font-weight:600;
        margin-top:8px;
      ">
        Ready to Search
      </div>
    `;

    // Check Google Sheet in background
    updateInventoryInBackground();

  }

  else {

    // No saved data yet
    showLoading();

  }


  // ==========================================================
  // SEARCH
  // ==========================================================

  searchBox.addEventListener("input", (e) => {

    if (!dataReady) return;

    const q =
      e.target.value.trim().toLowerCase();


    // Empty search
    if (!q) {

      resultEl.innerHTML = "";

      return;
    }


    // Search
    const results = data.filter(item =>

      item.searchBarcodes.some(b =>
        b.endsWith(q)
      ) ||

      item.searchSku.endsWith(q)

    );


    // Not found
    if (results.length === 0) {

      resultEl.innerHTML = `
        <div style="
          text-align:center;
          color:var(--color-accent);
          font-weight:600;
          margin-top:8px;
        ">
          Not Found
        </div>
      `;

      return;
    }


    const item = results[0];


    const barcodeDisplay =
      item.barcodes.length > 1

        ? `${escapeHtml(item.barcodes[0])}
           <span class="more">…</span>`

        : escapeHtml(item.barcodes[0]);


    resultEl.innerHTML = `
      <div class="card">

        <strong>
          ${escapeHtml(item.name)}
        </strong>

        <br>

        SKU:
        ${escapeHtml(item.sku)}

        <br>

        Barcodes:
        <span class="barcode-list">
          ${barcodeDisplay}
        </span>

        <br><br>

        <div class="barcode-img">
          <svg id="barcodeSvg"></svg>
        </div>

      </div>
    `;


    // ========================================================
    // EXPAND BARCODE LIST
    // ========================================================

    const more =
      document.querySelector(".more");

    if (more) {

      more.addEventListener("click", () => {

        const list =
          document.querySelector(".barcode-list");

        if (list) {

          list.innerText =
            item.barcodes.join(", ");

        }

      });

    }


    // ========================================================
    // BARCODE
    // ========================================================

    const barcodeSvg =
      document.getElementById("barcodeSvg");


    if (
      barcodeSvg &&
      item.primaryBarcode &&
      typeof JsBarcode !== "undefined"
    ) {

      JsBarcode(
        barcodeSvg,
        item.primaryBarcode,
        {
          format: "code128",
          lineColor: "#000",
          width: 2.2,
          height: 100,
          displayValue: false,
          margin: 8
        }
      );

    }

  });

});


// ============================================================
// SHOW LOADING SCREEN
// ============================================================

function showLoading() {

  const resultEl =
    document.getElementById("result");


  resultEl.innerHTML = `
    <div class="loader-container">

      <div class="loader-bar">
        <div
          id="loaderFill"
          class="loader-fill"
          style="width:0%"
        ></div>
      </div>

      <div
        id="loaderText"
        class="loader-text"
      >
        Loading... 0%
      </div>

    </div>
  `;


  const loaderFill =
    document.getElementById("loaderFill");

  const loaderText =
    document.getElementById("loaderText");


  let progress = 0;


  progressInterval =
    setInterval(() => {

      if (progress < 92) {

        progress =
          Math.min(
            92,
            progress + Math.random() * 6
          );

        loaderFill.style.width =
          progress + "%";

        loaderText.textContent =
          `Loading... ${Math.floor(progress)}%`;

      }

    }, 140);


  // First download
  downloadLatestInventory()
    .then(result => {

      clearInterval(progressInterval);

      loaderFill.style.width = "100%";
      loaderText.textContent =
        "Loading... 100%";


      if (result.success) {

        data = result.data;

        dataReady = true;
        loadFailed = false;


        setTimeout(() => {

          resultEl.innerHTML = `
            <div style="
              text-align:center;
              color:var(--color-accent);
              font-weight:600;
              margin-top:8px;
            ">
              Ready to Search
            </div>
          `;

        }, 260);

      }

    })
    .catch(error => {

      clearInterval(progressInterval);

      console.error(
        "Initial inventory download failed:",
        error
      );


      // No inventory has ever been saved
      loadFailed = true;
      dataReady = false;


      loaderFill.style.width = "100%";
      loaderText.textContent = "Error!";


      resultEl.innerHTML = `
        <div style="
          text-align:center;
          color:var(--color-accent);
          font-weight:600;
          margin-top:8px;
        ">

          Loading Failed,<br>
          Check your Network Connection.<br><br>

          <button
            id="reloadBtn"
            style="
              background:transparent;
              border:1px solid var(--color-accent);
              color:var(--color-accent);
              border-radius:8px;
              padding:8px 16px;
              font-size:15px;
              font-weight:600;
              cursor:pointer;
            "
          >
            ⟳ Reload
          </button>

        </div>
      `;


      const reloadBtn =
        document.getElementById("reloadBtn");


      if (reloadBtn) {

        reloadBtn.addEventListener(
          "click",
          () => location.reload()
        );

      }

    });

}


// ============================================================
// BACKGROUND INVENTORY UPDATE
// ============================================================

async function updateInventoryInBackground() {

  // If browser is definitely offline, don't try.
  if (!navigator.onLine) {

    console.log(
      "Easy Scan: Offline. Using saved inventory."
    );

    return;
  }


  try {

    const result =
      await downloadLatestInventory();


    if (!result.success) return;


    const newData = result.data;


    const newVersion =
      createDataVersion(newData);


    const oldVersion =
      localStorage.getItem(
        INVENTORY_VERSION_KEY
      );


    // ========================================================
    // SHEET CHANGED
    // ========================================================

    if (
      !oldVersion ||
      oldVersion !== newVersion
    ) {

      saveInventory(
        newData,
        newVersion
      );


      data = newData;

      dataReady = true;
      loadFailed = false;


      console.log(
        "Easy Scan: Google Sheet changed. Inventory updated."
      );


      // Only show notification if user isn't currently
      // looking at a search result.
      const searchBox =
        document.getElementById("searchBox");

      const resultEl =
        document.getElementById("result");


      if (
        searchBox &&
        searchBox.value.trim() === ""
      ) {

        resultEl.innerHTML = `
          <div style="
            text-align:center;
            color:var(--color-accent);
            font-weight:600;
            margin-top:8px;
          ">
            Inventory Updated — Ready to Search
          </div>
        `;

      }

    }

    else {

      console.log(
        "Easy Scan: Google Sheet unchanged."
      );

    }

  }

  catch (error) {

    // IMPORTANT:
    // Never break the app because Google Sheet
    // cannot be reached.

    console.log(
      "Easy Scan: Could not check Google Sheet. Saved inventory remains active."
    );

  }

}


// ============================================================
// DOWNLOAD LATEST GOOGLE SHEET
// ============================================================

async function downloadLatestInventory() {

  const url =
    SHEET_URL +
    "&nocache=" +
    Date.now();


  const response =
    await fetch(url, {
      method: "GET",
      cache: "no-store"
    });


  if (!response.ok) {

    throw new Error(
      "Google Sheet request failed: " +
      response.status
    );

  }


  const text =
    await response.text();


  const newData =
    processSheetData(text);


  return {
    success: true,
    data: newData
  };

}


// ============================================================
// PROCESS GOOGLE SHEET
// ============================================================

function processSheetData(txt) {

  const start =
    txt.indexOf("{");

  const end =
    txt.lastIndexOf("}");


  if (
    start === -1 ||
    end === -1
  ) {

    throw new Error(
      "Invalid Google Sheet response"
    );

  }


  const json =
    JSON.parse(
      txt.substring(start, end + 1)
    );


  if (
    !json.table ||
    !Array.isArray(json.table.rows)
  ) {

    throw new Error(
      "Google Sheet data not found"
    );

  }


  return json.table.rows.map(r => {

    const skuOriginal =
      r.c?.[0]?.v ?? "";

    const nameOriginal =
      r.c?.[1]?.v ?? "";

    const barcodeCell =
      String(
        r.c?.[2]?.v ?? ""
      ).trim();


    const barcodeList =
      barcodeCell

        ? barcodeCell
            .split(",")
            .map(b => b.trim())
            .filter(Boolean)

        : [];


    return {

      sku: skuOriginal,

      name: nameOriginal,

      barcodes: barcodeList,

      primaryBarcode:
        barcodeList[0] || "",

      searchSku:
        String(skuOriginal)
          .toLowerCase(),

      searchBarcodes:
        barcodeList.map(
          b => b.toLowerCase()
        )

    };

  });

}


// ============================================================
// SAVE INVENTORY
// ============================================================

function saveInventory(
  inventory,
  version
) {

  try {

    localStorage.setItem(
      INVENTORY_CACHE_KEY,
      JSON.stringify(inventory)
    );

    localStorage.setItem(
      INVENTORY_VERSION_KEY,
      version
    );

  }

  catch (error) {

    console.error(
      "Could not save inventory:",
      error
    );

  }

}


// ============================================================
// GET SAVED INVENTORY
// ============================================================

function getSavedInventory() {

  try {

    const saved =
      localStorage.getItem(
        INVENTORY_CACHE_KEY
      );


    if (!saved) {
      return null;
    }


    const parsed =
      JSON.parse(saved);


    if (!Array.isArray(parsed)) {
      return null;
    }


    return parsed;

  }

  catch (error) {

    console.error(
      "Saved inventory error:",
      error
    );

    return null;

  }

}


// ============================================================
// CREATE VERSION
// ============================================================

function createDataVersion(inventory) {

  const text =
    JSON.stringify(inventory);


  let hash = 0;


  for (
    let i = 0;
    i < text.length;
    i++
  ) {

    hash =
      ((hash << 5) - hash) +
      text.charCodeAt(i);

    hash |= 0;

  }


  return String(hash);

}


// ============================================================
// MANUAL REFRESH
// ============================================================

async function reloadSheetData() {

  const resultEl =
    document.getElementById("result");


  resultEl.innerHTML = `
    <div class="loader-container">

      <div class="loader-bar">

        <div
          id="loaderFill"
          class="loader-fill"
          style="width:0%"
        ></div>

      </div>

      <div
        id="loaderText"
        class="loader-text"
      >
        Refreshing... 0%
      </div>

    </div>
  `;


  const loaderFill =
    document.getElementById("loaderFill");

  const loaderText =
    document.getElementById("loaderText");


  let progress = 0;


  const interval =
    setInterval(() => {

      if (progress < 93) {

        progress += Math.random() * 6;

        loaderFill.style.width =
          progress + "%";

        loaderText.textContent =
          `Refreshing... ${Math.floor(progress)}%`;

      }

    }, 130);


  try {

    const result =
      await downloadLatestInventory();


    clearInterval(interval);


    loaderFill.style.width = "100%";

    loaderText.textContent =
      "Refreshing... 100%";


    const newData =
      result.data;


    const newVersion =
      createDataVersion(newData);


    const oldVersion =
      localStorage.getItem(
        INVENTORY_VERSION_KEY
      );


    // ========================================================
    // CHANGED
    // ========================================================

    if (
      !oldVersion ||
      oldVersion !== newVersion
    ) {

      saveInventory(
        newData,
        newVersion
      );


      data = newData;

      dataReady = true;
      loadFailed = false;


      setTimeout(() => {

        resultEl.innerHTML = `
          <div style="
            text-align:center;
            color:var(--color-accent);
            font-weight:600;
            margin-top:8px;
          ">
            Inventory Updated — Ready to Search
          </div>
        `;

      }, 260);

    }

    // ========================================================
    // NO CHANGE
    // ========================================================

    else {

      data = newData;

      dataReady = true;
      loadFailed = false;


      setTimeout(() => {

        resultEl.innerHTML = `
          <div style="
            text-align:center;
            color:var(--color-accent);
            font-weight:600;
            margin-top:8px;
          ">
            No Changes — Ready to Search
          </div>
        `;

      }, 260);

    }

  }

  catch (error) {

    clearInterval(interval);

    console.error(
      "Refresh failed:",
      error
    );


    // Keep existing inventory.
    const saved =
      getSavedInventory();


    if (saved) {

      data = saved;

      dataReady = true;
      loadFailed = false;


      resultEl.innerHTML = `
        <div style="
          text-align:center;
          color:var(--color-accent);
          font-weight:600;
          margin-top:8px;
        ">
          Offline — Saved Inventory Available
        </div>
      `;

    }

    else {

      resultEl.innerHTML = `
        <div style="
          text-align:center;
          color:var(--color-accent);
          font-weight:600;
          margin-top:8px;
        ">
          Failed to Refresh.
        </div>
      `;

    }

  }

}


// ============================================================
// ESCAPE HTML
// ============================================================

function escapeHtml(s) {

  return String(s || "")
    .replace(
      /[&<>"']/g,
      function (m) {

        return ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"

        }[m] || m);

      }
    );

}
