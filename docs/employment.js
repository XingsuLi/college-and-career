/* PSEO employment flows. Only D3 is needed: no Sankey layout library.
 * Each input row is an observed joint cell [field, industry, division, count].
 * Both stages use these same cells so their totals stay consistent.
 */
"use strict";
const mapFocus = {division:null};
let employmentCache = {key:null,value:null};
const PSEO = window.PSEO_DATA;
const industryColor = (code) => INDUSTRY_COLORS[code] || "#626b77";
const divisionStates = {
  1: ["CT", "ME", "MA", "NH", "RI", "VT"],
  2: ["NJ", "NY", "PA"],
  3: ["IL", "IN", "MI", "OH", "WI"],
  4: ["IA", "KS", "MN", "MO", "NE", "ND", "SD"],
  5: ["DE", "DC", "FL", "GA", "MD", "NC", "SC", "VA", "WV"],
  6: ["AL", "KY", "MS", "TN"],
  7: ["AR", "LA", "OK", "TX"],
  8: ["AZ", "CO", "ID", "MT", "NV", "NM", "UT", "WY"],
  9: ["AK", "CA", "HI", "OR", "WA"],
};
const stateDivision = Object.fromEntries(
  Object.entries(divisionStates).flatMap(([division, states]) => states.map((s) => [s, division])),
);
const fieldNames = {
  "01": "Agriculture",
  "03": "Natural resources",
  "04": "Architecture",
  "05": "Area studies",
  "09": "Communications",
  10: "Media technology",
  11: "Computing",
  13: "Education",
  14: "Engineering",
  15: "Engineering tech",
  16: "Languages",
  19: "Family sciences",
  22: "Legal studies",
  23: "English",
  24: "Liberal arts",
  25: "Library science",
  26: "Biology",
  27: "Mathematics",
  30: "Interdisciplinary",
  31: "Recreation",
  38: "Philosophy",
  39: "Theology",
  40: "Physical sciences",
  42: "Psychology",
  43: "Public safety",
  44: "Social services",
  45: "Social sciences",
  49: "Transportation",
  50: "Arts",
  51: "Health sciences",
  52: "Business",
  54: "History",
};
const industryNames = {
  11: "Agriculture",
  21: "Mining",
  22: "Utilities",
  23: "Construction",
  "31-33": "Manufacturing",
  42: "Wholesale",
  "44-45": "Retail",
  "48-49": "Transport",
  51: "Information",
  52: "Finance",
  53: "Real estate",
  54: "Prof. services",
  55: "Management",
  56: "Admin. services",
  61: "Education",
  62: "Health care",
  71: "Arts & leisure",
  72: "Food & lodging",
  81: "Other services",
  92: "Public admin.",
};
const divisionNames = {
  0: "Island areas",
  1: "New England",
  2: "Mid-Atlantic",
  3: "E N Central",
  4: "W N Central",
  5: "S Atlantic",
  6: "E S Central",
  7: "W S Central",
  8: "Mountain",
  9: "Pacific",
};
// Accumulate the published joint cells for the current academic selection.
// Unknown flow cells are excluded from totals and explicitly counted below.
function prepareEmploymentData(schools) {
  const key=schools.map((s)=>s.id).join(',')+'|'+state.pseoSnapshot+'|'+state.pseoField;
  if(employmentCache.key===key)return employmentCache.value;
  const totals = new Map();
  const schoolIds = new Set();
  const quality = [0, 0, 0];
  let withFlows = 0;
  let withSnapshot = 0;
  for (const school of schools) {
    const snapshot = PSEO.institutions[school.id]?.snapshots[state.pseoSnapshot];
    if (!snapshot) continue;
    const fields = Object.keys(snapshot.quality).filter(
      (cip) => state.pseoField === "all" || cip === state.pseoField,
    );
    if (!fields.length) continue;
    withSnapshot++;
    for (const cip of fields) snapshot.quality[cip].forEach((n, i) => (quality[i] += n));
    let hasFlow = false;
    for (const row of snapshot.flows) {
      if (state.pseoField !== "all" && row[0] !== state.pseoField) continue;
      hasFlow = true;
      schoolIds.add(school.id);
      const key = row.slice(0, 3).join("|");
      if (!totals.has(key))
        totals.set(key, { field: row[0], industry: row[1], division: row[2], value: 0 });
      totals.get(key).value += row[3];
    }
    if (hasFlow) withFlows++;
  }
  const flows = [...totals.values()];
  const result = {
    flows,
    schoolIds,
    quality,
    withFlows,
    withSnapshot,
    denominator: schools.length,
    total: d3.sum(flows, (d) => d.value),
    divisions: d3.rollup(
      flows,
      (rows) => d3.sum(rows, (d) => d.value),
      (d) => d.division,
    ),
  };
  employmentCache={key,value:result};return result;
}

