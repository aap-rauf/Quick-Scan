// ============================================================
// EASY SCAN
// CACHE-FIRST INVENTORY + BACKGROUND SHEET UPDATE
// + LAST 10 SEARCH HISTORY
// ============================================================

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

const INVENTORY_CACHE_KEY = "easyScanInventory";
const INVENTORY_VERSION_KEY = "easyScanInventoryVersion";

// Extra offline backup.
// This keeps a second copy of the processed inventory in Cache Storage,
// so the app can recover even if localStorage is unavailable.
const INVENTORY_BACKUP_CACHE = "easyScanInventoryBackup-v1";
const INVENTORY_BACKUP_URL = "./__easy_scan_inventory_backup__.json";

const SEARCH_HISTORY_KEY = "easyScanSearchHistory";
const MAX_HISTORY = 10;

let data = [];
let dataReady = false;
let loadFailed = false;

let searchHistoryTimer = null;


// ============================================================
// APP START
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

  const resultEl =
    document.getElementById("result");

  const searchBox =
    document.getElementById("searchBox");

  const themeToggle =
    document.getElementById("themeToggle");

  const refreshButton =
    document.getElementById("refreshDataButton");


  // ==========================================================
  // RESTORE THEME
  // ==========================================================

  const savedTheme =
    localStorage.getItem("theme") || "light";

  document.documentElement.setAttribute(
    "data-theme",
    savedTheme
  );

  if (themeToggle) {

    themeToggle.textContent =
      savedTheme === "light"
        ? "🌙"
        : "☀️";

    themeToggle.addEventListener("click", () => {

      const html =
        document.documentElement;

      const current =
        html.getAttribute("data-theme");

      const next =
        current === "light"
          ? "dark"
          : "light";

      html.setAttribute(
        "data-theme",
        next
      );

      localStorage.setItem(
        "theme",
        next
      );

      themeToggle.textContent =
        next === "light"
          ? "🌙"
          : "☀️";

    });

  }


  // ==========================================================
  // TITLE CLICK = MANUAL REFRESH
  // ==========================================================

  if (refreshButton) {

    refreshButton.addEventListener(
      "click",
      () => {

        reloadSheetData();

      }
    );

  }


  // ==========================================================
  // CACHE-FIRST START
  // ==========================================================

  const savedInventory =
    getSavedInventory();


  if (savedInventory) {

    // ------------------------------------------
    // CACHE EXISTS
    // ------------------------------------------

    data = savedInventory;

    dataReady = true;
    loadFailed = false;


    resultEl.innerHTML = "";


    // Show history
    renderHistory();


    // ------------------------------------------
    // IMPORTANT:
    // Search is ready NOW.
    // Google Sheet is checked separately.
    // ------------------------------------------

    updateInventoryInBackground();

  }

  else {

    // ------------------------------------------
    // FIRST EVER START
    // No cache exists yet.
    // Internet is required only once.
    // ------------------------------------------

    showFirstLoad();

  }


  // ==========================================================
  // SEARCH
  // ==========================================================

  searchBox.addEventListener("input", (e) => {

    if (!dataReady) {
      return;
    }


    const q =
      e.target.value
        .trim()
        .toLowerCase();


    // Cancel previous history timer
    clearTimeout(searchHistoryTimer);


    // Empty search
    if (!q) {

      resultEl.innerHTML = "";

      renderHistory();

      return;
    }


    // ========================================================
    // FIND PRODUCTS
    // ========================================================

    const results =
      data.filter(item =>

        item.searchBarcodes.some(
          barcode =>
            barcode.endsWith(q)
        )

        ||

        item.searchSku.endsWith(q)

      );


    // ========================================================
    // NOT FOUND
    // ========================================================

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


    // ========================================================
    // FIRST RESULT
    // ========================================================

    const item =
      results[0];


    // ========================================================
    // BARCODE DISPLAY
    // ========================================================

    const barcodeDisplay =

      item.barcodes.length > 1

        ? `
          ${escapeHtml(item.barcodes[0])}
          <button type="button" class="more" aria-label="Show all barcodes">…</button>
        `

        : escapeHtml(
            item.barcodes[0]
          );


    // ========================================================
    // RESULT CARD
    // ========================================================

    resultEl.innerHTML = `

      <article class="card product-card">
        <h2 class="product-name">
          ${escapeHtml(item.name)}
        </h2>

        <dl class="product-details">
          <div class="product-detail">
            <dt>SKU</dt>
            <dd>${escapeHtml(item.sku)}</dd>
          </div>

          <div class="product-detail">
            <dt>Barcodes</dt>
            <dd>
              <span class="barcode-list">${barcodeDisplay}</span>
            </dd>
          </div>
        </dl>

        <div class="barcode-img">
          <svg
            id="barcodeSvg"
            role="img"
            aria-label="Barcode for ${escapeHtml(item.primaryBarcode)}"
          ></svg>
        </div>
      </article>

    `;


    // ========================================================
    // EXPAND ALL BARCODES
    // ========================================================

    const more =
      document.querySelector(".more");


    if (more) {

      more.addEventListener(
        "click",
        () => {

          const list =
            document.querySelector(
              ".barcode-list"
            );


          if (list) {

            list.innerText =
              item.barcodes.join(", ");

          }

        }
      );

    }


    // ========================================================
    // GENERATE BARCODE
    // ========================================================

    const barcodeSvg =
      document.getElementById(
        "barcodeSvg"
      );


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


    // ========================================================
    // SAVE SEARCH AFTER 2 SECONDS
    // ========================================================

  searchHistoryTimer =
  setTimeout(() => {

    saveSearchHistory(
      q,
      item.name,
      item.primaryBarcode,
      item.sku
    );

  }, 2000);
    
    // Show history underneath card
    setTimeout(() => {

      renderHistory();

    }, 0);

  });

});


