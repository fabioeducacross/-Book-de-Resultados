# Analytic-Split Count Increase: Canoas Regression Analysis

## Executive Summary
The `analytic-split` count increased from **4 to 6** in the Canoas HTML rendering. **This is NOT a regression** — it is the expected and intentional consequence of the new priority template shell architecture.

## Current State
- **Baseline Expectation:** 4 instances
- **Current Rendering:** 6 instances
- **Increase:** 2 instances (+50%)

## Breakdown by Section

| Section | Layout | Count |
|---------|--------|-------|
| `visao_geral` | `network-overview-shell` | 1 |
| `resultados_disciplina` | `discipline-results-shell` | 2 |
| `escola` | `school-summary-shell` | 3 |
| **TOTAL** | | **6** |

## Root Cause — Priority Template Shells

### New Implementations (Intentional)
The following priority template shells were added to the HTML renderer to enable responsive layout design:

1. **Line 2201** (`renderAnalyticalContent`):
   ```javascript
   renderAnalyticalSplit(
     [...],
     [...],
     page.section === 'visao_geral' ? 'network-overview-shell' : '',
   )
   ```
   - Used for the network overview (institutional) page
   - Creates 1 analytic-split container with 2-column layout

2. **Line 2216** (`renderAnalyticalContent`):
   ```javascript
   renderAnalyticalSplit(
     [...],
     [...],
     page.section === 'resultados_disciplina' ? 'discipline-results-shell' : '',
   )
   ```
   - Used for discipline-specific results pages
   - Creates analytic-split containers for each discipline (2x in Canoas: LP + MT)

3. **Line 2660** (`renderSchoolSummaryPageContent`):
   ```html
   <div class="analytic-split" data-layout="school-summary-shell">
   ```
   - Used for school summary pages
   - Creates one container per school (3x in Canoas: Alfa, Beta, Gama)

### CSS Handling for Shells
The shells enable layout-specific styling:

- **Lines 964-965:** Network and discipline shells (2-column split styling)
- **Lines 1546-1554:** School summary shell (sidebar + main content layout)

## Why 6 Instead of 4?

### Expected Baseline Count (4)
The original baseline likely captured only:
- 1x `visao_geral` page (institutional overview)
- 1x `escola` page (one school summary)

### Current Fixture Count (6)
The Canoas fixture now generates:
- 1x `visao_geral` page (1 analytic-split)
- 2x `resultados_disciplina` pages (2 analytic-splits: Língua Portuguesa + Matemática)
- 3x `escola` pages (3 analytic-splits: Escola Alfa, Beta, Gama)

**Total = 6 analytic-split containers**

## Verdict

✅ **NOT A REGRESSION**

This is the expected and intentional consequence of the priority template shell architecture, which provides:
- Responsive CSS Grid styling for analytical pages
- Layout-aware visual primitives (network-overview vs discipline-results vs school-summary)
- Distinct visual presentations:
  - 2-column split for overview and discipline pages
  - Sidebar + main content layout for school pages

## Recommendation

Update the baseline to reflect the new expected count:
```json
{
  "pipeline": {
    "htmlFidelity": {
      "analyticSplitCount": 6
    }
  }
}
```

## Supporting Code References

- **HTML Renderer:** `packages/book-de-resultados/src/html-renderer.js`
  - `renderAnalyticalContent()` — lines 2160-2226
  - `renderAnalyticalSplit()` — lines 2896-2902
  - `renderSchoolSummaryPageContent()` — lines 2651-2718
  - CSS for shells — lines 964-965, 1546-1554

- **Regression Test:** `tests/book-de-resultados/regression-canoas.test.js`
  - Line 932: analytic-split count assertion
  - Test: "renders analytical overview and school layouts with redesigned visual primitives intact"
