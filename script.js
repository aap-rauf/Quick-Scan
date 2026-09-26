```javascript
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

const INVENTORY_CACHE_KEY = "easyScanInventory";
const INVENTORY_VERSION_KEY = "easyScanInventoryVersion";
const SEARCH_HISTORY_KEY = "easyScanSearchHistory";

const MAX_HISTORY = 10;
const APP_VERSION = "1.1.0";

let data = [];
let dataReady = false;
let loadFailed = false;
let progressInterval;
let searchSaveTimer = null;

document.addEventListener("DOMContentLoaded", () => {
  const resultEl = document.getElementById("result");
  const searchBox = document.getElementById("searchBox");
  const themeToggle = document.getElementById("themeToggle");
  const titleButton = document.getElementById("refreshDataButton");

  /* =========================================================
     THEME
  ========================================================= */

  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);

  if (themeToggle) {
    themeToggle.textContent = savedTheme === "dark" ? "☀️" : "🌙";

    themeToggle.addEventListener("click", () => {
      const currentTheme =
        document.documentElement.getAttribute("data-theme");

      const newTheme = currentTheme === "dark" ? "light" : "dark";

      document.documentElement.setAttribute("data-theme", newTheme);
      localStorage.setItem("theme", newTheme);

      themeToggle.textContent = newTheme === "dark" ? "☀️" : "🌙";
    });
  }

  /* =========================================================
     LEFT MENU
  ========================================================= */

  createMenu();

  /* =========================================================
     EASY SCAN TITLE = MANUAL REFRESH
  ========================================================= */

  if (titleButton) {
    titleButton.addEventListener("click", () => {
      reloadSheetData();
    });
  }

  /* =========================================================
     STARTUP
     CACHE FIRST
  ========================================================= */

  const savedInventory = getSavedInventory();

  if (savedInventory && savedInventory.length > 0) {
    data = savedInventory;
    dataReady = true;
    loadFailed = false;

    resultEl.innerHTML = "";

    renderHistory();

    // Check Google Sheet in background
    updateInventoryInBackground();
  } else {
    showFirstLoad();
  }

  /* =========================================================
     SEARCH
  ========================================================= */

  searchBox.addEventListener("input", () => {
    if (loadFailed || !dataReady) return;

    const q = searchBox.value.trim().toLowerCase();

    clearTimeout(searchSaveTimer);

    if (!q) {
      resultEl.innerHTML = "";
      renderHistory();
      return;
    }

    const results = data.filter(item =>
      item.searchBarcodes.some(barcode => barcode.endsWith(q)) ||
      item.searchSku.endsWith(q)
    );

    if (results.length === 0) {
      resultEl.innerHTML = `
        <div style="
          text-align:center;
          color:var(--color-accent);
          font-weight:600;
          margin-top:20px;
        ">
          Not Found
        </div>
      `;

      renderHistory();
      return;
    }

    const item = results[0];

    const barcodeList = item.barcodes || [];

    let barcodeDisplay = "";

    if (barcodeList.length === 0) {
      barcodeDisplay = "-";
    } else if (barcodeList.length === 1) {
      barcodeDisplay = escapeHtml(barcodeList[0]);
    } else {
      barcodeDisplay =
        escapeHtml(barcodeList[0]) +
        ` <span class="more">+${barcodeList.length - 1} more</span>`;
    }

    resultEl.innerHTML = `
      <div class="card">

        <strong>${escapeHtml(item.name)}</strong><br>

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

    /* =====================================================
       SHOW ALL BARCODES
    ===================================================== */

    const moreButton = resultEl.querySelector(".more");

    if (moreButton) {
      moreButton.addEventListener("click", () => {
        const barcodeElement =
          resultEl.querySelector(".barcode-list");

        if (!barcodeElement) return;

        barcodeElement.classList.add("expanded");

        barcodeElement.innerHTML = barcodeList
          .map(barcode => escapeHtml(barcode))
          .join("<br>");
      });
    }

    /* =====================================================
       GENERATE BARCODE
    ===================================================== */

    if (
      item.primaryBarcode &&
      typeof JsBarcode !== "undefined"
    ) {
      try {
        JsBarcode("#barcodeSvg", item.primaryBarcode, {
          format: "CODE128",
          lineColor: "#000",
          width: 2.2,
          height: 100,
          displayValue: false,
          margin: 8
        });
      } catch (error) {
        console.error("Barcode generation failed:", error);
      }
    }

    /* =====================================================
       SAVE SEARCH AFTER 2 SECONDS
    ===================================================== */

    searchSaveTimer = setTimeout(() => {
      saveSearchHistory({
        query: q,
        name: item.name || "",
        sku: item.sku || "",
        barcode: item.primaryBarcode || ""
      });

      renderHistory();
    }, 2000);

    /* =====================================================
       HISTORY
    ===================================================== */

    renderHistory();
  });

  /* =========================================================
     CREATE MENU
  ========================================================= */

  function createMenu() {
    // Do not create it twice
    if (document.getElementById("easyScanMenu")) return;

    const menuOverlay = document.createElement("div");
    menuOverlay.id = "easyScanMenuOverlay";

    menuOverlay.innerHTML = `
      <div
        id="easyScanMenu"
        class="easy-scan-menu"
        aria-hidden="true"
      >

        <div class="menu-header">
          <strong>Easy Scan</strong>

          <button
            id="closeEasyScanMenu"
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>

        <div class="menu-content">

          <div class="menu-item menu-disabled">

            <div>
              <div class="menu-item-title">
                PO Maker
              </div>

              <div class="menu-item-subtitle">
                Coming Soon
              </div>
            </div>

          </div>

          <div class="menu-divider"></div>

          <div class="menu-item app-version">

            <div>
              <div class="menu-item-title">
                App Version
              </div>

              <div class="menu-item-subtitle">
                ${APP_VERSION}
              </div>
            </div>

          </div>

        </div>

      </div>
    `;

    document.body.appendChild(menuOverlay);

    addMenuStyles();

    const menu = document.getElementById("easyScanMenu");
    const closeButton =
      document.getElementById("closeEasyScanMenu");

    // Create hamburger button
    const header = document.querySelector("header");

    if (header) {
      const hamburger = document.createElement("button");

      hamburger.id = "menuButton";
      hamburger.type = "button";
      hamburger.setAttribute("aria-label", "Open menu");
      hamburger.innerHTML = "☰";

      /*
        Put hamburger before the Easy Scan title.
      */
      header.insertBefore(
        hamburger,
        header.firstElementChild
      );

      hamburger.addEventListener("click", openMenu);
    }

    function openMenu() {
      menuOverlay.classList.add("menu-open");
      menu.classList.add("menu-visible");
      menu.setAttribute("aria-hidden", "false");
    }

    function closeMenu() {
      menuOverlay.classList.remove("menu-open");
      menu.classList.remove("menu-visible");
      menu.setAttribute("aria-hidden", "true");
    }

    closeButton.addEventListener("click", closeMenu);

    menuOverlay.addEventListener("click", event => {
      if (event.target === menuOverlay) {
        closeMenu();
      }
    });

    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        closeMenu();
      }
    });
  }

  /* =========================================================
     MENU CSS
  ========================================================= */

  function addMenuStyles() {
    if (document.getElementById("easyScanMenuStyles")) return;

    const style = document.createElement("style");

    style.id = "easyScanMenuStyles";

    style.textContent = `

      #menuButton {
        background: transparent;
        border: none;
        font-size: 24px;
        line-height: 1;
        padding: 4px 8px 4px 0;
        margin: 0;
        color: inherit;
        cursor: pointer;
        flex-shrink: 0;
      }

      #easyScanMenuOverlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0);
        pointer-events: none;
        z-index: 9998;
        transition: background 0.25s ease;
      }

      #easyScanMenuOverlay.menu-open {
        background: rgba(0,0,0,0.35);
        pointer-events: auto;
      }

      .easy-scan-menu {
        position: absolute;
        top: 0;
        left: 0;
        width: 280px;
        max-width: 82vw;
        height: 100%;
        box-sizing: border-box;

        background: var(--color-bg-light);
        color: var(--color-text-light);

        box-shadow: 4px 0 18px rgba(0,0,0,0.18);

        transform: translateX(-100%);
        transition: transform 0.25s ease;

        display: flex;
        flex-direction: column;
      }

      html[data-theme="dark"] .easy-scan-menu {
        background: #121212;
        color: #f0f0f0;
      }

      .easy-scan-menu.menu-visible {
        transform: translateX(0);
      }

      .menu-header {
        display: flex;
        align-items: center;
        justify-content: space-between;

        padding: 18px 16px;

        border-bottom: 1px solid rgba(128,128,128,0.2);
      }

      .menu-header strong {
        color: var(--color-accent);
        font-size: 20px;
      }

      .menu-header button {
        background: transparent;
        border: none;
        color: inherit;
        font-size: 22px;
        cursor: pointer;
        padding: 4px 6px;
      }

      .menu-content {
        padding: 10px 0;
      }

      .menu-item {
        display: flex;
        align-items: center;
        justify-content: space-between;

        padding: 15px 18px;

        box-sizing: border-box;
      }

      .menu-disabled {
        cursor: default;
        opacity: 0.85;
      }

      .menu-item-title {
        font-size: 16px;
        font-weight: 600;
      }

      .menu-item-subtitle {
        margin-top: 4px;
        font-size: 13px;
        opacity: 0.65;
      }

      .menu-divider {
        height: 1px;
        margin: 4px 16px;

        background: rgba(128,128,128,0.2);
      }

      .app-version .menu-item-subtitle {
        color: var(--color-accent);
        opacity: 1;
        font-weight: 600;
      }

      html[data-theme="dark"] #easyScanMenuOverlay.menu-open {
        background: rgba(0,0,0,0.55);
      }

    `;

    document.head.appendChild(style);
  }

  /* =========================================================
     SEARCH HISTORY
  ========================================================= */

  function getSearchHistory() {
    try {
      const saved =
        localStorage.getItem(SEARCH_HISTORY_KEY);

      if (!saved) return [];

      const parsed = JSON.parse(saved);

      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.error("History read failed:", error);
      return [];
    }
  }

  function saveSearchHistory(searchItem) {
    try {
      let history = getSearchHistory();

      const query = String(
        searchItem.query || ""
      ).trim();

      if (!query) return;

      /*
        Remove duplicate search.
        Comparison is case-insensitive.
      */
      history = history.filter(item =>
        String(item.query || "").toLowerCase() !==
        query.toLowerCase()
      );

      /*
        Put newest search at the top.
      */
      history.unshift({
        query: query,
        name: String(searchItem.name || ""),
        sku: String(searchItem.sku || ""),
        barcode: String(searchItem.barcode || "")
      });

      /*
        Keep only last 10.
      */
      history = history.slice(0, MAX_HISTORY);

      localStorage.setItem(
        SEARCH_HISTORY_KEY,
        JSON.stringify(history)
      );

    } catch (error) {
      console.error("History save failed:", error);
    }
  }

  /* =========================================================
     RENDER SEARCH HISTORY
  ========================================================= */

  function renderHistory() {
    const resultEl =
      document.getElementById("result");

    if (!resultEl) return;

    const oldHistory =
      resultEl.querySelector(".search-history");

    if (oldHistory) {
      oldHistory.remove();
    }

    const history = getSearchHistory();

    if (history.length === 0) return;

    const historyContainer =
      document.createElement("div");

    historyContainer.className =
      "search-history";

    historyContainer.innerHTML = `
      <div class="search-history-title">
        Recent Searches
      </div>

      <div class="search-history-list"></div>
    `;

    const historyList =
      historyContainer.querySelector(
        ".search-history-list"
      );

    history.forEach(item => {
      const button =
        document.createElement("button");

      button.type = "button";
      button.className =
        "search-history-item";

      /*
        Product name is now shown first.
      */
      const productName =
        item.name || "Unknown Product";

      const searchValue =
        item.query || item.barcode || item.sku || "";

      button.innerHTML = `
        <div class="history-product-name">
          ${escapeHtml(productName)}
        </div>

        <div class="history-search-value">
          ${escapeHtml(searchValue)}
        </div>
      `;

      button.addEventListener("click", () => {
        searchBox.value = searchValue;

        searchBox.dispatchEvent(
          new Event("input", {
            bubbles: true
          })
        );

        searchBox.focus();
      });

      historyList.appendChild(button);
    });

    resultEl.appendChild(historyContainer);
  }

  /* =========================================================
     FIRST LOAD
  ========================================================= */

  function showFirstLoad() {
    resultEl.innerHTML = `
      <div class="loader-container" aria-hidden="false">

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

    progressInterval = setInterval(() => {
      if (progress < 92) {
        progress = Math.min(
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

        clearInterval(progressInterval);

        data = result.data;

        saveInventory(data, result.version);

        dataReady = true;
        loadFailed = false;

        loaderFill.style.width = "100%";
        loaderText.textContent =
          "Loading... 100%";

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

          renderHistory();

        }, 260);

      })
      .catch(error => {

        console.error(
          "Initial loading failed:",
          error
        );

        clearInterval(progressInterval);

        loadFailed = true;

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

  /* =========================================================
     BACKGROUND INVENTORY UPDATE
  ========================================================= */

  async function updateInventoryInBackground() {
    if (!navigator.onLine) return;

    try {
      const latest =
        await downloadLatestInventory();

      const savedVersion =
        localStorage.getItem(
          INVENTORY_VERSION_KEY
        );

      if (
        !savedVersion ||
        latest.version !== savedVersion
      ) {
        data = latest.data;

        saveInventory(
          latest.data,
          latest.version
        );

        dataReady = true;

        /*
          Do not disturb the current search screen.
          New inventory will be used for the next search.
        */
      }

    } catch (error) {
      /*
        Completely silent.

        Cached inventory remains available
        when the network is unavailable.
      */
      console.log(
        "Background inventory update skipped."
      );
    }
  }

  /* =========================================================
     DOWNLOAD GOOGLE SHEET
  ========================================================= */

  async function downloadLatestInventory() {
    const response =
      await fetch(
        SHEET_URL +
        "&nocache=" +
        Date.now(),
        {
          cache: "no-store"
        }
      );

    if (!response.ok) {
      throw new Error(
        "Network response was not OK"
      );
    }

    const text =
      await response.text();

    const jsonText =
      extractJsonFromGoogleResponse(text);

    const json =
      JSON.parse(jsonText);

    const processed =
      processSheetData(json);

    const version =
      createDataVersion(processed);

    return {
      data: processed,
      version: version
    };
  }

  /* =========================================================
     PROCESS GOOGLE SHEET DATA
  ========================================================= */

  function processSheetData(json) {
    if (
      !json ||
      !json.table ||
      !Array.isArray(json.table.rows)
    ) {
      throw new Error(
        "Invalid Google Sheet data"
      );
    }

    return json.table.rows.map(row => {

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
              .map(b => b.trim())
              .filter(Boolean)
          : [];

      return {
        sku: String(skuOriginal),
        name: String(nameOriginal),

        barcodes: barcodeList,

        primaryBarcode:
          barcodeList[0] || "",

        searchSku:
          String(skuOriginal).toLowerCase(),

        searchBarcodes:
          barcodeList.map(
            b => b.toLowerCase()
          )
      };
    });
  }

  /* =========================================================
     GOOGLE RESPONSE JSON EXTRACTION
  ========================================================= */

  function extractJsonFromGoogleResponse(text) {
    const firstBrace =
      text.indexOf("{");

    const lastBrace =
      text.lastIndexOf("}");

    if (
      firstBrace === -1 ||
      lastBrace === -1
    ) {
      throw new Error(
        "Could not find Google Sheet JSON"
      );
    }

    return text.substring(
      firstBrace,
      lastBrace + 1
    );
  }

  /* =========================================================
     CREATE INVENTORY VERSION
  ========================================================= */

  function createDataVersion(inventory) {
    const json =
      JSON.stringify(inventory);

    let hash = 0;

    for (
      let i = 0;
      i < json.length;
      i++
    ) {
      hash =
        (hash << 5) -
        hash +
        json.charCodeAt(i);

      hash |= 0;
    }

    return String(hash);
  }

  /* =========================================================
     SAVE INVENTORY
  ========================================================= */

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

    } catch (error) {
      console.error(
        "Inventory cache save failed:",
        error
      );
    }
  }

  /* =========================================================
     GET SAVED INVENTORY
  ========================================================= */

  function getSavedInventory() {
    try {
      const saved =
        localStorage.getItem(
          INVENTORY_CACHE_KEY
        );

      if (!saved) return null;

      const parsed =
        JSON.parse(saved);

      return Array.isArray(parsed)
        ? parsed
        : null;

    } catch (error) {
      console.error(
        "Inventory cache read failed:",
        error
      );

      return null;
    }
  }

  /* =========================================================
     MANUAL REFRESH
  ========================================================= */

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

          progress +=
            Math.random() * 6;

          progress =
            Math.min(93, progress);

          loaderFill.style.width =
            progress + "%";

          loaderText.textContent =
            `Refreshing... ${Math.floor(progress)}%`;
        }

      }, 130);

    try {

      const latest =
        await downloadLatestInventory();

      const savedVersion =
        localStorage.getItem(
          INVENTORY_VERSION_KEY
        );

      clearInterval(interval);

      loaderFill.style.width =
        "100%";

      loaderText.textContent =
        "Refreshing... 100%";

      if (
        latest.version !== savedVersion
      ) {

        data = latest.data;

        saveInventory(
          latest.data,
          latest.version
        );

        dataReady = true;

        setTimeout(() => {

          resultEl.innerHTML = `
            <div style="
              text-align:center;
              color:var(--color-accent);
              font-weight:600;
              margin-top:8px;
            ">
              Updated — Ready to Search
            </div>
          `;

          renderHistory();

        }, 260);

      } else {

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

    } catch (error) {

      console.error(
        "Refresh failed:",
        error
      );

      clearInterval(interval);

      /*
        Keep existing cached inventory.
      */

      resultEl.innerHTML = `
        <div style="
          text-align:center;
          color:var(--color-accent);
          font-weight:600;
          margin-top:8px;
        ">
          Failed to Refresh.<br>
          Your saved inventory is still available.
        </div>
      `;

      renderHistory();
    }
  }

  /* =========================================================
     ESCAPE HTML
  ========================================================= */

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
});
```
