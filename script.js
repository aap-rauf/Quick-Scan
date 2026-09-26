```javascript
// ============================================================
// EASY SCAN
// CACHE-FIRST INVENTORY + BACKGROUND SHEET UPDATE
// + LAST 10 SEARCH HISTORY WITH PRODUCT NAME
// ============================================================

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

const INVENTORY_CACHE_KEY = "easyScanInventory";
const INVENTORY_VERSION_KEY = "easyScanInventoryVersion";

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

    data = savedInventory;

    dataReady = true;
    loadFailed = false;

    resultEl.innerHTML = "";

    renderHistory();

    updateInventoryInBackground();

  }

  else {

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

          <span class="more">…</span>

        `

        : escapeHtml(
            item.barcodes[0]
          );


    // ========================================================
    // RESULT CARD
    // ========================================================

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
    // NOW SAVES PRODUCT NAME + SEARCH VALUE
    // ========================================================

    searchHistoryTimer =
      setTimeout(() => {

        saveSearchHistory({
          query: q,
          name: item.name || "",
          sku: item.sku || "",
          barcode: item.primaryBarcode || ""
        });

      }, 2000);


    // ========================================================
    // SHOW HISTORY UNDER CARD
    // ========================================================

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


    data =
      result.data;


    dataReady = true;
    loadFailed = false;

  }


  catch (error) {

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


  return {
    data: newData,
    version: version
  };

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

        renderHistory();

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

        renderHistory();

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


    if (!Array.isArray(history)) {
      return [];
    }


    /*
      Convert old history format.

      Old format:
      ["123456", "789012"]

      New format:
      [
        {
          query: "123456",
          name: "Product Name",
          barcode: "123456",
          sku: "SKU001"
        }
      ]
    */

    return history.map(item => {

      if (typeof item === "string") {

        return {
          query: item,
          name: "",
          barcode: item,
          sku: ""
        };

      }

      return {
        query: String(item.query || ""),
        name: String(item.name || ""),
        barcode: String(item.barcode || ""),
        sku: String(item.sku || "")
      };

    });

  }

  catch (error) {

    console.error(
      "Search history read failed:",
      error
    );

    return [];

  }

}


// ============================================================
// SAVE SEARCH
// ============================================================

function saveSearchHistory(
  searchItem
) {

  /*
    New search object
  */

  if (
    !searchItem ||
    typeof searchItem !== "object"
  ) {
    return;
  }


  const query =
    String(
      searchItem.query || ""
    ).trim();


  if (!query) {
    return;
  }


  let history =
    getSearchHistory();


  // ==========================================================
  // REMOVE DUPLICATE
  // ==========================================================

  history =
    history.filter(
      item =>
        String(item.query || "")
          .toLowerCase() !==
        query.toLowerCase()
    );


  // ==========================================================
  // ADD NEWEST FIRST
  // ==========================================================

  history.unshift({

    query: query,

    name:
      String(
        searchItem.name || ""
      ),

    barcode:
      String(
        searchItem.barcode || ""
      ),

    sku:
      String(
        searchItem.sku || ""
      )

  });


  // ==========================================================
  // KEEP ONLY 10
  // ==========================================================

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


  // ==========================================================
  // REMOVE OLD HISTORY FIRST
  // ==========================================================

  const oldHistory =
    resultEl.querySelector(
      ".search-history"
    );


  if (oldHistory) {
    oldHistory.remove();
  }


  if (history.length === 0) {
    return;
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

          /*
            What should be searched again?
            Prefer the original query.
          */

          const searchValue =
            item.query ||
            item.barcode ||
            item.sku ||
            "";


          /*
            Product name.
            Old history entries may not have
            a product name, so show the search
            value instead.
          */

          const productName =
            item.name ||
            "Previous Search";


          return `

            <button
              class="search-history-item"
              data-history-index="${index}"
            >

              <div
                class="history-product-name"
              >
                ${escapeHtml(productName)}
              </div>

              <div
                class="history-search-value"
              >
                ${escapeHtml(searchValue)}
              </div>

            </button>

          `;

        }

      ).join("")}
    </div>

  `;


  // ==========================================================
  // PUT HISTORY AFTER THE PRODUCT CARD
  // ==========================================================

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


          /*
            Search using the same barcode/SKU
            that was originally entered.
          */

          searchBox.value =
            selected.query ||
            selected.barcode ||
            selected.sku ||
            "";


          // Trigger the normal search
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
```
