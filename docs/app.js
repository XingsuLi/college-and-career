/* CollegeScope: one shared selection model, four linked views. No network required. */
"use strict";
const META = window.SOURCE_META;
// 1. DATA AND DISPLAY SETTINGS
// data.js contains records; states.js contains map geometry. Neither contains UI logic.
const DATA = window.COLLEGE_DATA;
const institutions = DATA.institutions;
const getElement = (id) => document.getElementById(id);
const types = {
  Public: { label: "Public", color: COLORS.public },
  "Private nonprofit": { label: "Private nonprofit", color: COLORS.nonprofit },
  "Private for-profit": { label: "Private for-profit", color: COLORS.profit },
};
const metricInfo = {
  net_price: { label: "Net price", short: "Net price", unit: "$" },
  earnings_10yr: { label: "10-year earnings", short: "10-year earnings", unit: "$" },
  completion_rate: { label: "Completion rate", short: "Completion rate", unit: "%" },
  federal_debt: { label: "Federal debt", short: "Federal debt", unit: "$" },
};

// Pre-projected GeoJSON allows geoPath() without a runtime conversion library.
const features = window.US_STATES.features;
const stateNames = Object.fromEntries(
  features.map((feature) => [feature.properties.abbr, feature.properties.name]),
);
// 2. SHARED STATE
// Global filters choose the population. Brushes choose a subset of that population.
// Every chart reads this same object, which is what makes linked brushing work.
const state = {
  region: "all",
  type: "all",
  size: "all",
  mapMetric: "net_price",
  scatter: null,
  scatterBounds: null,
  pseoSnapshot: META.defaultSnapshot,
  pseoField: "all",
};
let filteredInstitutions = [],
  selectedInstitutions = [],
  selectedInstitutionIds = new Set(),
  frame = 0,
  renderMs = 0;
let employment = null;
const numberFormat = new Intl.NumberFormat("en-US");
const escapeHtml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const hasNumber = (v) => typeof v === "number" && Number.isFinite(v);
const currency = (v) => (hasNumber(v) ? "$" + numberFormat.format(Math.round(v)) : "—");
const shortDollar = (v) => (Math.abs(v) >= 1000 ? "$" + d3.format("~g")(v / 1000) + "k" : "$" + v);
const formatMetric = (key, v) =>
  !hasNumber(v) ? "—" : metricInfo[key]?.unit === "%" ? d3.format(".1%")(v) : currency(v);
const formatAxisTick = (key, v) =>
  metricInfo[key]?.unit === "%" ? d3.format(".0%")(v) : shortDollar(v);
const hasSelection = () =>
  state.scatter !== null;
