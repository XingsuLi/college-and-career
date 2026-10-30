/* Panel 4's hiring mode. A reviewed CIP rule selects up to three related
 * NATIONAL occupation series. School location adds a STATE overall reference.
 * These are separate published indices, never a state-by-occupation estimate.
 */
"use strict";
const HIRING = window.HIRING_DATA;
// Fixed identities; related roles shown together always use distinct colors.
const HIRING_ROLE_COLORS = {
  "Software Development": "#3d6fa8",
  "Data & Analytics": "#2e8b72",
  "IT Systems & Solutions": "#a5548b",
  "Banking & Finance": "#3d6fa8",
  "Electrical Engineering": "#2e8b72",
  "Marketing": "#2e8b72",
  "Medical Technician": "#3d6fa8",
  "Therapy": "#2e8b72",
  "Accounting": "#a5548b",
  "Aviation": "#3d6fa8",
  "Childcare": "#3d6fa8",
  "Civil Engineering": "#3d6fa8",
  "Community & Social Service": "#a5548b",
  "Driving": "#2e8b72",
  "Human Resources": "#3d6fa8",
  "IT Infrastructure, Operations & Support": "#3d6fa8",
  "Industrial Engineering": "#3d6fa8",
  "Installation & Maintenance": "#2e8b72",
  "Logistic Support": "#a5548b",
  "Management": "#2e8b72",
  "Mechanical Engineering": "#a5548b",
  "Media & Communications": "#3d6fa8",
  "Nursing": "#a5548b",
  "Production & Manufacturing": "#a5548b",
  "Project Management": "#a5548b",
  "Scientific Research & Development": "#a5548b",
  "Arts & Entertainment": "#2e8b72",
  "Education & Instruction": "#2e8b72",
  "Food Preparation & Service": "#3d6fa8",
  "Hospitality & Tourism": "#2e8b72",
  "Insurance": "#2e8b72",
  "Architecture": "#3d6fa8",
  "Construction": "#3d6fa8",
  "Dental": "#3d6fa8",
  "Legal": "#3d6fa8",
  "Pharmacy": "#3d6fa8",
  "Security & Public Safety": "#3d6fa8",
  "Social Science": "#3d6fa8"
};
const hiringState = { focus: null };
const hiringDates = HIRING.dates.map(d3.utcParse("%Y-%m-%d"));
const hiringDateLabel = d3.utcFormat("%b %d, %Y");
const hiringIndex = d3.format(".1f");
const hiringShortNames = {
  "Software Development": "Software development",
  "Data & Analytics": "Data & analytics",
  "IT Systems & Solutions": "IT systems",
  "IT Infrastructure, Operations & Support": "IT infrastructure",
  "Scientific Research & Development": "Scientific R&D",
  "Education & Instruction": "Education",
  "Community & Social Service": "Social services",
  "Production & Manufacturing": "Manufacturing",
  "Installation & Maintenance": "Installation & repair",
};

function hiringSelection() {
  const scope = programState.scope;
  const family = programFamilies()[0];
  const fine = programState.fine;
  const exact = fine && HIRING.mapping.fine[fine];
  const related = exact || HIRING.mapping.broad[family] || [];
  const field = fine
    ? EARNINGS.labels.fine[fine] || fine
    : family
      ? fieldNames[family] || family
      : "All fields";
  // An explicit origin filter takes precedence over the selected campus location.
  const states = [...new Set((scope?.schools || []).map((school) => school.state))];
  const region =
    state.region !== "all"
      ? state.region
      : scope?.school || (scope?.kind === "selection" && states.length === 1)
        ? states[0]
        : null;
  return { scope, family, fine, exact: !!exact, related, field, region };
}

function hiringSeries(selection) {
  const roles = selection.related.map((name) => ({
    code: "role-" + HIRING.sectorNames.indexOf(name),
    name,
    label: name + " · U.S.",
    short: hiringShortNames[name] || name,
    kind: "occupation",
    color: HIRING_ROLE_COLORS[name] || "#3d6fa8",
    values: HIRING.sectors[name],
    dash: null,
  }));
  const references = [
    {
      code: "hiring-us",
      name: "U.S.",
      label: "United States · all jobs",
      short: "U.S. · all jobs",
      kind: "national",
      color: "#6e7a73",
      values: HIRING.national,
      dash: "3 3",
    },
  ];
  if (selection.region && HIRING.states[selection.region])
    references.push({
      code: "hiring-" + selection.region,
      name: selection.region,
      label: (stateNames[selection.region] || selection.region) + " · all jobs",
      short: selection.region + " · all jobs",
      kind: "state",
      color: COLORS.selected,
      values: HIRING.states[selection.region],
      dash: "7 3",
    });
  return [...roles, ...references];
}