// ============================================================
// FIRST EVER LOAD
// ============================================================

function showFirstLoad() {

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
    document.getElementById(
      "loaderFill"
    );

  const loaderText =
    document.getElementById(
      "loaderText"
    );


  let progress = 0;


  const progressInterval =
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


  downloadLatestInventory()

    .then(result => {

      clearInterval(
        progressInterval
      );


      loaderFill.style.width =
        "100%";

      loaderText.textContent =
        "Loading... 100%";


      data =
        result.data;


      dataReady = true;
      loadFailed = false;


      saveInventory(
        result.data,
        result.version
      );


      setTimeout(() => {

        resultEl.innerHTML = "";

        renderHistory();

      }, 260);

    })


    .catch(error => {

      clearInterval(
        progressInterval
      );


      console.error(
        "First inventory load failed:",
        error
      );


      loadFailed = true;
      dataReady = false;


      loaderFill.style.width =
        "100%";

      loaderText.textContent =
        "Error!";


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
        document.getElementById(
          "reloadBtn"
        );


      if (reloadBtn) {

        reloadBtn.addEventListener(
          "click",
          () => location.reload()
        );

      }

    });

}


// ============================================================
// BACKGROUND SHEET CHECK
// ============================================================

async function updateInventoryInBackground() {

  // Do absolutely nothing when offline.
  if (!navigator.onLine) {

    console.log(
      "Easy Scan: Offline. Cache remains active."
    );

    return;

  }


  try {

    const result =
      await downloadLatestInventory();


    const newVersion =
      result.version;


    const oldVersion =
      localStorage.getItem(
        INVENTORY_VERSION_KEY
      );


    // ========================================================
    // NO CHANGE
    // ========================================================

    if (
      oldVersion &&
      oldVersion === newVersion
    ) {

      console.log(
        "Easy Scan: Sheet unchanged."
      );

      return;

    }


    // ========================================================
    // SHEET CHANGED
    // ========================================================

    console.log(
      "Easy Scan: Sheet changed. Updating cache."
    );


    saveInventory(
      result.data,
      newVersion
    );


    // Replace active data
    data =
      result.data;


    dataReady = true;
    loadFailed = false;


    // IMPORTANT:
    // Do NOT destroy the user's current result.
    // The new inventory will be used for the next search.

  }

  catch (error) {

    // NEVER break the app because Sheet is unavailable.

    console.log(
      "Easy Scan: Background update unavailable. Using cache."
    );

  }

}


// ============================================================
// DOWNLOAD GOOGLE SHEET
// ============================================================