function chooseDestination(division) {
  mapFocus.division=mapFocus.division===division?null:division;
  hideTooltip();requestRender();
}

function renderEmploymentMap() {
  const { svg, w, h } = createChart("map-svg"),
    path = d3.geoPath();
  const bounds = path.bounds({ type: "FeatureCollection", features });
  const width = bounds[1][0] - bounds[0][0],
    height = bounds[1][1] - bounds[0][1];
  const scale = Math.min((w - 45) / width, (h - 32) / height);
  const x = (w - width * scale) / 2 - bounds[0][0] * scale;
  const y = (h - 30 - height * scale) / 2 - bounds[0][1] * scale;
  const color = d3.scaleSequential(
    [0, d3.max([...employment.divisions.values()]) || 1],
    sequentialColor(COLORS.destinations),
  );
  setColorLegend(".map-legend > div", color);
  const g = svg.append("g").attr("transform", `translate(${x},${y}) scale(${scale})`);
  g
    .selectAll("path")
    .data(features)
    .join("path")
    .attr("class", "state-path")
    .attr("data-division", (f) => stateDivision[f.properties.abbr])
    .attr("d", path)
    .attr("fill", (f) =>
      employment.total
        ? color(employment.divisions.get(stateDivision[f.properties.abbr]) || 0)
        : "url(#map-no-data)",
    )
    .attr("aria-pressed",(f)=>String(mapFocus.division===stateDivision[f.properties.abbr]))
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr(
      "aria-label",
      (f) => `${PSEO.labels.divisions[stateDivision[f.properties.abbr]]}: ${numberFormat.format(employment.divisions.get(stateDivision[f.properties.abbr])||0)} of ${numberFormat.format(employment.total)} published employment counts. Highlight only.`,
    )
    .on("click", (_, f) => chooseDestination(stateDivision[f.properties.abbr]))
    .on("keydown", (e, f) => {
      if (e.key === "Enter" || e.key === " ") {e.preventDefault();chooseDestination(stateDivision[f.properties.abbr]);}
    })
    .on("mousemove", (event, f) => {
      const division = stateDivision[f.properties.abbr],
        count = employment.divisions.get(division) || 0;
      showTooltip(
        event,
        `<strong>${escapeHtml(PSEO.labels.divisions[division])}</strong>`+tooltipRow("Share",`${numberFormat.format(count)}/${numberFormat.format(employment.total)} · ${employment.total?((100*count)/employment.total).toFixed(1):"0"}%`),
      );
    })
    .on("mouseleave", hideTooltip);
  for (const [stroke, width] of [["#ffffff", 4.5], [COLORS.selected, 2.2]]) {
    g.selectAll(null).data(features.filter((f) => mapFocus.division === stateDivision[f.properties.abbr]))
      .enter().append("path").attr("class", "map-selection-outline")
      .attr("d", path).attr("fill", "none").attr("stroke", stroke)
      .attr("stroke-width", width / scale).attr("pointer-events", "none");
  }
  getElement("map-min").textContent = "0";
  getElement("map-max").textContent = d3.format("~s")(
    d3.max([...employment.divisions.values()]) || 0,
  );
  getElement("map-insight").textContent = "9 CENSUS DIVISIONS";
  getElement("map-foot").textContent = `${cohortLabel(state.pseoSnapshot)}`;
}
