# Reading the College & Career Code

The website is ordinary JavaScript and D3. All runtime files live in `docs/`;
there is no framework or build step.

## Start here

- `index.html` defines the four panels and loads scripts in dependency order.
- `app.js` owns institution filters, school selection, the map, scatterplot and shared render cycle.
- `ui-state.js` handles selection normalization, breadcrumbs, graduate labels and keyboard focus restoration.
- `school-programs.js` sums degree awards and draws the Treemap or income intervals.
- `program-income.js` looks up published income for an exact school, program and graduate group.
- `employment.js` aggregates destination regions and provides stable industry labels and colors.
- `industry-pay.js` aggregates historical industry shares and compares wage growth with CPI.
- `hiring.js` selects related national occupations and draws hiring indices with overall references.
- `colors.js` defines fixed category identities, sequential palettes, matching legends and readable label colors.

Files ending in `data.js`, plus `states.js`, contain bundled data rather than interaction logic.
`source-manifest.js` records the source periods and releases.

## Shared selection

`state.region/type/size` selects the institution population. `state.scatter` holds
selected school IDs, or null for the whole population. All four charts read the
same state when `requestRender()` updates the page.

`state.pseoField` selects a broad field; `programState.fine` optionally selects
a detailed program. The three `GRADUATE_SNAPSHOTS` control published program
income and historical destination weights. Destination-map clicks highlight a
work region without changing the origin population.

## Market panel

The two modes are `pay-growth` and `hiring`. Wage growth is
`100 * (weekly_pay[t] / weekly_pay[t-4] - 1)`. CPI uses the same comparison on
quarterly mean indices. `PAY_COMPARISON_END` restricts both to their shared
published period, currently 2026 Q1.

An industry line's width is `18 * share` pixels, with all published destinations
in the denominator. CPI has a fixed width and no employment share. Its missing
2025 Q4 value stays null; the line connects the surrounding observed quarters
without a node. Pointer inspection reports only observed values.

Hiring uses equal-width national occupation indices and separate U.S./state
all-job references. These indices do not change when a graduate group changes.
Schools without usable destination weights automatically show hiring.

## Rendering

Each chart uses D3 scales, axes and data-bound SVG marks. The map uses
`geoPath`, the scatterplot uses `brush`, program composition uses `treemap`,
and market curves use `line`. Chart updates retain useful keyboard focus.

For inspection in browser developer tools, see `collegeScopeSnapshot`,
`schoolProgramAudit`, `industryPayAudit`, `industryPayInteractionAudit` and
`hiringAudit` on `window`.

To update the site, edit `docs/`, test with a local static server, then commit
and push. GitHub Pages serves that folder directly.


`dataSources` in `app.js` supplies the six links opened by the header button.
The source list reuses the compact popup container with interactive anchors;
Escape and outside click close it. Chart hovers reset the source-open state.
The shell has five grid rows and the market panel has no footer row.


The market header uses two persistent `data-market-mode` buttons instead of a
select. They update `industryPayState.mode`; rendering sets `aria-pressed`,
active styling and pay-data availability. Native button keyboard behavior is retained.


The pay legend appends CPI as a sixth peer entry. Industry numbers remain
employment shares; CPI shows only its name and dashed reference key. Clicking CPI highlights the reference without changing the weights.
The chart no longer repeats a separate CPI key inside the plot.


Industry wage paths are solid through the latest observed quarter. CPI retains
its dashed reference style. The renderer uses one path per series.


`styles.css` defines `--font-ui`, `--panel-radius`, `--control-radius` and
`--control-line`. Geist is bundled as `vendor/geist-variable.woff2`; the offline
packager embeds it as a data URL. SVG axes use the same type family. After
`document.fonts.ready`, one redraw updates text measurements.