async function downloadLatestInventory() {

  const url =
    SHEET_URL +
    "&nocache=" +
    Date.now();


  try {

    const response =
      await fetch(
        url,
        {
          method: "GET",
          cache: "no-store"
        }
      );


    if (!response.ok) {

      throw new Error(
        "Google Sheet HTTP error: " +
        response.status
      );

    }


    const text =
      await response.text();


    const newData =
      processSheetData(text);


    const version =
      createDataVersion(
        newData
      );


    // Save a second offline copy in Cache Storage.
    await saveInventoryBackup(
      newData,
      version
    );


    return {
      data: newData,
      version: version
    };

  }

  catch (networkError) {

    // --------------------------------------------------------
    // OFFLINE FALLBACK
    // --------------------------------------------------------
    // If Google Sheets cannot be reached, recover the last
    // successful inventory from Cache Storage.
    // --------------------------------------------------------

    const backup =
      await getInventoryBackup();


    if (backup) {

      console.log(
        "Easy Scan: Using offline inventory backup."
      );

      return backup;

    }


    throw networkError;

  }

}


// ============================================================
// OFFLINE INVENTORY BACKUP
// ============================================================

async function saveInventoryBackup(
  inventory,
  version
) {

  try {

    const cache =
      await caches.open(
        INVENTORY_BACKUP_CACHE
      );

    const payload =
      JSON.stringify({
        data: inventory,
        version: version
      });


    await cache.put(
      INVENTORY_BACKUP_URL,
      new Response(
        payload,
        {
          headers: {
            "Content-Type":
              "application/json"
          }
        }
      )
    );

  }

  catch (error) {

    console.log(
      "Easy Scan: Could not save offline backup.",
      error
    );

  }

}


async function getInventoryBackup() {

  try {

    const cache =
      await caches.open(
        INVENTORY_BACKUP_CACHE
      );


    const response =
      await cache.match(
        INVENTORY_BACKUP_URL
      );


    if (!response) {
      return null;
    }


    const payload =
      await response.json();


    if (
      !payload ||
      !Array.isArray(payload.data)
    ) {

      return null;

    }


    return {
      data: payload.data,
      version: String(
        payload.version || ""
      )
    };

  }

  catch (error) {

    console.log(
      "Easy Scan: Offline backup unavailable.",
      error
    );

    return null;

  }

}

// ============================================================
// PROCESS GOOGLE SHEET JSON
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
      txt.substring(
        start,
        end + 1
      )
    );


  if (
    !json.table ||
    !Array.isArray(
      json.table.rows
    )
  ) {

    throw new Error(
      "Google Sheet rows not found"
    );

  }


  return json.table.rows.map(
    row => {

      const skuOriginal =
        row.c?.[0]?.v ?? "";


      const nameOriginal =
        row.c?.[1]?.v ?? "";


      const barcodeCell =
        String(
          row.c?.[2]?.v ?? ""
        ).trim();


      const barcodeList =
        barcodeCell

          ? barcodeCell
              .split(",")
              .map(
                b => b.trim()
              )
              .filter(Boolean)

          : [];


      return {

        sku:
          skuOriginal,

        name:
          nameOriginal,

        barcodes:
          barcodeList,

        primaryBarcode:
          barcodeList[0] || "",

        searchSku:
          String(
            skuOriginal
          ).toLowerCase(),

        searchBarcodes:
          barcodeList.map(
            b =>
              b.toLowerCase()
          )

      };

    }
  );

}


// ============================================================
// SAVE INVENTORY CACHE
// ============================================================

function saveInventory(
  inventory,
  version
) {

  try {

    localStorage.setItem(
      INVENTORY_CACHE_KEY,
      JSON.stringify(
        inventory
      )
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
// GET INVENTORY CACHE
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
      "Inventory cache error:",
      error
    );


    return null;

  }

}


// ============================================================
// INVENTORY VERSION
// ============================================================