// Brush selections intersect; a null scatter selection means no scatter filter.
function matchesAcademicSelection(institution) {
  if (state.scatter !== null && !state.scatter.has(institution.id)) return false;
  return true;
}
function filterInstitutions() {
  return institutions.filter(
    (r) =>
      (state.region === "all" || r.state === state.region) &&
      (state.type === "all" || r.type === state.type) &&
      (state.size === "all" || r.sizeBand === state.size),
  );
}
function resetSelection() {
  getElement("school-search").value = "";
  getElement("school-search").removeAttribute("aria-invalid");
  state.scatter = null;
  state.scatterBounds = null;
  mapFocus.division = null;
}
function requestRender() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    const focus = captureChartFocus();
    render();
    restoreChartFocus(focus);
  });
}
function onGlobalFilterChange() {
  resetSelection();
  hideTooltip();
  requestRender();
}
function tooltipRow(label, value) {
  return `<div class="tip-row"><span>${escapeHtml(label)}:</span><b>${value}</b></div>`;
}
function showTooltip(event, html, variant = "chart") {
  const el = getElement("tooltip");
  if (variant !== "notes") getElement("method-button")?.setAttribute("aria-expanded", "false");
  el.classList.toggle("data-notes", variant === "notes");
  el.setAttribute("role","tooltip");
  el.removeAttribute("aria-label");
  el.removeAttribute("tabindex");
  el.style.pointerEvents="none";
  el.innerHTML = html;
  const bounds=event.currentTarget?.getBoundingClientRect?.();
  if(!hasNumber(event.clientX)||(event.type==='click'&&event.detail===0))event={clientX:bounds?.x||20,clientY:(bounds?.bottom||20)};
  el.hidden = false;
  const w = el.offsetWidth,
    h = el.offsetHeight;
  el.style.left = Math.max(8, Math.min(innerWidth - w - 10, event.clientX + 14)) + "px";
  el.style.top = Math.max(8, Math.min(innerHeight - h - 10, event.clientY + 14)) + "px";
}
function hideTooltip() {
  getElement("tooltip").hidden = true;
  getElement("method-button")?.setAttribute("aria-expanded","false");
}
let toastTimer;
function toast(text) {
  getElement("toast").textContent = text;
  getElement("toast").hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (getElement("toast").hidden = true), 3200);
}
// Prepare an SVG with dimensions from its panel. Each update redraws the chart.
// This small dataset does not need a framework or a general chart component.
function createChart(id) {
  const svg = d3.select("#" + id),
    box = svg.node().getBoundingClientRect();
  svg.selectAll("*").remove();
  svg.attr("viewBox", `0 0 ${box.width} ${box.height}`);
  if(id==='map-svg'){
    const p=svg.append('defs').append('pattern').attr('id','map-no-data').attr('patternUnits','userSpaceOnUse').attr('width',7).attr('height',7);
    p.append('rect').attr('width',7).attr('height',7).attr('fill',COLORS.missing);
    p.append('path').attr('d','M0,7 L7,0').attr('stroke',COLORS.hatch).attr('stroke-width',1);
  }
  return { svg, w: box.width, h: box.height };
}
function institutionTooltip(r) {
  return `<strong>${escapeHtml(r.name)}</strong><div class="tip-muted">${escapeHtml(r.state)} · ${types[r.type].label}</div>`
    + tooltipRow("Net price", formatMetric("net_price", r.metrics.net_price))
    + tooltipRow("Year-10 earnings", formatMetric("earnings_10yr", r.metrics.earnings_10yr))
    + tooltipRow("Undergraduates", hasNumber(r.metrics.undergrad_size) ? numberFormat.format(r.metrics.undergrad_size) : "N/A");
}
// 3. UPDATE ALL FOUR VIEWS
// filter -> selected IDs -> map / scatter / school programs / weighted industry pay.
// Keep all filtered institutions as the denominator, including missing values.
function render() {
  const start = performance.now();
  filteredInstitutions = filterInstitutions();
  const academicSelection = filteredInstitutions.filter(matchesAcademicSelection);
  normalizeProgramSelection(academicSelection);
  employment = prepareEmploymentData(academicSelection);
  selectedInstitutions = academicSelection;
  selectedInstitutionIds = new Set(selectedInstitutions.map((school) => school.id));
  const paired = filteredInstitutions.filter(
    (r) => hasNumber(r.metrics.net_price) && hasNumber(r.metrics.earnings_10yr),
  );
  getElement("kpi-total").textContent = numberFormat.format(filteredInstitutions.length);
  getElement("kpi-paired").innerHTML =
    (filteredInstitutions.length
      ? ((paired.length / filteredInstitutions.length) * 100).toFixed(1)
      : "—") + "<span>%</span>";
  getElement("pair-note").textContent =
    `${numberFormat.format(paired.length)} / ${numberFormat.format(filteredInstitutions.length)} institutions`;
  getElement("state-filter").value = state.region;
  getElement("size-filter").value = state.size;
  getElement("map-metric").value = state.mapMetric;
  document.querySelectorAll("[data-type]").forEach((el) => {
    el.classList.toggle("active", el.dataset.type === state.type);
    el.setAttribute("aria-pressed", String(el.dataset.type === state.type));
  });
  getElement("selection-count").textContent = hasSelection()
    ? `Selected: ${numberFormat.format(selectedInstitutions.length)} / ${numberFormat.format(filteredInstitutions.length)} institutions`
    : `In view: ${numberFormat.format(filteredInstitutions.length)} institutions`;
  renderScopeTrail(academicSelection);
  getElement("clear-selection").hidden = !hasSelection() && state.pseoField==='all' && !mapFocus.division;
  renderMap();
  renderScatter(paired);
  renderSchoolPrograms();
  renderIndustryPay();
  renderMs = performance.now() - start;
  window.collegeScopeSnapshot = {
    base: filteredInstitutions.length,
    selected: selectedInstitutions.length,
    paired: paired.length,
    selectedIDs: [...selectedInstitutionIds],
    state: {
      region: state.region,
      type: state.type,
      size: state.size,
      mapMetric: state.mapMetric,
      hasSelection: hasSelection(),
    },
    pseo: {
      snapshot: state.pseoSnapshot,
      field: state.pseoField,
      schools: employment.withFlows,
      denominator: employment.denominator,
      flowSchools: employment.schoolIds.size,
      total: employment.total,
      quality: employment.quality,
      selection: {},
      destinationHighlight: mapFocus.division,
    },
    renderMs,
  };
}
// 4. MAP: d3.group + d3.median + scaleSequential + geoPath
// The map retains other states as navigation context when one state is selected.
function renderMap() {
  const workRegions = state.mapMetric === "employment";
  getElement("map-title").textContent = workRegions ? "Where graduates go" : "Cost across the map";
  document.querySelector(".map-panel .panel-foot > span").textContent = workRegions
    ? "Highlight a destination · other views keep their origin scope"
    : "Click a state to filter; click again to clear";
  if (workRegions) {
    renderEmploymentMap();
    return;
  }
  const { svg, w, h } = createChart("map-svg"),
    key = state.mapMetric;
  // Keep all states available for navigation while statistics respect type/size.
  const context = institutions.filter(
    (r) =>
      (state.type === "all" || r.type === state.type) &&
      (state.size === "all" || r.sizeBand === state.size),
  );
  const byState = d3.group(context, (r) => r.state),
    selectionByState = d3.rollup(
      selectedInstitutions,
      (v) => v.length,
      (r) => r.state,
    );
  const values = new Map([...byState].map(([s, rs]) => [s, d3.median(rs, (r) => r.metrics[key])]));
  const extent = d3.extent([...values.values()].filter(hasNumber));
  const lo = extent[0] ?? 0,
    hi = extent[1] ?? 1;
  const color = d3.scaleSequential(
    [lo, hi === lo ? lo + 1 : hi],
    sequentialColor(COLORS.map),
  );
  const path = d3.geoPath(),
    bounds = path.bounds({ type: "FeatureCollection", features });
  const bw = bounds[1][0] - bounds[0][0],
    bh = bounds[1][1] - bounds[0][1];
  const scale = Math.min((w - 45) / bw, (h - 32) / bh),
    tx = (w - bw * scale) / 2 - bounds[0][0] * scale,
    ty = (h - 30 - bh * scale) / 2 - bounds[0][1] * scale;
  const g = svg.append("g").attr("transform", `translate(${tx},${ty}) scale(${scale})`);
  setColorLegend(".map-legend > div", color);
  const selectedStates = new Set(selectedInstitutions.map((r) => r.state));
  const outsideSelection = (f) => state.region !== "all"
    ? f.properties.abbr !== state.region
    : hasSelection() && !selectedStates.has(f.properties.abbr);
  const fill = (f) => {
    const value = values.get(f.properties.abbr);
    if (!hasNumber(value)) return "url(#map-no-data)";
    return outsideSelection(f) ? desaturateColor(color(value)) : color(value);
  };
  function tooltip(e, f) {
    const s = f.properties.abbr,
      rs = byState.get(s) || [],
      available = rs.filter((r) => hasNumber(r.metrics[key])).length;
    showTooltip(
      e,
      `<strong>${escapeHtml(f.properties.name)}</strong>`+tooltipRow(metricInfo[key].label+" median",formatMetric(key,values.get(s)))+tooltipRow("Schools",`${available}/${rs.length}`),
    );
  }
  function choose(f) {
    const s = f.properties.abbr;
    state.region = state.region === s && state.scatter === null ? "all" : s;
    onGlobalFilterChange();
  }
  g.selectAll("path")
    .data(features)
    .join("path")
    .attr("d", path)
    .attr("class", "state-path")
    .attr("data-state", (f) => f.properties.abbr)
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr("aria-label", (f) => `${f.properties.name}: ${metricInfo[key].label} ${formatMetric(key,values.get(f.properties.abbr))}. Activate to select this state.`)
    .attr("aria-pressed", (f) => String(state.region === f.properties.abbr))
    .attr("fill", fill)
    .on("mousemove", tooltip)
    .on("mouseleave", hideTooltip)
    .on("click", (_, f) => choose(f))
    .on("keydown", (e, f) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        choose(f);
      }
    });
  // White backing keeps the shared selection color visible on dark fills.
  for (const [stroke, width] of [["#ffffff", 4.5], [COLORS.selected, 2.2]]) {
    g.selectAll(null).data(features.filter((f) => f.properties.abbr === state.region))
      .enter().append("path").attr("class", "map-selection-outline")
      .attr("d", path).attr("fill", "none").attr("stroke", stroke)
      .attr("stroke-width", width / scale).attr("pointer-events", "none");
  }
  for (const f of features) {
    const s = f.properties.abbr;
    if (["CA", "TX", "NY", "FL", "WA", "IL", "CO", "AK", "HI"].includes(s) || s === state.region) {
      const [x, y] = path.centroid(f);
      g.append("text")
        .attr("x", x)
        .attr("y", y + 3)
        .attr("class", "state-label")
        .attr("text-anchor", "middle")
        .style("font-size", `${9 / scale}px`)
        .style(
          "fill",
          hasNumber(values.get(s)) ? readableColor(fill(f)) : COLORS.ink,
        )
        .text(s);
    }
  }
  const dc = features.find((f) => f.properties.abbr === "DC");
  if (dc) {
    const [x, y] = path.centroid(dc);
    g.append("circle")
      .attr("id", "map-dc-control")
      .attr("aria-pressed", String(state.region==="DC"))
      .attr("cx", x)
      .attr("cy", y)
      .attr("r", 4 / scale)
      .attr("fill", "#fff")
      .attr("stroke", "#326c4f")
      .attr("stroke-width", 1 / scale)
      .attr("role", "button")
      .attr("tabindex", 0)
      .attr("aria-label", "District of Columbia filter")
      .style("cursor", "pointer")
      .on("click", () => choose(dc))
      .on("mousemove", (e) => tooltip(e, dc))
      .on("mouseleave", hideTooltip)
      .on("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {e.preventDefault();choose(dc);}
      });
  }
  getElement("map-min").textContent = formatAxisTick(key, lo);
  getElement("map-max").textContent = formatAxisTick(key, hi);
  getElement("map-insight").textContent =
    state.region === "all" ? "50 STATES + DC" : stateNames[state.region];
  getElement("map-foot").textContent = `${META.mapPeriods[state.mapMetric]} · unweighted medians`;
}
// Unweighted ordinary least squares: one institution, one observation.
// Centered sums avoid subtracting large raw currency sums.
function fitCollegeRegression(rows) {
  const data=rows.filter((r)=>hasNumber(r.metrics.net_price)&&hasNumber(r.metrics.earnings_10yr));
  const n=data.length;
  if(n<3)return {available:false,n,reason:'At least three complete institutions are needed.'};
  const xMean=d3.mean(data,(r)=>r.metrics.net_price),yMean=d3.mean(data,(r)=>r.metrics.earnings_10yr);
  let xx=0,xy=0,yy=0;
  for(const r of data){const dx=r.metrics.net_price-xMean,dy=r.metrics.earnings_10yr-yMean;xx+=dx*dx;xy+=dx*dy;yy+=dy*dy;}
  if(xx===0)return {available:false,n,reason:'Net prices do not vary in this scope.'};
  const slope=xy/xx,intercept=yMean-slope*xMean;
  const residualSum=d3.sum(data,(r)=>(r.metrics.earnings_10yr-(intercept+slope*r.metrics.net_price))**2);
  const r2=yy>0?Math.max(0,Math.min(1,1-residualSum/yy)):null;
  return {available:true,n,slope,intercept,r2,residualSum,totalSum:yy,xExtent:d3.extent(data,(r)=>r.metrics.net_price)};
}
function regressionTooltip(fit) {
  if(!fit.available)return '<strong>Trend line unavailable</strong>';
  const change=(fit.slope<0?'−':'+')+currency(Math.abs(fit.slope*1000));
  return '<strong>Trend line</strong>'+tooltipRow('Schools',numberFormat.format(fit.n))+tooltipRow('Per $1,000 net price',change);
}
// 5. SCATTERPLOT: scales -> axes -> data-bound circles -> brush
// x/y convert data values into pixels. invert() converts brush pixels back to values.
function renderScatter(paired) {
  const regression=fitCollegeRegression(paired);
  window.scatterRegressionAudit={...regression,scope:{state:state.region,type:state.type,size:state.size},weighting:'Equal weight per institution',fitScope:'Global institution filters; highlights do not refit'};
  const { svg, w, h } = createChart("scatter-svg"),
    m = { l: 62, r: 25, t: 25, b: 39 },
    pw = w - m.l - m.r,
    ph = h - m.t - m.b;
  const x = d3
    .scaleLinear()
    .domain([
      Math.min(0, d3.min(paired, (r) => r.metrics.net_price) ?? 0),
      d3.max(paired, (r) => r.metrics.net_price) || 60000,
    ])
    .nice()
    .range([m.l, w - m.r]);
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(paired, (r) => r.metrics.earnings_10yr) || 120000])
    .nice()
    .range([h - m.b, m.t]);
  const size = d3
    .scaleSqrt()
    .domain([0, d3.max(institutions, (r) => r.metrics.undergrad_size)])
    .range([2, 7]);
  svg
    .append("g")
    .attr("class", "grid")
    .attr("transform", `translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(-pw).tickFormat(""));
  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${h - m.b})`)
    .call(d3.axisBottom(x).ticks(6).tickSize(3).tickPadding(7).tickFormat(shortDollar));
  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(4).tickSize(0).tickPadding(9).tickFormat(shortDollar))
    .call((g) => g.select(".domain").remove());
  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", m.l)
    .attr("y", 12)
    .text("Earnings 10 years after entry · 2024 USD");
  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", w - m.r)
    .attr("y", h - 5)
    .attr("text-anchor", "end")
    .text("Undergraduate net price →");
  if (paired.length) {
    const xm = d3.median(paired, (r) => r.metrics.net_price),
      ym = d3.median(paired, (r) => r.metrics.earnings_10yr);
    svg
      .append("line")
      .attr("class", "median-line")
      .attr("x1", x(xm))
      .attr("x2", x(xm))
      .attr("y1", m.t)
      .attr("y2", h - m.b);
    svg
      .append("line")
      .attr("class", "median-line")
      .attr("x1", m.l)
      .attr("x2", w - m.r)
      .attr("y1", y(ym))
      .attr("y2", y(ym));
    svg
      .append("text")
      .attr("class", "median-label")
      .attr("x", w - m.r - 3)
      .attr("y", y(ym) + 13)
      .attr("text-anchor", "end")
      .text("Sample median");
  }
  // Draw the benchmark behind the points and clip it to the plotting rectangle.
  if(regression.available){
    svg.append('defs').append('clipPath').attr('id','scatter-regression-clip').append('rect')
      .attr('x',m.l).attr('y',m.t).attr('width',pw).attr('height',ph);
    svg.append('line').attr('class','scatter-regression-line').attr('clip-path','url(#scatter-regression-clip)')
      .attr('x1',x(regression.xExtent[0])).attr('x2',x(regression.xExtent[1]))
      .attr('y1',y(regression.intercept+regression.slope*regression.xExtent[0]))
      .attr('y2',y(regression.intercept+regression.slope*regression.xExtent[1]))
      .attr('pointer-events','none');
  }
  svg
    .append("g")
    .selectAll("circle") // Larger circles go behind smaller circles.
    .data(
      [...paired].sort((a, b) => (b.metrics.undergrad_size || 0) - (a.metrics.undergrad_size || 0)),
    )
    .join("circle")
    .attr("class", "scatter-dot")
    .attr("data-id", (r) => r.id)
    .attr("cx", (r) => x(r.metrics.net_price))
    .attr("cy", (r) => y(r.metrics.earnings_10yr))
    .attr("r", (r) => (hasNumber(r.metrics.undergrad_size) ? size(r.metrics.undergrad_size) : 2.5))
    .attr("fill", (r) => types[r.type].color)
    .attr("opacity", (r) =>
      hasSelection() ? (selectedInstitutionIds.has(r.id) ? 0.88 : 0.09) : 0.50,
    );
  // A separate selection layer keeps the original size encoding intact.
  if(state.scatter?.size===1){
    const school=paired.find((row)=>state.scatter.has(row.id));
    if(school)drawSchoolFocus(svg,school,x,y,size,m,w,h);
  }
  let dragStart = null;
  const brush = d3
    .brush()
    .extent([
      [m.l, m.t],
      [w - m.r, h - m.b],
    ])
    .on("start", (e) => {
      if (e.sourceEvent) {
        hideTooltip();
        dragStart = d3.pointer(e.sourceEvent, svg.node());
      }
    })
    .on("end", (e) => {
      // Ignore programmatic brush.move() calls when restoring the selection.
      if (!e.sourceEvent) return;
      const clickPoint=d3.pointer(e.sourceEvent,svg.node());
      const clicked=nearestPoint(clickPoint);
      if(clicked && dragStart && Math.hypot(clickPoint[0]-dragStart[0],clickPoint[1]-dragStart[1])<5){openSchool(clicked.id);return;}
      if (e.selection) {
        const [[x0, y0], [x1, y1]] = e.selection;
        state.scatterBounds = [
          [x.invert(x0), y.invert(y1)],
          [x.invert(x1), y.invert(y0)],
        ];
        state.scatter = new Set(
          paired
            .filter(
              (r) =>
                x(r.metrics.net_price) >= x0 &&
                x(r.metrics.net_price) <= x1 &&
                y(r.metrics.earnings_10yr) >= y0 &&
                y(r.metrics.earnings_10yr) <= y1,
            )
            .map((r) => r.id),
        );
        if(!state.scatter.size){state.scatter=null;state.scatterBounds=null;toast("No plottable schools in that box.");}
        requestRender();
      } else {
        state.scatter = null;
        state.scatterBounds = null;
        const point = d3.pointer(e.sourceEvent, svg.node());
        const nearest = nearestPoint(point);
        if (
          nearest &&
          dragStart &&
          Math.hypot(point[0] - dragStart[0], point[1] - dragStart[1]) < 5
        ) {
          openSchool(nearest.id);
        }
        requestRender();
      }
    });
  const bg = svg.append("g").attr("class", "scatter-brush").call(brush);
  if (state.scatterBounds) {
    const [[x0, y0], [x1, y1]] = state.scatterBounds;
    bg.call(brush.move, [
      [x(x0), y(y1)],
      [x(x1), y(y0)],
    ]);
  }
  function nearestPoint([px, py]) {
    let best = null,
      dist = 10;
    for (const r of paired) {
      const d = Math.hypot(x(r.metrics.net_price) - px, y(r.metrics.earnings_10yr) - py);
      if (d < dist) {
        dist = d;
        best = r;
      }
    }
    return best;
  }
  bg.on("mousemove.tooltip", (e) => {
    if (e.buttons) {
      hideTooltip();
      return;
    }
    const pointer=d3.pointer(e,svg.node()),r=nearestPoint(pointer);
    if(r)showTooltip(e,institutionTooltip(r));
    else if(regression.available){
      const price=x.invert(pointer[0]),fitted=regression.intercept+regression.slope*price;
      if(price>=regression.xExtent[0]&&price<=regression.xExtent[1]&&Math.abs(pointer[1]-y(fitted))<=6)
        showTooltip(e,regressionTooltip(regression));
      else hideTooltip();
    }else hideTooltip();
  }).on("mouseleave.tooltip", hideTooltip);
  getElement("scatter-count").textContent = hasSelection()
    ? `${numberFormat.format(paired.filter((r) => selectedInstitutionIds.has(r.id)).length)} / ${numberFormat.format(paired.length)} points`
    : `${numberFormat.format(paired.length)} points`;
  if(state.scatter?.size===1){
    const selected=institutions.find((r)=>state.scatter.has(r.id));
    if(selected && (!hasNumber(selected.metrics.net_price)||!hasNumber(selected.metrics.earnings_10yr)))
      getElement('scatter-count').textContent='Selected school not plotted: missing cost or earnings';
  }
  getElement("scatter-empty").hidden = paired.length > 0;
}
// Persistent locator for the one explicitly selected school. The transparent
// brush stays above this pointer-free layer, so click/drag behavior is unchanged.
function drawSchoolFocus(svg,school,x,y,size,m,w,h) {
  const cx=x(school.metrics.net_price),cy=y(school.metrics.earnings_10yr);
  const boxW=Math.min(260,w-m.l-m.r-12),boxH=41;
  const bx=Math.max(m.l+4,Math.min(w-m.r-boxW-4,cx+20+boxW<w-m.r?cx+20:cx-boxW-20));
  const by=Math.max(m.t+4,Math.min(h-m.b-boxH-4,cy-boxH-18>=m.t?cy-boxH-18:cy+18));
  const focus=svg.append('g').attr('class','scatter-school-focus').attr('data-id',school.id)
    .attr('pointer-events','none').attr('role','img').attr('aria-label',`Selected school: ${school.name}`);
  focus.append('line').attr('x1',cx).attr('y1',cy)
    .attr('x2',Math.max(bx,Math.min(bx+boxW,cx))).attr('y2',by>cy?by:by+boxH)
    .attr('stroke',COLORS.selected).attr('stroke-width',1.4);
  focus.append('circle').attr('class','school-focus-halo').attr('cx',cx).attr('cy',cy).attr('r',12)
    .attr('fill','white').attr('stroke',COLORS.selected).attr('stroke-width',2.5);
  focus.append('circle').attr('cx',cx).attr('cy',cy)
    .attr('r',hasNumber(school.metrics.undergrad_size)?size(school.metrics.undergrad_size):2.5)
    .attr('fill',types[school.type].color);
  focus.append('rect').attr('class','school-focus-card').attr('x',bx).attr('y',by).attr('width',boxW).attr('height',boxH)
    .attr('rx',5).attr('fill','#fffffff5').attr('stroke',COLORS.selected).attr('stroke-width',1);
  const title=focus.append('text').attr('class','school-focus-name').attr('x',bx+9).attr('y',by+15)
    .attr('fill','#244c3a').attr('font-size',11).attr('font-weight',650).text(school.name);
  let label=school.name;
  while(title.node().getComputedTextLength()>boxW-18&&label.length>4){label=label.slice(0,-1);title.text(label+'…');}
  title.append('title').text(school.name);
  focus.append('text').attr('x',bx+9).attr('y',by+30).attr('fill',COLORS.muted).attr('font-size',10)
    .text(`Cost ${currency(school.metrics.net_price)} · Earnings ${currency(school.metrics.earnings_10yr)}`);
}
// Clicking a school selects it in place; all four charts stay on screen.
function openSchool(id) {
  const school = institutions.find((r) => r.id === id);
  if (!school) return;
  if (!filterInstitutions().some((r) => r.id === id)) {
    Object.assign(state, { region: "all", type: "all", size: "all" });
    toast(`Filters widened to show ${school.name} (${school.state}).`);
  }
  resetSelection();
  state.scatter = new Set([id]);
  getElement("school-search").value = schoolSearchLabel(school);
  hideTooltip();
  requestRender();
}
function searchSchool() {
  const value = getElement("school-search").value.trim().toLowerCase();
  if (!value) {
    toast("Enter an institution name to select it.");
    return;
  }
  const exact = institutions.filter((r) => schoolSearchLabel(r).toLowerCase()===value || r.name.toLowerCase()===value);
  const matches = exact.length ? exact : institutions.filter((r) => schoolSearchLabel(r).toLowerCase().includes(value));
  if (matches.length !== 1) {
    toast(matches.length ? `${matches.length} matches — choose a name and state from the suggestions.` : "No matching institution in this dataset.");
    getElement('school-search').setAttribute('aria-invalid', 'true');
    return;
  }
  getElement('school-search').removeAttribute('aria-invalid');
  const r=matches[0];
  openSchool(r.id);
}
// 9. CONTROLS AND INITIAL RENDER
// Events change state, then requestRender() updates the linked views.
Object.entries(stateNames)
  .sort((a, b) => a[1].localeCompare(b[1]))
  .forEach(([code, name]) => getElement("state-filter").add(new Option(`${code} · ${name}`, code)));
