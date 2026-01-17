// load-libs.js
// Ensures high-precision Decimal and Chart libraries are available before loading main.js.
// Behavior:
//  - If CDN-loaded `Decimal` and `Chart` already exist, just load `main.js`.
//  - Otherwise attempt to load `vendor/decimal.min.js` and `vendor/chart.min.js`.
//  - If vendor files are missing or fail to load, show an actionable UI message and do NOT use a Number-based shim.

(function () {
  function injectScript(src) {
    return new Promise(function (resolve, reject) {
      const s = document.createElement('script');
      s.src = src;
      // If we're injecting the app entry (main.js), load it as an ES module
      if (/main\.js$/.test(src)) {
        s.type = 'module';
      }
      s.async = false;
      s.onload = () => resolve(src);
      s.onerror = (e) => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  function showVendorError() {
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.left = '12px';
    div.style.right = '12px';
    div.style.top = '12px';
    div.style.padding = '12px';
    div.style.background = '#ffefef';
    div.style.border = '1px solid #f5c2c7';
    div.style.color = '#6b0505';
    div.style.zIndex = 9999;
    div.style.fontFamily = 'system-ui,Segoe UI,Roboto,Helvetica,Arial';
    div.innerHTML = `
      <strong>Missing high-precision libraries</strong><br>
      Your browser blocked the CDN and local vendor files are not available. For exact, high-precision
      calculations you must place the official library files in the <code>vendor/</code> folder:<br>
      <code>vendor/decimal.min.js</code> and <code>vendor/chart.min.js</code>.<br>
      Run these PowerShell commands in the repo root to download them automatically:<br>
      <pre style="background:#fff;padding:8px;border:1px solid #eee;margin-top:8px">Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/decimal.js@10/dist/decimal.min.js" -OutFile vendor\\decimal.min.js;
Invoke-WebRequest -Uri "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js" -OutFile vendor\\chart.min.js;</pre>
      After placing the files, reload the page. This page will not fall back to low-precision math.
    `;
    document.body.appendChild(div);
  }

  async function ensureAndLoad() {
    // If both are already present (CDN loaded), proceed.
    if (window.Decimal && window.Chart) {
      injectScript('main.js').catch((e) => console.error(e));
      return;
    }

    // Try to load local vendor files (official minified builds).
    try {
      if (!window.Decimal) await injectScript('vendor/decimal.min.js');
      if (!window.Chart) await injectScript('vendor/chart.min.js');

      if (!window.Decimal || !window.Chart) throw new Error('Vendor libs not present after load');

      // success — load main.js now
      await injectScript('main.js');
    } catch (e) {
      console.error('Failed to load high-precision vendor libs:', e);
      showVendorError();
    }
  }

  // Start immediately
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureAndLoad);
  } else {
    ensureAndLoad();
  }
})();
