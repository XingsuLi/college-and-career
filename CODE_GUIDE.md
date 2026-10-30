# Reading the College & Career Code

The app uses ordinary JavaScript and D3. Generated data is separate from rendering and interaction logic. There are four SVG elements and no separate chart screen.

## Read in this order

1. `source-manifest.js`: source periods, release dates and default cohort. Displayed award-year labels read this metadata.
2. `app.js`: shared origin filters, institution selection, scatterplot, map, search and render cycle.
3. `ui-state.js`: selection normalization, unique school labels, scope breadcrumbs, keyboard focus restoration and Escape behavior. It loads before app.js so search-label helpers are available during initialization.
4. `school-programs.js`: resolves country/state/school/subset scope; sums IPEDS awards; renders treemap or income intervals. Aggregate income medians are never pooled.
5. `program-income.js`: exact school/CIP/cohort/horizon PSEO lookup. Only status 1 returns numeric values.
6. `employment.js`: cached regional totals and map-only `mapFocus`. A highlighted destination never filters institutions or either lower chart.
7. `industry-pay.js`: industry employment shares, top-five selection, share-based line widths, quarterly pay/YoY arithmetic and D3 lines.

## Shared state boundaries

- `state.region/type/size/scatter`: origin institution scope.
- `state.pseoField/pseoSnapshot`: program family and graduate cohort/horizon.
- `programState.fine`: exact four-digit school-income selection; destination data remains a broader field.
- `mapFocus.division`: visual destination highlight only.
- `industryPayState.mode/focus`: wage presentation and line highlighting only.

`normalizeProgramSelection()` runs before aggregations, so a new scope cannot leave a hidden invalid field active. `renderScopeTrail()` exposes removable choices. Search requires an exact or unique match. SVG redraws restore a useful keyboard focus target.

## Pay modes

The chart selector has two values: `pay-growth` (default) and `hiring`.
`industryPayValue()` computes nominal same-quarter prior-year growth.
`payPoints()` supplies published quarterly periods. `cpiPoints()` and `payPoints()` use the shared `PAY_COMPARISON_END` cutoff
and computes the same comparison for quarterly CPI. The CPI renderer connects
only observed points, skipping the null quarter without creating a node.
Pointer inspection along that segment reports an observed endpoint. CPI has
no share weight or industry-selection behavior.

`renderIndustryPay()` disables wage growth when the active scope lacks usable
PSEO destination weights and selects hiring for those schools/fields.
`GRADUATE_SNAPSHOTS` in `ui-state.js` lists the three graduate options;
`cohortLabel(key, true)` gives the expanded menu names.

Line width remains `18 * share`, independent of highlighting, period mode and wages. The full published employment denominator includes omitted industries and unsupported wage sectors. No weighted graduate-salary estimate is constructed.

## Rendering and performance

Employment aggregation is memoized by institution IDs, cohort/horizon and field. School options rebuild only when the eligible list changes. CSS contains one explicit shell row definition with a compact-height variant; chart positions stay explicit when the redundant hero/footer are hidden.

`window.collegeScopeSnapshot`, `window.schoolProgramAudit` and `window.industryPayAudit` expose diagnostics. `build_single_file.py` packs the source in dependency order into the standalone file. It needs Python only for packaging; the page itself needs only a desktop browser.

Current acceptance results, data checks and Claude review dispositions are linked from README.md. The app’s raw-data verification accepts a separate input directory; raw downloads are not needed for offline viewing.


## Curve inspection and latest-quarter tail

`attachIndustryPointer()` uses one transparent plot surface. `paySegmentDistance()` selects the closest visible polyline segment or published observation in screen pixels, independent of SVG stacking. Keyboard-focusable paths remain available. Hover markers always sit on published points.

The latest quarter uses a separately drawn dashed tail with the same employment-share width. If it crosses an unavailable quarter, its tooltip reports both known endpoints and the gap; the stored value remains null. The extended x-domain adds blank space only, with no future observations or fabricated values.


`fitCollegeRegression()` in `app.js` computes unweighted OLS using centered cross-products. `renderScatter()` draws the fitted line behind points, restricted to the observed price range and clipped to the plot. `window.scatterRegressionAudit` exposes coefficients, n, R² and scope for validation. No regression library was added.


The wage display starts at `QUARTERLY.firstDisplay`, currently 2023-Q1.
The common axis ends exactly at `PAY_COMPARISON_END`, the earlier published
endpoint of wages and CPI. Full raw CPI is retained for later updates. Filtering occurs before shared y-axis extent calculation. Growth includes zero and the CPI reference in the shared y-axis extent. Keep earlier raw data for YoY baselines.


## Hiring mode

`docs/hiring.js` is a small separate D3 module. `hiringSelection()` reads the
existing school/program state; `hiringSeries()` adds national occupation series
and separately labeled overall references. `drawHiringDemand()` uses
`scaleUtc`, `scaleLinear`, `line`, axes and a single transparent hover surface.
No extra chart library, force simulation, interpolation or runtime network calls
are used. All hiring lines have equal width.

`renderIndustryPay()` delegates to `renderHiringDemand()` when `hiring` is
selected. Wage views retain share-based widths; hiring lines have equal widths.

Edit `docs/hiring-mapping.json`, run `build_hiring_data.py`, then
`build_single_file.py` to package changes. Unknown field mappings show reference
series with an explicit note. The snapshot date, baseline and raw-source hashes
are in the generated data and audit files. Browser inspection exposes
`hiringAudit` and `hiringHoverAudit`.


Panel three has been restored to its Treemap renderer and optional income intervals.


## Color system

`docs/colors.js` contains shared color meanings, four Lab-interpolated sequential
palettes, fixed NAICS colors, legend generation and contrast-based label colors.
The map and Treemap legends sample the same scales used by their marks.
Map context is desaturated without changing lightness. Amber with white backing
marks selection; dark dashed outlines mark keyboard focus. Suppressed data use
gray hatching; unpublished program income uses a dashed white tile.

`HIRING_ROLE_COLORS` in `hiring.js` keeps occupation colors fixed across fields.
No related roles shown together share a color. Industry colors never depend on
rank. The zero reference is neutral gray. Line widths remain share-based. Native D3 remains the only visualization library.
