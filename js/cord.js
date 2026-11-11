/**
 * The cord that runs down the page is a column of "│" characters.
 * The page already carries enough of them for a normal screen; this keeps
 * the column as long as the page when tables or lists grow.
 */
(function () {
  'use strict';

  function fit() {
    var cord = document.querySelector('.cord');
    if (!cord) return;
    var row = parseFloat(getComputedStyle(cord).lineHeight);
    if (!row || !isFinite(row)) return;
    var need = Math.ceil(cord.clientHeight / row) + 1;
    if (cord.textContent.length < need) {
      cord.textContent = new Array(need + 13).join('│');
    }
  }

  function start() {
    fit();
    var run = document.querySelector('.run');
    if (run && typeof ResizeObserver === 'function') {
      new ResizeObserver(fit).observe(run);
    } else {
      window.addEventListener('resize', fit);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
