// ============================================================
// EASY SCAN - COMPLETE SCRIPT
// ============================================================

// Google Sheet URL
const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1vtZ2Xmb4eKPFs_v-D-nVNAm2_d2TtqqaMFO93TtaKxM/gviz/tq?tqx=out:json";

// Local inventory cache
const INVENTORY_CACHE_KEY = "easyScanInventory";
const INVENTORY_VERSION_KEY = "easyScanInventoryVersion";

let data = [];
let dataReady = false;
let loadFailed = false;
let progressInterval;


// ============================================================
// START
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

  const resultEl = document.getElementById("result");
  const searchBox = document.getElementById("searchBox");
  const themeToggle = document.getElementById("themeToggle");
  const refreshButton = document.getElementById("refreshDataButton");


  // ==========================================================
  // REFRESH SHEET WHEN "EASY SCAN" TITLE IS CLICKED
  // ==========================================================

  if (refreshButton) {
    refreshButton.addEventListener("click", () => {
      reloadSheetData();
    });
  }


  // ==========================================================
  // INITIAL LOADING
  // ==========================================================

  resultEl.innerHTML = `
    <div class="loader-container" aria-hidden="false">
      <div class="loader-bar">
        <div id="loaderFill"
             class="loader-fill"
             style="width:0%">
        </div>
      </div>

      <div id="loaderText" class="loader-text">
        Loading... 0%
      </div>
    </div>
  `;

  const loaderFill = document.getElementById("loaderFill");
  const loaderText = document.getElementById("loaderText");


  // Fake progress
  let progress = 0;

  progressInterval = setInterval(() => {

    if (progress < 92) {

      progress = Math.min(
        92,
        progress + Math.random() * 6
      );

      loaderFill.style.width = progress + "%";

      loaderText.textContent =
        `Loading... ${Math.floor(progress)}%`;
    }

  }, 140);


  // ==========================================================
  // LOAD GOOGLE SHEET
  // ==========================================================

  loadSheetData()
    .then(result => {

      clearInterval(progressInterval);

      loaderFill.style.width = "100%";
      loaderText.textContent = "Loading... 100%";

      dataReady = true;
      loadFailed = false;


      setTimeout(() => {

        if (result.changed) {

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

        } else if (result.offline) {

          resultEl.innerHTML = `
            <div style="
              text-align:center;
              color:var(--color-accent);
              font-weight:600;
              margin-top:8px;
            ">
              Offline — Using Saved Inventory
            </div>
          `;

        } else {

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
        }

      }, 260);

    })
    .catch(err => {

      console.error("Loading Failed:", err);

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

          <button id="reloadBtn" style="
            background: transparent;
            border: 1px solid var(--color-accent);
            color:var(--color-accent);
            border-radius: 8px;
            padding: 8px 16px;
            font-size: 15px;
            font-weight: 600;
            cursor: pointer;
            transition: 0.2s;
          ">
            ⟳ Reload
          </button>
        </div>
      `;

      const reloadBtn =
        document.getElementById("reloadBtn");

      if (reloadBtn) {

        reloadBtn.addEventListener("click", () => {
          location.reload();
        });

      }

    });


  // ==========================================================
  // SEARCH
  // ==========================================================

  searchBox.addEventListener("input", (e) => {

    if (loadFailed || !dataReady) return;

    const q =
      e.target.value.trim().toLowerCase();


    // Empty search
    if (!q) {

      resultEl.innerHTML = "";

      return;
    }


    // Search barcode OR SKU
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


    // First matching result
    const item = results[0];


    // Barcode display
    const barcodeDisplay =
      item.barcodes.length > 1

        ? `${item.barcodes[0]}
           <span class='more'>…</span>`

        : item.barcodes[0];


    // Result card
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
    // CLICK TO EXPAND ALL BARCODES
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
    // BARCODE GENERATION
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


  // ==========================================================
  // THEME TOGGLE
  // ==========================================================

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


  // ==========================================================
  // RESTORE THEME
  // ==========================================================

  const savedTheme =
    localStorage.getItem("theme") || "light";

  document.documentElement.setAttribute(
    "data-theme",
    savedTheme
  );

  themeToggle.textContent =
    savedTheme === "light"
      ? "🌙"
      : "☀️";

});


// ============================================================
// LOAD SHEET DATA
// ============================================================

async function loadSheetData() {

  try {

    // Always request a fresh copy from Google
    const url =
      SHEET_URL +
      "&nocache=" +
      Date.now();

    const response =
      await fetch(url, {
        cache: "no-store"
      });


    if (!response.ok) {
      throw new Error(
        "Google Sheet request failed"
      );
    }


    const txt =
      await response.text();


    const newData =
      processSheetData(txt);


    // Create a version from the actual Sheet contents
    const newVersion =
      createDataVersion(newData);


    const oldVersion =
      localStorage.getItem(
        INVENTORY_VERSION_KEY
      );


    // ========================================================
    // CHECK IF SHEET CHANGED
    // ========================================================

    if (
      !oldVersion ||
      oldVersion !== newVersion
    ) {

      // Sheet changed
      data = newData;

      localStorage.setItem(
        INVENTORY_CACHE_KEY,
        JSON.stringify(newData)
      );

      localStorage.setItem(
        INVENTORY_VERSION_KEY,
        newVersion
      );

      console.log(
        "Easy Scan: Inventory changed. Cache updated."
      );


      return {
        changed: true,
        offline: false
      };

    }


    // ========================================================
    // SHEET DID NOT CHANGE
    // ========================================================

    data = newData;

    console.log(
      "Easy Scan: Inventory unchanged."
    );


    return {
      changed: false,
      offline: false
    };

  }

  catch (error) {

    console.warn(
      "Google Sheet unavailable. Trying saved inventory.",
      error
    );


    // ========================================================
    // OFFLINE FALLBACK
    // ========================================================

    const saved =
      localStorage.getItem(
        INVENTORY_CACHE_KEY
      );


    if (!saved) {

      throw new Error(
        "No saved inventory available"
      );

    }


    try {

      data =
        JSON.parse(saved);

      dataReady = true;
      loadFailed = false;


      console.log(
        "Easy Scan: Using saved inventory."
      );


      return {
        changed: false,
        offline: true
      };

    }

    catch (parseError) {

      console.error(
        "Saved inventory is corrupted.",
        parseError
      );

      throw parseError;

    }

  }

}


// ============================================================
// PROCESS GOOGLE SHEET RESPONSE
// ============================================================

function processSheetData(txt) {

  // Google Visualization JSONP response
  const json =
    JSON.parse(
      txt
        .substr(47)
        .slice(0, -2)
    );


  return json.table.rows.map((r) => {

    const skuOriginal =
      r.c[0]?.v || "";

    const nameOriginal =
      r.c[1]?.v || "";

    const barcodeCell =
      (r.c[2]?.v || "")
        .toString()
        .trim();


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
        skuOriginal
          .toString()
          .toLowerCase(),

      searchBarcodes:
        barcodeList.map(
          b => b.toLowerCase()
        )

    };

  });

}


// ============================================================
// CREATE INVENTORY VERSION
// ============================================================

function createDataVersion(inventory) {

  // Convert the entire inventory into a stable string
  const text =
    JSON.stringify(inventory);


  // Simple fast hash
  let hash = 0;

  for (
    let i = 0;
    i < text.length;
    i++
  ) {

    const char =
      text.charCodeAt(i);

    hash =
      ((hash << 5) - hash) +
      char;

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


  // Show loader
  resultEl.innerHTML = `

    <div class="loader-container">

      <div class="loader-bar">

        <div
          id="loaderFill"
          class="loader-fill"
          style="width:0%">
        </div>

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

    // Force fresh Google Sheet data
    const url =
      SHEET_URL +
      "&nocache=" +
      Date.now();


    const response =
      await fetch(url, {
        cache: "no-store"
      });


    if (!response.ok) {
      throw new Error(
        "Refresh failed"
      );
    }


    const txt =
      await response.text();


    const newData =
      processSheetData(txt);


    const newVersion =
      createDataVersion(newData);


    const oldVersion =
      localStorage.getItem(
        INVENTORY_VERSION_KEY
      );


    clearInterval(interval);


    loaderFill.style.width =
      "100%";

    loaderText.textContent =
      "Refreshing... 100%";


    // ========================================================
    // SHEET CHANGED
    // ========================================================

    if (
      !oldVersion ||
      oldVersion !== newVersion
    ) {

      data = newData;

      localStorage.setItem(
        INVENTORY_CACHE_KEY,
        JSON.stringify(newData)
      );

      localStorage.setItem(
        INVENTORY_VERSION_KEY,
        newVersion
      );


      console.log(
        "Easy Scan: Inventory updated."
      );


      setTimeout(() => {

        resultEl.innerHTML = `

          <div style="
            text-align:center;
            color:var(--color-accent);
            font-weight:600;
            margin-top:8px;
          ">

            Inventory Updated —
            Ready to Search

          </div>

        `;

      }, 260);

    }


    // ========================================================
    // NO CHANGE
    // ========================================================

    else {

      data = newData;


      setTimeout(() => {

        resultEl.innerHTML = `

          <div style="
            text-align:center;
            color:var(--color-accent);
            font-weight:600;
            margin-top:8px;
          ">

            No Changes —
            Ready to Search

          </div>

        `;

      }, 260);

    }


    dataReady = true;
    loadFailed = false;

  }

  catch (error) {

    clearInterval(interval);

    console.error(
      "Refresh failed:",
      error
    );


    // IMPORTANT:
    // Do NOT delete the old inventory.
    // The existing saved data remains usable.

    setTimeout(() => {

      resultEl.innerHTML = `

        <div style="
          text-align:center;
          color:var(--color-accent);
          font-weight:600;
          margin-top:8px;
        ">

          Failed to Refresh.<br>
          Saved Inventory Still Available.

        </div>

      `;

    }, 100);

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