function createDataVersion(
  inventory
) {

  const text =
    JSON.stringify(
      inventory
    );


  let hash = 0;


  for (
    let i = 0;
    i < text.length;
    i++
  ) {

    hash =
      (
        (hash << 5) -
        hash
      ) +
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
    document.getElementById(
      "result"
    );


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
    document.getElementById(
      "loaderFill"
    );

  const loaderText =
    document.getElementById(
      "loaderText"
    );


  let progress = 0;


  const interval =
    setInterval(() => {

      if (progress < 93) {

        progress +=
          Math.random() * 6;


        loaderFill.style.width =
          progress + "%";


        loaderText.textContent =
          `Refreshing... ${Math.floor(progress)}%`;

      }

    }, 130);


  try {

    const result =
      await downloadLatestInventory();


    clearInterval(
      interval
    );


    loaderFill.style.width =
      "100%";


    loaderText.textContent =
      "Refreshing... 100%";


    const oldVersion =
      localStorage.getItem(
        INVENTORY_VERSION_KEY
      );


    // ========================================================
    // CHANGED
    // ========================================================

    if (
      !oldVersion ||
      oldVersion !== result.version
    ) {

      saveInventory(
        result.data,
        result.version
      );


      data =
        result.data;


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

      data =
        result.data;


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

    clearInterval(
      interval
    );


    console.log(
      "Manual refresh failed. Existing cache remains available."
    );


    const saved =
      getSavedInventory();


    if (saved) {

      data =
        saved;


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

  }

}


// ============================================================
// SEARCH HISTORY
// ============================================================

function getSearchHistory() {

  try {

    const saved =
      localStorage.getItem(
        SEARCH_HISTORY_KEY
      );


    if (!saved) {
      return [];
    }


    const history =
      JSON.parse(saved);


    return Array.isArray(history)
      ? history
      : [];

  }

  catch (error) {

    return [];

  }

}


// ============================================================
// SAVE SEARCH
// ============================================================

function saveSearchHistory(
  query,
  productName,
  barcode,
  sku
) {

  query =
    String(query || "")
      .trim();

  if (!query) {
    return;
  }

  let history =
    getSearchHistory();

  // Convert old history strings to objects
  history =
    history.map(item => {

      if (typeof item === "string") {

        return {
          query: item,
          name: "",
          barcode: "",
          sku: ""
        };

      }

      return item;

    });

  // Remove duplicate search
  history =
    history.filter(item =>
      String(item.query || "").toLowerCase() !==
      query.toLowerCase()
    );

  // Add newest first
  history.unshift({
    query: query,
    name: String(productName || ""),
    barcode: String(barcode || ""),
    sku: String(sku || "")
  });

  // Keep only 10
  history =
    history.slice(
      0,
      MAX_HISTORY
    );

  localStorage.setItem(
    SEARCH_HISTORY_KEY,
    JSON.stringify(history)
  );

  renderHistory();

}


// ============================================================
// DISPLAY HISTORY
// ============================================================

function renderHistory() {

  const resultEl =
    document.getElementById(
      "result"
    );

  if (!resultEl) {
    return;
  }

  const history =
    getSearchHistory();

  if (history.length === 0) {
    return;
  }

  // Remove old history
  const oldHistory =
    document.querySelector(
      ".search-history"
    );

  if (oldHistory) {
    oldHistory.remove();
  }

  const historyContainer =
    document.createElement(
      "div"
    );

  historyContainer.className =
    "search-history";

  historyContainer.innerHTML = `

    <div class="search-history-title">
      Search History
    </div>

    <div class="search-history-list">

      ${history.map(
        (item, index) => {

          // Support old history
          if (typeof item === "string") {
            item = {
              query: item,
              name: ""
            };
          }

          return `

            <button
              class="search-history-item"
              data-history-index="${index}"
            >

              <span class="history-product-name">
                ${escapeHtml(
                  item.name || "Previous Search"
                )}
              </span>

              <span class="history-search-value">
                ${escapeHtml(
                  item.query || ""
                )}
              </span>

            </button>

          `;

        }
      ).join("")}

    </div>

  `;

  resultEl.appendChild(
    historyContainer
  );


  // ==========================================================
  // HISTORY CLICK
  // ==========================================================

  historyContainer
    .querySelectorAll(
      ".search-history-item"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const index =
            Number(
              button.dataset
                .historyIndex
            );

          const selected =
            history[index];

          if (!selected) {
            return;
          }

          const searchBox =
            document.getElementById(
              "searchBox"
            );

          if (!searchBox) {
            return;
          }

          const searchValue =
            typeof selected === "string"
              ? selected
              : selected.query;

          searchBox.value =
            searchValue;

          searchBox.dispatchEvent(
            new Event(
              "input",
              {
                bubbles: true
              }
            )
          );

        }
      );

    });

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
