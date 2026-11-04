/* Alternate country views reuse the same four-panel frame and local D3 bundle. */
(() => {
  const views = window.COUNTRY_VIEWS;
  const picker = getElement("country-picker");
  const toolbar = getElement("country-toolbar");
  const dashboard = getElement("country-dashboard");
  const controls = ["region", "school", "field", "period"];
  const choices = Object.fromEntries(controls.map((key) => [key, getElement("country-" + key)]));
  const sessions = new Map();
  const seriesColors = ["#315fa6", "#177b84", "#a44439"];
  let code = "US";

  function pick(options, select, value) {
    d3.select(select).selectAll("option").data(options, (row) => row?.[0] ?? "")
      .join("option").attr("value", ([key]) => key).text(([, name]) => name);
    select.value = value;
  }

  function addMark(selection, label, tip, choose) {
    selection.attr("tabindex", 0).attr("role", "button").attr("aria-label", label)
      .on("mousemove", (event, row) => showTooltip(event, tip(row)))
      .on("mouseleave", hideTooltip)
      .on("click", (_, row) => choose(row))
      .on("keydown", (event, row) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        choose(row);
      });
  }

  function empty(chart, message = "No published data for this selection") {
    chart.svg.append("text").attr("x", chart.w / 2).attr("y", chart.h / 2)
      .attr("class", "axis-label").attr("text-anchor", "middle").text(message);
  }

  function money(view, value) {
    return hasNumber(value) ? view.currency + numberFormat.format(Math.round(value)) : "—";
  }

  const percent = (value) => hasNumber(value) ? d3.format(".1f")(value) + "%" : "—";
  const numeric = (rows, index) => rows.map((row) => row[index]).filter(hasNumber);
  const median = (rows, index) => d3.median(numeric(rows, index)) ?? null;
  const abbreviate = (name, limit) => name.length > limit ? name.slice(0, limit - 1) + "…" : name;
  const panelText = (id, value) => { getElement(id).textContent = value; };

  function bars(chart, rows, {format, choose, color, tip}) {
    if (!rows.length) { empty(chart); return; }
    const {svg, w, h} = chart;
    const top = 4, bottom = h - 5, left = Math.min(190, w * .42), right = w - 62;
    const visible = rows.slice(0, Math.max(1, Math.floor((bottom - top) / 13)));
    const x = d3.scaleLinear([0, d3.max(visible, (r) => r.value) || 1], [left, right]);
    const y = d3.scaleBand(visible.map((r) => r.key), [top, bottom]).padding(.2);
    const groups = svg.selectAll(".country-bar").data(visible).join("g").attr("class", "country-bar")
      .attr("transform", (r) => "translate(0," + y(r.key) + ")");
    groups.append("rect").attr("width", w).attr("height", y.bandwidth()).attr("fill", "transparent");
    groups.append("rect").attr("x", left).attr("width", (r) => Math.max(1, x(r.value) - left))
      .attr("height", y.bandwidth()).attr("rx", 3).attr("fill", color);
    groups.append("text").attr("class", "axis-label").attr("x", left - 6)
      .attr("text-anchor", "end").attr("dy", ".32em").attr("y", y.bandwidth() / 2)
      .text((r) => abbreviate(r.name, Math.floor(left / 5.8)));
    groups.append("text").attr("class", "axis-label").attr("x", (r) => x(r.value) + 5)
      .attr("dy", ".32em").attr("y", y.bandwidth() / 2).text((r) => format(r.value));
    if (choose) addMark(groups, (r) => r.name + " " + format(r.value), tip, choose);
    else groups.on("mousemove", (event, row) => showTooltip(event, tip(row))).on("mouseleave", hideTooltip);
  }

  function scatter(view, peers, selected, choose) {
    const chart = createChart("country-scatter-svg");
    const points = peers.filter((row) => hasNumber(row[4]) && hasNumber(row[6]));
    if (!points.length) { empty(chart); return; }
    const {svg, w, h} = chart;
    const m = {l: 67, r: 21, t: 25, b: 34};
    const x = d3.scaleLinear([Math.max(0, d3.min(points, (r) => r[6]) - 5), 102], [m.l, w - m.r]);
    const y = d3.scaleLinear([0, d3.max(points, (r) => r[4]) * 1.1], [h - m.b, m.t]).nice();
    svg.append("g").attr("class", "grid").attr("transform", "translate(" + m.l + ",0)")
      .call(d3.axisLeft(y).ticks(4).tickSize(-(w - m.l - m.r)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", "translate(" + m.l + ",0)")
      .call(d3.axisLeft(y).ticks(4).tickFormat((v) => money(view, v)));
    svg.append("g").attr("class", "axis").attr("transform", "translate(0," + (h - m.b) + ")")
      .call(d3.axisBottom(x).ticks(5).tickFormat((v) => v + "%"));
    svg.append("text").attr("class", "axis-label").attr("x", 16).attr("y", 12).text("Median " + view.basis);
    svg.append("text").attr("class", "axis-label").attr("x", w - m.r).attr("y", h - 3)
      .attr("text-anchor", "end").text(view.measure);
    const label = (row) => view.schools[row[0]][0] + (row[1] ? " · " + view.fields[row[1]] : "");
    const dots = svg.selectAll(".country-dot").data(points).join("circle").attr("class", "country-dot")
      .attr("cx", (r) => x(r[6])).attr("cy", (r) => y(r[4])).attr("r", (r) => r[0] === selected ? 6 : 4)
      .attr("fill", (r) => !selected || r[0] === selected ? "#7542b6" : "#a4a9b2")
      .attr("opacity", (r) => r[0] === selected ? 1 : .58);
    addMark(dots, label, (r) => "<strong>" + escapeHtml(label(r)) + "</strong>"
      + tooltipRow("Median", money(view, r[4])) + tooltipRow(view.measure.replace(" (%)", ""), percent(r[6])), choose);
  }

  function programs(view, rows, allRows, selected, choose) {
    const chart = createChart("country-programs-svg");
    const fields = d3.rollups(rows.filter((r) => r[1]), (group) => ({
      weight: view.equalAreas ? 1 : d3.sum(numeric(group, 2)),
      value: median(group, 4),
      direct: group.length === 1 ? group[0] : null,
    }), (r) => r[1]).map(([key, values]) => ({key, name: view.fields[key], ...values}))
      .filter((r) => r.weight > 0);
    if (!fields.length) {
      getElement("country-earnings-gradient").style.background = "";
      panelText("country-earnings-max", "—");
      empty(chart); return;
    }
    const {svg, w, h} = chart;
    const root = d3.hierarchy({children: fields}).sum((r) => r.weight || 0).sort((a,b) => b.value - a.value);
    d3.treemap().size([w, h]).paddingOuter(5).paddingInner(3).round(true)(root);
    const values = numeric(allRows, 4);
    const max = Math.ceil((d3.quantile(values, .98) || 1) / 500) * 500;
    const color = d3.scaleSequential([0, max], sequentialColor(COLORS.income)).clamp(true);
    setColorLegend("#country-earnings-gradient", color);
    panelText("country-earnings-max", money(view, max) + "+");
    const cells = svg.selectAll(".country-tile").data(root.leaves()).join("g").attr("class", "country-tile");
    const fill = (n) => hasNumber(n.data.value) ? color(n.data.value) : COLORS.programMissing;
    cells.append("rect").attr("x", (n) => n.x0).attr("y", (n) => n.y0)
      .attr("width", (n) => n.x1 - n.x0).attr("height", (n) => n.y1 - n.y0).attr("rx", 2)
      .attr("fill", fill).attr("stroke", (n) => n.data.key === selected ? COLORS.selected : null).attr("stroke-width", 2.5);
    cells.filter((n) => n.x1 - n.x0 >= 14 && n.y1 - n.y0 >= 12).append("text")
      .attr("x", (n) => n.x0 + 3).attr("y", (n) => n.y0 + 10).attr("fill", (n) => readableColor(fill(n)))
      .attr("font-size", (n) => n.x1 - n.x0 < 45 ? 8 : 10).attr("pointer-events", "none")
      .text((n) => abbreviate(n.data.name, Math.max(1, Math.floor((n.x1 - n.x0 - 6) / 5.8))));
    cells.filter((n) => n.x1 - n.x0 >= 80 && n.y1 - n.y0 >= 32 && hasNumber(n.data.value)).append("text")
      .attr("x", (n) => n.x0 + 3).attr("y", (n) => n.y0 + 24).attr("fill", (n) => readableColor(fill(n)))
      .attr("font-size", 10).attr("pointer-events", "none").text((n) => money(view, n.data.value));
    addMark(cells, (n) => n.data.name, (n) => {
      const r = n.data;
      const quartiles = r.direct && hasNumber(r.direct[3]) && hasNumber(r.direct[5]);
      return "<strong>" + escapeHtml(r.name) + "</strong>"
        + (view.equalAreas ? "" : tooltipRow(view.count, numberFormat.format(r.weight)))
        + tooltipRow(r.direct ? "Median" : "Median of reported medians", money(view, r.value))
        + (quartiles ? tooltipRow("P25–P75", money(view, r.direct[3]) + "–" + money(view, r.direct[5])) : "");
    }, (n) => choose(n.data.key));
  }

  function lines(chart, series, {dateAxis, format, axis}) {
    const {svg, w, h} = chart;
    const points = series.flatMap((s) => s.points.filter((p) => hasNumber(p[1])));
    if (!points.length) { empty(chart); return; }
    const m = {l: 65, r: 24, t: 24, b: 25};
    const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p[0])))];
    const x = dateAxis
      ? d3.scaleUtc(d3.extent(dates, (d) => new Date(d)), [m.l, w - m.r])
      : d3.scalePoint(dates, [m.l, w - m.r]).padding(.2);
    const coords = (d) => x(dateAxis ? new Date(d) : d);
    const extent = d3.extent(points, (p) => p[1]);
    const pad = Math.max((extent[1] - extent[0]) * .12, 1);
    const y = d3.scaleLinear([Math.max(0, extent[0] - pad), extent[1] + pad], [h - m.b, m.t]).nice();
    svg.append("g").attr("class", "grid").attr("transform", "translate(" + m.l + ",0)")
      .call(d3.axisLeft(y).ticks(4).tickSize(-(w - m.l - m.r)).tickFormat(""));
    svg.append("g").attr("class", "axis").attr("transform", "translate(" + m.l + ",0)").call(d3.axisLeft(y).ticks(4).tickFormat(format));
    const ticks = d3.axisBottom(x);
    if (dateAxis) ticks.ticks(5);
    else if (dates.length > 7) ticks.tickValues(dates.filter((_,i) => i % 2 === 0 || i === dates.length - 1));
    svg.append("g").attr("class", "axis").attr("transform", "translate(0," + (h - m.b) + ")").call(ticks);
    svg.append("text").attr("class", "axis-label").attr("x", m.l).attr("y", 12).text(axis);
    const line = d3.line().defined((p) => hasNumber(p[1])).x((p) => coords(p[0])).y((p) => y(p[1]));
    series.forEach((s, i) => {
      svg.append("path").attr("d", line(s.points)).attr("fill", "none").attr("stroke", seriesColors[i])
        .attr("stroke-width", 2).attr("stroke-dasharray", s.dash ? "5 3" : null);
      if (!dateAxis) svg.selectAll(null).data(s.points.filter((p) => hasNumber(p[1]))).join("circle")
        .attr("cx", (p) => coords(p[0])).attr("cy", (p) => y(p[1])).attr("r", 3.5).attr("fill", seriesColors[i])
        .on("mousemove", (event, p) => showTooltip(event, tooltipRow(p[0], format(p[1])))).on("mouseleave", hideTooltip);
    });
    if (dateAxis) {
      const valid = series[0].points.filter((p) => hasNumber(p[1]));
      const nearest = d3.bisector((p) => Date.parse(p[0])).center;
      const byDate = series.map((s) => new Map(s.points));
      svg.append("rect").attr("x", m.l).attr("y", m.t)
        .attr("width", w - m.l - m.r).attr("height", h - m.t - m.b).attr("fill", "transparent")
        .on("mousemove", (event) => {
          const [px] = d3.pointer(event, svg.node());
          const day = valid[nearest(valid, +x.invert(px))]?.[0];
          if (!day) return;
          const detail = series.map((s,i) => {
            const value = byDate[i].get(day);
            return hasNumber(value) ? tooltipRow(s.name, d3.format(".1f")(value)) : "";
          }).join("");
          showTooltip(event, "<strong>" + escapeHtml(day) + "</strong>" + detail, "market");
        }).on("mouseleave", hideTooltip);
    }
  }

  function market(view, choice, region, scoped, chooseField) {
    const marketChart = createChart("country-market-svg");
    const field = view.fields[choice.field] || "All fields";
    const button = getElement("country-market-toggle");
    const primary = {industry: "Industry destinations", employment: "Employment after graduation", "field-employment": "Employment by field", earnings: "Earnings by survey year", hiring: "Hiring demand"}[view.mode];
    button.hidden = !view.hiring || view.mode === "hiring";
    button.textContent = choice.mode === "hiring" ? primary : "Hiring demand";
    if (choice.mode === "hiring") {
      panelText("country-market-title", "Hiring demand");
      const regional = view.hiring[region];
      const series = [{name: "National", points: view.hiring.National}];
      if (regional) series.push({name: region, points: regional, dash: true});
      lines(marketChart, series, {dateAxis: true, format: d3.format(".0f"), axis: "All job postings · Feb 2020 = 100"});
      panelText("country-market-note", "Indeed Hiring Lab · " + (regional ? "National (blue) · " + region + " (dashed)" : "National index"));
    } else if (choice.mode === "industry") {
      panelText("country-market-title", "Industry destinations");
      const entries = view.industry[choice.period]?.[choice.field ? field : "Total"] || [];
      const total = d3.sum(entries, (r) => r[1]);
      const rows = entries.map(([name, count, pay]) => ({key:name, name, value:count, pay})).sort((a,b) => b.value - a.value);
      bars(marketChart, rows, {format:(v) => percent(v / total * 100), color: "#315fa6",
        tip:(r) => "<strong>" + escapeHtml(r.name) + "</strong>" + tooltipRow("Known-industry share", percent(r.value / total * 100))
          + tooltipRow("Graduate annual median", money(view, r.pay))});
      panelText("country-market-note", "DfE LEO · National field benchmark · " + field);
    } else if (choice.mode === "field-employment") {
      panelText("country-market-title", "Employment by field");
      const rows = view.rows[choice.period].filter((r) => r[1] && scoped(r) && (!choice.field || r[1] === choice.field));
      const groups = d3.rollups(rows, (group) => median(group, 6), (r) => r[1])
        .filter(([,value]) => hasNumber(value)).map(([key,value]) => ({key,name:view.fields[key],value}))
        .sort((a,b) => b.value-a.value);
      bars(marketChart, groups, {format:percent, color:"#177b84", choose:(r) => chooseField(choice.field === r.key ? "" : r.key),
        tip:(r) => "<strong>" + escapeHtml(r.name) + "</strong>" + tooltipRow("Employment",percent(r.value))});
      panelText("country-market-note", choice.school ? "Published overall employment rates" : "Median of published institution rates");
    } else {
      const isPay = choice.mode === "earnings";
      panelText("country-market-title", isPay ? (view.cohortTrend ? "Earnings by graduating cohort" : "Earnings by survey year") : "Employment after graduation");
      const metrics = view.periods.map(([period]) => {
        const data = view.rows[period].filter((r) => scoped(r) && (choice.field ? r[1] === choice.field : view.coursePoints || !r[1]));
        return [isPay ? period : period + " mo", median(data, isPay ? 4 : 6)];
      });
      lines(marketChart, [{points:metrics}], {format: isPay ? (n) => money(view, n) : percent,
        axis: isPay ? "Median " + view.basis : view.measure});
      panelText("country-market-note", choice.school && choice.field ? view.schools[choice.school][0] + " · " + field
        : isPay ? "Median of published degree medians" : choice.school ? "Published institution rate" : "Median of published institution or programme rates");
    }
  }

  function render() {
    if (code === "US") return;
    const view = views[code], choice = sessions.get(code);
    const rows = view.rows[choice.period];
    const regions = [...new Set(rows.map((r) => view.schools[r[0]][1]))].sort();
    if (choice.region && !regions.includes(choice.region)) choice.region = "";
    const inRegion = (r) => !choice.region || view.schools[r[0]][1] === choice.region;
    const schools = [...new Set(rows.filter(inRegion).map((r) => r[0]))]
      .sort((a,b) => view.schools[a][0].localeCompare(view.schools[b][0]));
    if (choice.school && !schools.includes(choice.school)) choice.school = "";
    const scoped = (r) => inRegion(r) && (!choice.school || r[0] === choice.school);
    const fields = [...new Set(rows.filter(scoped).map((r) => r[1]).filter(Boolean))]
      .sort((a,b) => view.fields[a].localeCompare(view.fields[b]));
    if (choice.field && !fields.includes(choice.field)) choice.field = "";
    const set = (key, value) => {
      choice[key] = value;
      if (key === "region") choice.school = "";
      hideTooltip();
      render();
    };
    choices.region.parentElement.hidden = !!view.noRegions;
    pick([["", "All regions"], ...regions.map((x) => [x,x])], choices.region, choice.region);
    pick([["", "All institutions"], ...schools.map((id) => [id,view.schools[id][0]])], choices.school, choice.school);
    pick([["", "All fields"], ...fields.map((id) => [id,view.fields[id]])], choices.field, choice.field);
    const payPeriods = view.periods.filter(([key]) => view.rows[key].some((r) => hasNumber(r[4])));
    pick(payPeriods, choices.period, choice.period);
    controls.forEach((key) => { choices[key].onchange = (event) => set(key,event.target.value); });
    getElement("country-reset").onclick = () => {
      Object.assign(choice,{region:"",school:"",field:"",period:view.default,mode:view.mode});
      hideTooltip(); render();
    };
    getElement("country-market-toggle").onclick = () => set("mode", choice.mode === "hiring" ? view.mode : "hiring");
    const comparison = rows.filter((r) => choice.field ? r[1] === choice.field : view.coursePoints || !r[1]);
    const peers = comparison.filter(inRegion);
    const regional = d3.rollups(comparison, (group) => median(group, 4), (r) => view.schools[r[0]][1])
      .filter(([, value]) => hasNumber(value)).map(([key,value]) => ({key,name:key,value})).sort((a,b) => b.value-a.value);
    panelText("country-region-title", view.noRegions ? "Earnings by university" : "Earnings by region");
    panelText("country-program-title", view.equalAreas ? "Degree earnings" : "Program size and earnings");
    panelText("country-region-note", view.noRegions ? "Median of published degree medians" : "Median of published medians · " + view.basis);
    panelText("country-scatter-note", view.coursePoints ? "One point per published programme cell" : choice.field ? "One point per institution reporting this field" : "One point per published institution total");
    panelText("country-program-note", (view.equalAreas ? "Equal area per degree" : "Area: " + view.count.toLowerCase())
      + " · " + ("Published earnings · gray: unavailable"));
    panelText("country-active-scope", [view.name, choice.region, choice.school && view.schools[choice.school][0], choice.field && view.fields[choice.field]].filter(Boolean).join(" › "));
    panelText("country-release", view.release);
    bars(createChart("country-region-svg"), regional, {
      format:(v) => money(view,v),
      choose:(r) => view.noRegions ? set("school",choice.school === r.key ? "" : r.key) : set("region", choice.region === r.key ? "" : r.key),
      color:(r) => !(view.noRegions ? choice.school : choice.region) || r.key === (view.noRegions ? choice.school : choice.region) ? "#9360cc" : "#c4bdcc",
      tip:(r) => "<strong>" + escapeHtml(r.name) + "</strong>" + tooltipRow("Median of published medians",money(view,r.value)),
    });
    scatter(view, peers, choice.school, (r) => {
      choice.school = choice.school === r[0] ? "" : r[0];
      if (view.coursePoints && choice.school) choice.field = r[1];
      hideTooltip(); render();
    });
    programs(view, rows.filter(scoped), rows, choice.field, (key) => set("field", choice.field === key ? "" : key));
    market(view, choice, choice.region || (choice.school && view.schools[choice.school][1]), scoped, (key) => set("field",key));
  }

  function switchCountry(next) {
    code = next;
    hideTooltip();
    const isUS = code === "US";
    for (const id of ["us-toolbar", "us-dashboard", "us-selection"]) getElement(id).hidden = !isUS;
    for (const el of [toolbar, dashboard, getElement("country-selection")]) el.hidden = isUS;
    picker.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.country === code)));
    if (isUS) { requestRender(); return; }
    const view = views[code];
    if (!sessions.has(code)) sessions.set(code,{region:"",school:"",field:"",period:view.default,mode:view.mode});
    render();
  }

  const countries = [["US","United States"], ...Object.entries(views).map(([key, view]) => [key,view.name])];
  for (const [key,name] of countries) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.country = key;
    button.textContent = name;
    button.setAttribute("aria-pressed", String(key === "US"));
    button.onclick = () => switchCountry(key);
    picker.append(button);
  }
  window.addEventListener("resize", () => { if (code !== "US") requestAnimationFrame(render); });
})();
