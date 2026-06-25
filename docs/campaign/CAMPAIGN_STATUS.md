# BitQuai Controller-View Campaign Status

## Objective
Push all 4 pages to 95%+ Performance and 95%+ Accessibility.

## Current Scores

| Page | Perf | A11y | BP | SEO |
|---|---|---|---|---|
| Index | 74% | 100% | 100% | 100% |
| Mining | 99% | 95% | 96% | 100% |
| Controller | 90% | 88% | 100% | 100% |
| QDEX | 97% | 94% | 100% | 100% |

## Tasks

| # | Task | Page | Status | Done? |
|---|---|---|---|---|
| P3.1 | Optimize hero image (WebP, srcset) | Index | done | ✅ |
| P3.2 | Fix install button contrast WCAG AA | Mining | pending |  |
| P3.3 | Fix donate pill contrast | Controller | pending |  |
| P3.4 | Fix touch targets | Controller | pending |  |
| P3.5 | Inline critical CSS for LCP | Controller | pending |  |
| P3.6 | Preconnect to external origins | All | pending |  |
| P3.7 | decoding=async on all images | All | pending |  |
| P3.8 | loading=lazy on below-fold images | All | pending |  |
| P3.9 | QDEX mobile responsive | QDEX | pending |  |
| P3.10 | Controller mobile verify | Controller | pending |  |
| P3.11 | Lighthouse audit final | All | pending |  |
| P3.12 | Build script (npm run build) | All | pending |  |
| P3.13 | HTML validation + link checker | All | pending |  |
| P3.14 | dns-prefetch for RPC endpoints | All | pending |  |

## Next Task

P3.2 - Fix install button contrast WCAG AA

## Commits

- `3eb3c75` P0 cleanup (12MB → 5.4MB)
- `e70fab7` P1: brand.css, service worker, 404, SEO
- `cacb023` P0 a11y: main landmarks, contrast, headings
- `b99aa57` Fix install button contrast WCAG AA
- `baf3125` P1 perf: LCP preload, defer JS, non-blocking CSS
- `8f1c222` CLS fix mining, contrast controller donate
- `46e417d` Revert media=print mining.css
- `b574b3b` P2: minified CSS, native defer scripts
- `ca75309` P3.1: hero image WebP + srcset (599KB→32KB OG, 1.4MB→64KB hero BG)

Total commits: 9
Total commits this session: 1
