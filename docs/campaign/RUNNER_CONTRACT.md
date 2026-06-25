# BitQuai Controller-View — Autonomous Campaign

## Objective
Push all 4 pages (Index, Mining, Controller, QDEX) to **95%+ Performance** and **95%+ Accessibility** in Lighthouse while maintaining zero regressions.

## Boundaries — HARD

| ✅ Allowed | ❌ Forbidden |
|---|---|
| Edit HTML/CSS/JS files | Deploy to production without approval |
| Commit + push to `main` on GitHub | Change live API endpoints or RPC URLs |
| Run Lighthouse locally for verification | Install npm packages without need |
| Minify, optimize, restructure code | Change mining pool URLs or credentials |
| Update docs | Touch wallet, keys, or secrets |

## Cadence

- **Every 20 minutes**
- One bounded slice per run (one semantic change)
- Commit + push after each slice
- Report in Spanish: `🟢 OK`, `🟡 OJO`, `🔴 BLOCKER`

## Quality Gates

Before pushing:
1. All 4 pages return `200` on local server
2. No new console errors introduced
3. Lighthouse score not regressed on any page

## Remaining Work (priority order)

### Phase 1 — Performance (Target: 95%+ all pages)

| # | Task | Page(s) | Impact | Status |
|---|---|---|---|---|
| 1.1 | Optimize hero image (compress to WebP, add srcset) | Index | +10% Perf | pending |
| 1.2 | Lazy-load chart.js only when needed | Mining | -200KB unused | pending |
| 1.3 | Inline critical CSS, defer rest | Controller | +5% Perf | pending |
| 1.4 | Fix install button contrast WCAG AA | Mining | +5% A11y | pending |
| 1.5 | Fix touch target sizes | Controller | +6% A11y | pending |
| 1.6 | Add `font-display: swap` | All | +2% Perf | pending |

### Phase 2 — Code Quality

| # | Task | Impact | Status |
|---|---|---|---|
| 2.1 | Remove `console.log` from production code | Clean | pending |
| 2.2 | Add HTML validation (no broken tags) | Clean | pending |
| 2.3 | Add `rel="preconnect"` for external origins | +3% Perf | pending |
| 2.4 | Add `decoding="async"` to all images | +1% Perf | pending |

### Phase 3 — Mobile

| # | Task | Impact | Status |
|---|---|---|---|
| 3.1 | QDEX mobile responsive (order book + trade form) | UX | pending |
| 3.2 | Controller mobile grid → single column | UX | pending |
| 3.3 | Mining tables scroll on mobile | UX | pending |

### Phase 4 — Polish

| # | Task | Impact | Status |
|---|---|---|---|
| 4.1 | Add `llms.txt` for AI discoverability | SEO | pending |
| 4.2 | Structured data (JSON-LD) for BitQuai | SEO | pending |
| 4.3 | Add `hreflang` for multi-language | SEO | pending |
| 4.4 | Final Lighthouse audit + report | Verify | pending |

## Verification

After each commit:
```bash
python3 -m http.server 8080 &
# Test all pages return 200
for p in / /mining.html /controller_view.html /qdex.html; do
  curl -s -o /dev/null -w "%{http_code}" http://localhost:8080$p
done
```

## Status

See `CAMPAIGN_STATUS.md` for current progress.
