/**
 * The frame of a box is drawn with characters. Its two sides are columns of
 * "│", and the stylesheet carries enough of them for a box of 150 rows.
 * When a table grows past that, this gives that box a longer column.
 */
(function () {
  'use strict';

  var BOXES = '.sec:not(.bare), .strand, .loading-message';
  var ROWS_IN_SHEET = 150;

  function fit(box) {
    var row = parseFloat(getComputedStyle(box).lineHeight);
    if (!row || !isFinite(row)) return;
    var rows = Math.ceil(box.offsetHeight / row);
    var have = Number(box.getAttribute('data-frame-rows')) || ROWS_IN_SHEET;
    if (rows <= have) return;
    var want = rows + 100;                       // room to grow before the next change
    var side = new Array(want * 2 + 1).join('│'); // the sides stack one sign every half row
    box.style.setProperty('--frame-left', '"┌' + side + '"');
    box.style.setProperty('--frame-right', '"' + side + '┘"');
    box.setAttribute('data-frame-rows', String(want));
  }

  function start() {
    var boxes = document.querySelectorAll(BOXES);
    var i;
    if (typeof ResizeObserver === 'function') {
      var watch = new ResizeObserver(function (entries) {
        for (var k = 0; k < entries.length; k++) fit(entries[k].target);
      });
      for (i = 0; i < boxes.length; i++) watch.observe(boxes[i]);
    } else {
      var all = function () { for (var k = 0; k < boxes.length; k++) fit(boxes[k]); };
      all();
      window.addEventListener('resize', all);
      window.setInterval(all, 2000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