function renderHiringDemand() {
  const selection = hiringSelection();
  const series = hiringSeries(selection);
  if (!series.some((row) => row.code === hiringState.focus)) hiringState.focus = null;
  const latestLabel = hiringDateLabel(hiringDates.at(-1));
  getElement("industry-pay-title").textContent = "Hiring demand · Indeed";
  getElement("pseo-snapshot").value = state.pseoSnapshot;
  document.querySelector(".cohort-control > span").textContent = "Graduates";
  getElement("pseo-snapshot").title =
    "Graduates and years after graduation for program income";
  getElement("pseo-snapshot").setAttribute(
    "aria-label",
    "Alumni cohort for program income only; does not filter hiring demand",
  );
  const broader =
    selection.fine && !selection.exact && selection.related.length
      ? ` · broader CIP ${selection.family}`
      : "";
  getElement("industry-pay-scope").textContent = selection.related.length
    ? `${selection.field}${broader} · related U.S. roles`
    : selection.family
      ? `${selection.field} · overall references only`
      : "Overall hiring · select a program for related roles";
  getElement("industry-pay-scope").title =
    `${selection.scope?.name || "United States"} · ${selection.field}`;
  getElement("industry-coverage-line").textContent = selection.related.length
    ? `National occupations · ${latestLabel}${selection.region ? ` · ${selection.region} reference = all jobs` : ""}`
    : selection.family
      ? `No reviewed role mapping · ${latestLabel}${selection.region ? ` · ${selection.region} all jobs` : " · U.S. all jobs"}`
      : `All-job references · ${latestLabel}${selection.region ? ` · ${selection.region} and U.S.` : " · United States"}`;
  getElement("industry-pay-empty").hidden = true;
  getElement("industry-pay-svg").setAttribute(
    "aria-label",
    "Recent hiring indices for related national occupations, with U.S. and optional state all-job references. Not alumni employment rates.",
  );

  d3.select("#industry-pay-legend")
    .selectAll("button")
    .data(series, (row) => row.code)
    .join("button")
    .attr("class", "industry-legend-item")
    .attr("data-code", (row) => row.code)
    .attr("disabled", null)
    .attr("aria-pressed", (row) => String(hiringState.focus === row.code))
    .attr(
      "title",
      (row) =>
        `${row.label} · Index: ${hiringIndex(row.values.at(-1))}`,
    )
    .html(
      (row) =>
        `<span>${escapeHtml(row.short)}</span><b><i style="border-top:2px ${row.dash ? "dashed" : "solid"} ${row.color}"></i>${hiringIndex(row.values.at(-1))}</b>`,
    )
    .on("click", (_, row) => {
      hiringState.focus = hiringState.focus === row.code ? null : row.code;
      hideTooltip();
      requestRender();
    });
  drawHiringDemand(createChart("industry-pay-svg"), series);
  window.industryPayAudit = {
    mode: "hiring",
    frequency: "weekly observed",
    snapshot: state.pseoSnapshot,
    scope: selection.scope?.name,
  };
  window.industryPayInteractionAudit = null;
  window.industryHoverAudit = null;
  window.hiringAudit = {
    latest: HIRING.latest,
    mode: "hiring",
    field: selection.field,
    family: selection.family || null,
    fine: selection.fine,
    mapping: selection.exact
      ? "four-digit rule"
      : selection.related.length
        ? "two-digit family"
        : "overall references only",
    region: selection.region,
    school: selection.scope?.school || null,
    scopeIDs: [...(selection.scope?.ids || [])],
    related: [...selection.related],
    cohortAffectsHiring: false,
    widthPixels: 2,
    series: series.map((row) => ({
      code: row.code,
      label: row.label,
      kind: row.kind,
      values: [...row.values],
    })),
  };
}

