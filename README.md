# College & Career

**[Open the interactive dashboard](https://lixingsu.github.io/college-and-career/)**

Explore U.S. colleges, majors, graduate outcomes and hiring trends in four linked D3 views.
Designed for desktop: a fixed 2 × 2 layout with no scrolling.

![Dashboard](preview.png)

## Explore

1. **Map:** compare state-level college metrics; click to filter.
2. **Cost and earnings:** compare net price with earnings ten years after college entry; brush or select a school.
3. **Programs:** explore degree-award shares and published program income; select a major to link the market view.
4. **Market:** switch between industry pay growth with a CPI reference and recent hiring demand.

The Graduates menu keeps three representative groups: 2019–21 graduates one year later,
2016–18 graduates five years later, and 2010–12 graduates ten years later.

## Data snapshot

- 1,725 institutions; 1,724 have program awards data.
- Program composition: IPEDS 2024–25 bachelor's awards.
- Program income and employment destinations: Census PSEO, 2026 Q2 release.
- Pay growth and CPI comparison: 2023 Q1–2026 Q1. The missing CPI quarter is connected without adding an observation.
- Hiring demand: Indeed indices through October 23, 2026.

## Run and edit

The published files are in **`docs/`**. Open `docs/index.html` locally or serve it:

```sh
python3 -m http.server 8000 --directory docs
```

No framework, package installation, build step, backend or API key is required.
D3 is bundled in `docs/vendor/`. The chart modules are `app.js`, `school-programs.js`,
`industry-pay.js` and `hiring.js`; `colors.js` holds the shared palette.
Read [CODE_GUIDE.md](CODE_GUIDE.md) for the selection model and calculations.

GitHub Pages publishes the `docs/` folder. Commit and push changes to update the website.

## Sources and credits

- [College Scorecard](https://collegescorecard.ed.gov/data/)
- [IPEDS](https://nces.ed.gov/ipeds/use-the-data/download-access-database)
- [Census PSEO](https://lehd.ces.census.gov/data/pseo_documentation.html)
- [BLS QCEW](https://www.bls.gov/cew/) and [CPI](https://www.bls.gov/cpi/)
- [Indeed Hiring Lab Job Postings Tracker](https://github.com/hiring-lab/job_postings_tracker), CC BY 4.0; snapshot transformed to weekly observations.
- D3 and map geometry: licenses retained in `docs/vendor/`.

Source periods and hashes are in `docs/source-manifest.js` and [provenance/](provenance/).