getElement("school-options").innerHTML = institutions
  .map((r) => `<option value="${escapeHtml(schoolSearchLabel(r))}"></option>`)
  .join("");
document.querySelectorAll("[data-type]").forEach((el) =>
  el.addEventListener("click", () => {
    state.type = el.dataset.type;
    onGlobalFilterChange();
  }),
);
getElement("state-filter").addEventListener("change", (e) => {
  state.region = e.target.value;
  onGlobalFilterChange();
});
getElement("size-filter").addEventListener("change", (e) => {
  state.size = e.target.value;
  onGlobalFilterChange();
});
getElement("map-metric").addEventListener("change", (e) => {
  state.mapMetric = e.target.value;
  mapFocus.division = null;
  requestRender();
});
getElement("clear-selection").addEventListener("click", () => {
  state.pseoField = "all"; programState.fine=null;
  resetSelection();
  requestRender();
});
getElement("reset").addEventListener("click", () => {
  Object.assign(state, {
    region: "all",
    type: "all",
    size: "all",
    mapMetric: "net_price",
    pseoSnapshot: META.defaultSnapshot,
    pseoField: "all",
  });
  resetSelection();
  getElement("school-search").value = "";
  hideTooltip();
  requestRender();
});
function exploreSchoolFlows(id, field = "all") {
  Object.assign(state, {
    region: "all",
    type: "all",
    size: "all",
    mapMetric: "net_price",
    pseoField: field,
  });
  resetSelection();
  state.scatter = new Set([id]);
  getElement("school-search").value = institutions.find((s) => s.id === id)?.name || "";
  requestRender();
}
getElement("story-button").addEventListener("click", () => {
  state.pseoSnapshot = META.defaultSnapshot;
  exploreSchoolFlows("196097", "11");
  toast(`Stony Brook computing · ${cohortLabel(state.pseoSnapshot)}`);
});
GRADUATE_SNAPSHOTS.forEach((key) =>
  getElement("pseo-snapshot").add(new Option(cohortLabel(key,true), key)),
);
getElement("pseo-snapshot").addEventListener("change", (event) => {
  state.pseoSnapshot = event.target.value;
  requestRender();
});
getElement("open-school").addEventListener("click", searchSchool);
getElement("school-search").addEventListener("keydown", (e) => {
  if (e.key === "Enter") searchSchool();
});
// A short source list replaces the former methods/provenance note.
const dataSources = [
  ["College Scorecard", "https://collegescorecard.ed.gov/data/"],
  ["IPEDS", "https://nces.ed.gov/ipeds/"],
  ["Census PSEO", "https://lehd.ces.census.gov/data/pseo_documentation.html"],
  ["BLS · Industry pay", "https://www.bls.gov/cew/"],
  ["BLS · Consumer prices", "https://www.bls.gov/cpi/"],
  ["Indeed Hiring Lab", "https://github.com/hiring-lab/job_postings_tracker"],
];
const sourceButton = getElement("method-button");
sourceButton.setAttribute("aria-controls", "tooltip");
sourceButton.setAttribute("aria-expanded", "false");
sourceButton.setAttribute("aria-haspopup", "dialog");
sourceButton.addEventListener("click", (event) => {
  if (sourceButton.getAttribute("aria-expanded") === "true") { hideTooltip(); return; }
  const links = dataSources.map(([name, url]) =>
    `<a href="${url}" target="_blank" rel="noopener noreferrer">${name}<span aria-hidden="true">↗</span></a>`).join("");
  showTooltip(event, `<strong>Data sources</strong><nav class="source-links" aria-label="Data sources">${links}</nav>`, "notes");
  const popup = getElement("tooltip");
  popup.style.pointerEvents = "auto";
  popup.setAttribute("role", "dialog");
  popup.setAttribute("aria-label", "Data sources");
  sourceButton.setAttribute("aria-expanded", "true");
  if (event.detail === 0) { popup.setAttribute("tabindex", "-1"); popup.focus(); }
});
document.addEventListener("pointerdown", (event) => {
  if (!event.target.closest("#tooltip,#method-button")) hideTooltip();
});
getElement("fullscreen").addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    toast("Fullscreen is unavailable. Maximize the browser window instead.");
  }
});
window.addEventListener("resize", () => {
  hideTooltip();
  requestRender();
});
// school-programs.js starts the dashboard after its controls are ready.
