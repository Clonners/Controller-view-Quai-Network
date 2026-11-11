/*
 * Kataribe — theme.js
 * Light/dark switch. With no saved choice the page follows the system setting.
 * Runs in <head> so a saved choice applies before the first paint.
 */
(() => {
  'use strict';
  const KEY = 'kataribe-theme';
  const root = document.documentElement;
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
  if (saved === 'light' || saved === 'dark') root.dataset.theme = saved;

  const current = () => root.dataset.theme || (system.matches ? 'dark' : 'light');
  const paint = (button) => {
    const next = current() === 'dark' ? 'light' : 'dark';
    button.textContent = '[ ' + next + ' ]';
    button.setAttribute('aria-label', 'Switch to ' + next + ' theme');
    const meta = document.querySelectorAll('meta[name="theme-color"]');
    meta.forEach((m) => { m.content = current() === 'dark' ? '#0e0f12' : '#f5f2ea'; });
  };

  document.addEventListener('DOMContentLoaded', () => {
    const button = document.querySelector('.theme-switch');
    if (!button) return;
    button.hidden = false;
    paint(button);
    button.addEventListener('click', () => {
      root.dataset.theme = current() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(KEY, root.dataset.theme); } catch (e) { /* storage blocked */ }
      paint(button);
    });
    system.addEventListener('change', () => paint(button));
  });
})();