function drawHiringDemand({ svg, w, h }, series) {
  const m = { l: 42, r: 22, t: 21, b: 22 };
  const x = d3
    .scaleUtc()
    .domain([d3.utcParse("%Y-%m-%d")("2023-01-01"), hiringDates.at(-1)])
    .range([m.l, w - m.r]);
  const values = series.flatMap((row) => row.values).filter(hasNumber);
  const low = Math.min(100, d3.min(values)),
    high = Math.max(100, d3.max(values));
  const pad = Math.max(5, (high - low) * 0.08);
  const y = d3
    .scaleLinear()
    .domain([Math.max(0, low - pad), high + pad])
    .nice()
    .range([h - m.b, m.t]);
  const line = d3
    .line()
    .defined((value) => hasNumber(value))
    .x((value, index) => x(hiringDates[index]))
    .y(y);
  svg
    .append("g")
    .attr("class", "grid")
    .attr("transform", `translate(${m.l},0)`)
    .call(
      d3
        .axisLeft(y)
        .ticks(h < 160 ? 3 : 4)
        .tickSize(-(w - m.l - m.r))
        .tickFormat(""),
    );
  svg
    .append("line")
    .attr("x1", m.l)
    .attr("x2", w - m.r)
    .attr("y1", y(100))
    .attr("y2", y(100))
    .attr("stroke", "#c3ccc5")
    .attr("stroke-dasharray", "3 4");
  const opacity = (row) => (!hiringState.focus || row.code === hiringState.focus ? 1 : 0.18);
  const groups = svg
    .selectAll(".hiring-series")
    .data(series, (row) => row.code)
    .join("g")
    .attr("class", "hiring-series destination-pay-series")
    .attr("data-code", (row) => row.code)
    .attr("opacity", opacity);
  groups
    .append("path")
    .attr("class", "hiring-line")
    .attr("d", (row) => line(row.values))
    .attr("fill", "none")
    .attr("stroke", (row) => row.color)
    .attr("stroke-width", 2)
    .attr("stroke-dasharray", (row) => row.dash)
    .attr("stroke-linejoin", "round")
    .attr("stroke-linecap", "round");
  groups
    .append("path")
    .attr("class", "industry-pay-hit")
    .attr("d", (row) => line(row.values))
    .attr("fill", "none")
    .attr("stroke", "transparent")
    .attr("stroke-width", 10)
    .attr("pointer-events", "none")
    .attr("tabindex", 0)
    .attr("role", "button")
    .attr(
      "aria-label",
      (row) =>
        `${row.label}: ${hiringIndex(row.values.at(-1))} on ${hiringDateLabel(hiringDates.at(-1))}. Index, February 2020 equals 100. Highlight series.`,
    )
    .on("keydown", (event, row) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        hiringState.focus = hiringState.focus === row.code ? null : row.code;
        requestRender();
      }
    });
  const ticks = [2023, 2024, 2025, 2026].map((year) => new Date(Date.UTC(year, 0, 1)));
  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${h - m.b})`)
    .call(d3.axisBottom(x).tickValues(ticks).tickFormat(d3.utcFormat("%Y")));
  svg
    .append("g")
    .attr("class", "axis")
    .attr("transform", `translate(${m.l},0)`)
    .call(
      d3
        .axisLeft(y)
        .ticks(h < 160 ? 3 : 4)
        .tickFormat(d3.format(".0f")),
    );
  svg
    .append("text")
    .attr("class", "axis-label")
    .attr("x", m.l)
    .attr("y", 11)
    .text("Job postings index · Feb 1, 2020 = 100");
  // A single inspection surface shows ALL observed series at the nearest week.
  // This avoids pointer ambiguity where thin lines cross each other.
  const cursor = svg.append("g").attr("class", "hiring-cursor").attr("pointer-events", "none");
  let week = null;
  function inspect(event) {
    week = d3
      .bisector((date) => date)
      .center(hiringDates, x.invert(d3.pointer(event, svg.node())[0]));
    cursor
      .selectAll("line")
      .data([week])
      .join("line")
      .attr("x1", (i) => x(hiringDates[i]))
      .attr("x2", (i) => x(hiringDates[i]))
      .attr("y1", m.t)
      .attr("y2", h - m.b)
      .attr("stroke", "#bbc6bd")
      .attr("stroke-dasharray", "3 3");
    cursor
      .selectAll("circle")
      .data(series.filter((row) => hasNumber(row.values[week])))
      .join("circle")
      .attr("cx", x(hiringDates[week]))
      .attr("cy", (row) => y(row.values[week]))
      .attr("r", 3.5)
      .attr("fill", "white")
      .attr("stroke", (row) => row.color)
      .attr("stroke-width", 1.8);
    const rows = series.map((row) => tooltipRow(
      row.kind === "occupation" ? row.short + " · US" : row.short,
      hasNumber(row.values[week]) ? hiringIndex(row.values[week]) : "N/A",
    )).join("");
    showTooltip(event, `<strong>Hiring index · ${hiringDateLabel(hiringDates[week])}</strong>${rows}<div class="tip-muted">Feb 2020 = 100</div>`);
    window.hiringHoverAudit = {
      date: HIRING.dates[week],
      values: series.map((row) => [row.code, row.values[week]]),
    };
  }
  svg
    .append("rect")
    .attr("class", "hiring-pointer-surface")
    .attr("x", m.l)
    .attr("y", m.t)
    .attr("width", Math.max(0, w - m.l - m.r))
    .attr("height", Math.max(0, h - m.t - m.b))
    .attr("fill", "transparent")
    .on("mousemove", inspect)
    .on("click", (event) => {
      if (week === null) return;
      const py = d3.pointer(event, svg.node())[1];
      const nearest = series
        .filter((row) => hasNumber(row.values[week]))
        .sort((a, b) => Math.abs(y(a.values[week]) - py) - Math.abs(y(b.values[week]) - py))[0];
      if (nearest && Math.abs(y(nearest.values[week]) - py) < 14) {
        hiringState.focus = hiringState.focus === nearest.code ? null : nearest.code;
        requestRender();
      }
    })
    .on("mouseleave", () => {
      week = null;
      cursor.selectAll("*").remove();
      window.hiringHoverAudit = null;
      hideTooltip();
    });
}
getElement("reset").addEventListener("click", () => {
  hiringState.focus = null;
});
