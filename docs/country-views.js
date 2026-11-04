/* Country views use the same D3 chart forms as the U.S. dashboard. */
(() => {
  const views = window.COUNTRY_VIEWS;
  const supplements = window.COUNTRY_PARITY;
  const picker = getElement("country-picker");
  const toolbar = getElement("country-toolbar");
  const dashboard = getElement("country-dashboard");
  const keys = ["region", "school", "field", "period"];
  const controls = Object.fromEntries(keys.map((key) => [key, getElement("country-" + key)]));
  const sessions = new Map();
  const marketColors = ["#177b84", "#315fa6", "#4e7739", "#b0682d", "#a44439"];
  const references = "#626b71";
  let code = "US";
  let frame = 0;

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

  const money = (view, value) => hasNumber(value) ? view.currency + numberFormat.format(Math.round(value)) : "—";
  const percent = (value) => hasNumber(value) ? d3.format(".1f")(value) + "%" : "—";
  const numeric = (rows, index) => rows.map((row) => row[index]).filter(hasNumber);
  const median = (rows, index) => d3.median(numeric(rows, index)) ?? null;
  const abbreviate = (name, limit) => name.length > limit ? name.slice(0, limit - 1) + "…" : name;
  const text = (id, value) => { getElement(id).textContent = value; };
  const placeLabels = {
    Scotland:"SCT", Wales:"WLS", London:"LON", "Northern Ireland":"NI", "North East":"NE",
    "North West":"NW", "East Midlands":"EM", "West Midlands":"WM", "East of England":"E",
    "Yorkshire and the Humber":"YH", "South East":"SE", "South West":"SW",
  };

  function map(view, data, peers, region, choose) {
    const {svg,w,h} = createChart("country-region-svg");
    const values = new Map(d3.rollups(peers, (group) => median(group,4), (r) => view.schools[r[0]][1]));
    const known = [...values.values()].filter(hasNumber);
    const [min,max] = d3.extent(known);
    const scale = d3.scaleSequential([min ?? 0, max === min ? (min ?? 0) + 1 : max], sequentialColor(COLORS.map));
    const projection = d3.geoMercator().fitExtent([[20,9],[w-20,h-32]], data.geometry);
    const path = d3.geoPath(projection);
    const defs = svg.append("defs");
    const hatch = defs.append("pattern").attr("id","country-map-no-data").attr("patternUnits","userSpaceOnUse").attr("width",6).attr("height",6);
    hatch.append("rect").attr("width",6).attr("height",6).attr("fill",COLORS.missing);
    hatch.append("path").attr("d","M0,6 L6,0").attr("stroke",COLORS.hatch).attr("stroke-width",1);
    const fill = (f) => {
      const key = f.properties.key, value = values.get(key);
      if (!hasNumber(value)) return "url(#country-map-no-data)";
      const color = scale(value);
      return region && region !== key ? desaturateColor(color) : color;
    };
    const features = data.geometry.features;
    const states = svg.selectAll(".country-state").data(features).join("path")
      .attr("class","state-path country-state").attr("d",path).attr("fill",fill)
      .attr("data-region",(f)=>f.properties.key)
      .attr("aria-pressed",(f)=>String(f.properties.key===region));
    const selected = features.find((f) => f.properties.key === region);
    if (selected) for (const [stroke,width] of [["white",4.5],[COLORS.selected,2.2]]) {
      svg.append("path").attr("d",path(selected)).attr("fill","none").attr("stroke",stroke)
        .attr("stroke-width",width).attr("pointer-events","none");
    }
    const outline = svg.append("path").attr("class","map-hover-outline");
    const tip = (f) => "<strong>"+escapeHtml(f.properties.name)+"</strong>"
      + tooltipRow("Median of institution medians",money(view,values.get(f.properties.key)));
    addMark(states,(f)=>f.properties.name,tip,(f)=>choose(f.properties.key));
    states.on("mouseenter",(_,f)=>outline.attr("d",path(f)))
      .on("mouseleave",()=>{outline.attr("d",null);hideTooltip();});
    svg.selectAll(".country-state-label").data(features.filter((f)=>f.properties.key!=="ACT")).join("text")
      .attr("class","state-label country-state-label").attr("text-anchor","middle")
      .attr("x",(f)=>path.centroid(f)[0]).attr("y",(f)=>path.centroid(f)[1]+3)
      .style("fill",(f)=>hasNumber(values.get(f.properties.key))?readableColor(fill(f)):COLORS.ink)
      .text((f)=>placeLabels[f.properties.key]||f.properties.key);
    const act = features.find((f)=>f.properties.key==="ACT");
    if (act) {
      const [x,y]=path.centroid(act);
      const dot=svg.append("circle").datum(act).attr("cx",x).attr("cy",y).attr("r",4)
        .attr("fill",fill(act)).attr("stroke",COLORS.ink).style("cursor","pointer");
      addMark(dot,(f)=>f.properties.name,tip,(f)=>choose(f.properties.key));
    }
    setColorLegend("#country-map-gradient",scale);
    text("country-map-min",money(view,min));
    text("country-map-max",money(view,max));
    text("country-map-insight",selected?.properties.name || features.length + " regions");
    text("country-region-note","Median of institution medians · "+view.basis);
  }

  function fit(points) {
    if (points.length < 3) return {available:false,n:points.length,reason:"Too few published institutions"};
    const xm=d3.mean(points,r=>r[6]),ym=d3.mean(points,r=>r[4]);
    const xx=d3.sum(points,r=>(r[6]-xm)**2);
    if (!xx) return {available:false,n:points.length,reason:"Employment rates do not vary"};
    const slope=d3.sum(points,r=>(r[6]-xm)*(r[4]-ym))/xx;
    return {available:true,n:points.length,slope,intercept:ym-slope*xm,xExtent:d3.extent(points,r=>r[6])};
  }

  function scatter(view, national, peers, choice, choose, brushSelection) {
    const chart=createChart("country-scatter-svg");
    const complete=(r)=>hasNumber(r[4])&&hasNumber(r[6]);
    const points=peers.filter(complete), reference=national.filter(complete);
    if (!points.length) { empty(chart);return; }
    const {svg,w,h}=chart;
    const m={l:65,r:choice.region?108:81,t:26,b:34};
    const x=d3.scaleLinear([Math.max(0,d3.min(points,r=>r[6])-5),102],[m.l,w-m.r]);
    const y=d3.scaleLinear([0,d3.max(points,r=>r[4])*1.13],[h-m.b,m.t]).nice();
    svg.append("g").attr("class","grid").attr("transform","translate("+m.l+",0)")
      .call(d3.axisLeft(y).ticks(4).tickSize(-(w-m.l-m.r)).tickFormat(""));
    svg.append("g").attr("class","axis").attr("transform","translate("+m.l+",0)")
      .call(d3.axisLeft(y).ticks(4).tickFormat(v=>money(view,v)));
    svg.append("g").attr("class","axis").attr("transform","translate(0,"+(h-m.b)+")")
      .call(d3.axisBottom(x).ticks(6).tickFormat(v=>v+"%"));
    svg.append("text").attr("class","axis-label").attr("x",22).attr("y",12).text("Median "+view.basis);
    svg.append("text").attr("class","axis-label").attr("x",w-m.r).attr("y",h-4)
      .attr("text-anchor","end").text(view.measure+" →");
    const medX=x(d3.median(points,r=>r[6])),medY=y(d3.median(points,r=>r[4]));
    svg.append("line").attr("class","median-line").attr("x1",medX).attr("x2",medX).attr("y1",m.t).attr("y2",h-m.b);
    svg.append("line").attr("class","median-line").attr("x1",m.l).attr("x2",w-m.r).attr("y1",medY).attr("y2",medY);
    svg.append("text").attr("class","median-label").attr("x",w-m.r-4).attr("y",medY+13).attr("text-anchor","end").text("Sample median");
    svg.append("text").attr("class","median-label").attr("x",medX-6).attr("y",m.t+11).attr("text-anchor","end").text("Sample median");
    const trend=(key,label,rows)=>({key,label,name:label,fit:fit(rows)});
    const trends=choice.region?[
      trend("state","Trend line (region)",points),
      trend("national","Trend line (national)",reference),
    ]:[trend("national","Trend line",reference)];
    for (const t of trends) if (t.fit.available) {
      t.extent=[Math.max(x.domain()[0],t.fit.xExtent[0]),Math.min(x.domain()[1],t.fit.xExtent[1])];
      if(t.extent[0]>t.extent[1]) delete t.extent;
    }
    const trendTip=(t)=>"<strong>"+escapeHtml(t.name)+"</strong>"+(t.fit.available
      ?tooltipRow("Institutions",numberFormat.format(t.fit.n))
       +tooltipRow("Per employment percentage point",(t.fit.slope<0?"−":"+")+money(view,Math.abs(t.fit.slope)))
      :"<div>"+escapeHtml(t.fit.reason)+"</div>");
    drawScatterTrends(svg,trends.filter(t=>choice.region||t.fit.available),x,y,m,w,h,trendTip);
    const selected=(r)=>choice.school?r[0]===choice.school:choice.brush?.has(r[0]);
    const radius=d3.scaleSqrt([0,d3.max(points,r=>r[2]||0)||1],[2.5,6.5]);
    const dots=svg.append("g").selectAll("circle").data(points).join("circle")
      .attr("class","scatter-dot country-dot").attr("data-school",r=>r[0])
      .attr("cx",r=>x(r[6])).attr("cy",r=>y(r[4])).attr("r",r=>radius(r[2]||0))
            .attr("fill","#3d63ad")
      .attr("opacity",r=>selected(r) ? .95 : (choice.school || choice.brush?.size) ? .1 : .55);
    const label=(r)=>view.schools[r[0]][0]+(r[1]?" · "+view.fields[r[1]]:"");
    const dotTip=(r)=>"<strong>"+escapeHtml(label(r))+"</strong>"
      +tooltipRow("Median",money(view,r[4]))+tooltipRow("Employment",percent(r[6]));
    addMark(dots,label,dotTip,(r)=>choose(r[0]));
    if(choice.school) {
      const marked=points.find(r=>r[0]===choice.school);
      if(marked)svg.append("circle").attr("cx",x(marked[6])).attr("cy",y(marked[4]))
        .attr("r",radius(marked[2]||0)+4).attr("fill","none").attr("stroke",COLORS.selected).attr("stroke-width",2)
        .attr("pointer-events","none");
    }
    const hover=svg.append("circle").attr("class","scatter-hover-dot").attr("fill","#3d63ad").attr("display","none");
    function focus(row) {
      svg.classed("scatter-hovering",!!row);
      hover.attr("display",row?null:"none");
      if(row)hover.attr("cx",x(row[6])).attr("cy",y(row[4])).attr("r",Math.max(6,radius(row[2]||0)+2.5));
    }
    function nearest([px,py]) {
      let match=null,dist=10;
      for(const row of points){
        const d=Math.hypot(px-x(row[6]),py-y(row[4]));
        if(d<dist){match=row;dist=d;}
      }
      return match;
    }
    let start=null;
    const brush=d3.brush().extent([[m.l,m.t],[w-m.r,h-m.b]])
      .on("start",(e)=>{
        if(e.sourceEvent){start=d3.pointer(e.sourceEvent,svg.node());focus(null);hideTooltip();}
      })
      .on("end",(e)=>{
        if(!e.sourceEvent)return;
        const p=d3.pointer(e.sourceEvent,svg.node());
        if(start&&Math.hypot(p[0]-start[0],p[1]-start[1])<5){
          const row=nearest(p);if(row)choose(row[0]);else brushSelection(null);return;
        }
        const sel=e.selection;
        const ids=sel?new Set(points.filter(r=>x(r[6])>=sel[0][0]&&x(r[6])<=sel[1][0]&&y(r[4])>=sel[0][1]&&y(r[4])<=sel[1][1]).map(r=>r[0])):null;
        brushSelection(ids?.size?ids:null);
      });
    svg.classed("scatter-hovering",false);
    svg.append("g").attr("class","scatter-brush").call(brush)
      .on("mousemove.tooltip",(e)=>{
        if(e.buttons)return;
        const row=nearest(d3.pointer(e,svg.node()));
        focus(row);
        if(row)showTooltip(e,dotTip(row));else hideTooltip();
      }).on("mouseleave.tooltip",()=>{focus(null);hideTooltip();});
  }

  function programs(view, rows, allRows, choice, choose) {
    const chart=createChart("country-programs-svg");
    const fields=d3.rollups(rows.filter(r=>r[1]),group=>({
      weight:d3.sum(numeric(group,2)),value:median(group,4),direct:group.length===1?group[0]:null,
    }),r=>r[1]).map(([key,v])=>({key,name:view.fields[key],...v})).filter(r=>r.weight>0);
    if(!fields.length){text("country-earnings-max","—");empty(chart);return;}
    const {svg,w,h}=chart;
    const maximum=Math.ceil((d3.quantile(numeric(allRows,4),.98)||1)/1000)*1000;
    const color=d3.scaleSequential([0,maximum],sequentialColor(COLORS.income)).clamp(true);
    setColorLegend("#country-earnings-gradient",color);
    text("country-earnings-max",money(view,maximum)+"+");
    if(choice.programView==="income") {
      const available=fields.filter(r=>r.direct&&[3,4,5].every(i=>hasNumber(r.direct[i])))
        .sort((a,b)=>b.weight-a.weight).slice(0,6);
      if(!available.length){empty(chart);return;}
      const left=Math.min(156,w*.28),right=w-34;
      const x=d3.scaleLinear([0,d3.max(available,r=>r.direct[5])],[left,right]).nice();
      const y=d3.scaleBand(available.map(r=>r.key),[8,h-24]).padding(.26);
      svg.append("g").attr("class","axis").attr("transform","translate(0,"+(h-23)+")").call(d3.axisBottom(x).ticks(4).tickFormat(v=>money(view,v)));
      const groups=svg.selectAll(".country-range").data(available).join("g").attr("class","country-range");
      groups.append("rect").attr("x",0).attr("y",r=>y(r.key)).attr("width",w).attr("height",y.bandwidth())
        .attr("fill",r=>r.key===choice.field?COLORS.selectedFill:"transparent");
      groups.append("text").attr("class","axis-label").attr("x",left-8).attr("y",r=>y(r.key)+y.bandwidth()/2)
        .attr("dy",".32em").attr("text-anchor","end").text(r=>abbreviate(r.name,Math.floor(left/6)));
      groups.append("line").attr("x1",r=>x(r.direct[3])).attr("x2",r=>x(r.direct[5]))
        .attr("y1",r=>y(r.key)+y.bandwidth()/2).attr("y2",r=>y(r.key)+y.bandwidth()/2)
        .attr("stroke","#b68ace").attr("stroke-width",4).attr("stroke-linecap","round");
      groups.append("circle").attr("cx",r=>x(r.direct[4])).attr("cy",r=>y(r.key)+y.bandwidth()/2).attr("r",4)
        .attr("fill","#7034a3");
      addMark(groups,r=>r.name,r=>"<strong>"+escapeHtml(r.name)+"</strong>"+tooltipRow("Median",money(view,r.direct[4]))
        +tooltipRow("P25–P75",money(view,r.direct[3])+"–"+money(view,r.direct[5])),r=>choose(r.key));
      return;
    }
    const root=d3.hierarchy({children:fields}).sum(r=>r.weight||0).sort((a,b)=>b.value-a.value);
    d3.treemap().size([w,h]).paddingOuter(5).paddingInner(3).round(true)(root);
    const cells=svg.selectAll(".country-tile").data(root.leaves()).join("g").attr("class","country-tile");
    const fill=(n)=>hasNumber(n.data.value)?color(n.data.value):COLORS.programMissing;
    cells.append("rect").attr("x",n=>n.x0).attr("y",n=>n.y0)
      .attr("width",n=>n.x1-n.x0).attr("height",n=>n.y1-n.y0).attr("rx",2).attr("fill",fill)
      .attr("stroke",n=>n.data.key===choice.field?COLORS.selected:hasNumber(n.data.value)?null:COLORS.unpublished)
      .attr("stroke-dasharray",n=>n.data.key!==choice.field&&!hasNumber(n.data.value)?"3 2":null)
      .attr("stroke-width",n=>n.data.key===choice.field?2.5:1);
    const measure=document.createElement("canvas").getContext("2d");
    const font=getComputedStyle(svg.node()).fontFamily;
    cells.each(function(n){
      const width=n.x1-n.x0,height=n.y1-n.y0,compact=width<48||height<25;
      if(width<8||height<10)return;
      const inset=compact?2:5,size=compact?8:10;
      measure.font=size+"px "+font;
      const room=width-2*inset;
      let name=n.data.name;
      while(name&&measure.measureText(name).width>room)name=name.slice(0,-1);
      if(!name)return;
      const label=d3.select(this).append("text").attr("x",n.x0+inset).attr("y",n.y0+(compact?9:13))
        .attr("fill",readableColor(fill(n))).attr("font-size",size).attr("pointer-events","none");
      label.append("tspan").text(name);
      const count=numberFormat.format(n.data.weight),income=money(view,n.data.value);
      if(!compact&&height>=39&&measure.measureText(count).width<=room)label.append("tspan").attr("x",n.x0+inset).attr("dy",14).text(count);
      if(!compact&&height>=55&&measure.measureText(income).width<=room)label.append("tspan").attr("x",n.x0+inset).attr("dy",14).text(income);
    });
    addMark(cells,n=>n.data.name,(n)=>{
      const r=n.data,q=r.direct&&hasNumber(r.direct[3])&&hasNumber(r.direct[5]);
      return "<strong>"+escapeHtml(r.name)+"</strong>"+tooltipRow(view.count,numberFormat.format(r.weight))
        +tooltipRow(r.direct?"Median":"Median of reported medians",money(view,r.value))
        +(q?tooltipRow("P25–P75",money(view,r.direct[3])+"–"+money(view,r.direct[5])):"");
    },n=>choose(n.data.key));
  }

  function market(view,data,choice,region,rerender) {
    const pay=data.pay,isPay=choice.mode==="pay";
    const field=view.fields[choice.field]||"All fields";
    let series=[];
    if(isPay){
      let keys=pay.default,counts=null,total=0;
      const entries=view.industry?.[choice.period]?.[choice.field?field:"Total"];
      if(entries){
        counts=new Map(entries.map(r=>[r[0],r[1]]));
        total=d3.sum(entries,r=>r[1]);
        const matched=Object.keys(pay.series).filter(k=>counts.has(pay.series[k].industry))
          .sort((a,b)=>counts.get(pay.series[b].industry)-counts.get(pay.series[a].industry)).slice(0,5);
        if(matched.length)keys=matched;
        else counts=null;
      }
      series=keys.map((key,i)=>{
        const r=pay.series[key],share=counts&&total?counts.get(r.industry)/total:null;
        return {...r,key,color:marketColors[i],share,width:share?Math.max(1.3,share*18):2.3};
      });
      series.push({key:"cpi",label:"CPI inflation",points:pay.cpi,color:references,dash:true,width:1.7});
      text("country-market-title","Industry pay benchmarks");
      text("country-market-scope",counts?"National · "+field:"National · industry benchmarks");
    }else{
      series=[{key:"national",label:"National · all jobs",points:view.hiring.National,color:seriesColorsHiring[0],width:2.5}];
      if(view.hiring[region])series.push({key:"region",label:region+" · all jobs",points:view.hiring[region],color:seriesColorsHiring[1],width:2,dash:true});
      text("country-market-title","Hiring demand");
      text("country-market-scope","Indeed Hiring Lab · all jobs");
    }
    if(!series.some(s=>s.key===choice.marketFocus))choice.marketFocus="";
    getElement("country-market-mode").querySelectorAll("button").forEach(button=>{
      const active=button.dataset.countryMode===choice.mode;
      button.classList.toggle("active",active);
      button.setAttribute("aria-pressed",String(active));
      button.onclick=()=>{choice.mode=button.dataset.countryMode;choice.marketFocus="";hideTooltip();rerender();};
    });
    d3.select("#country-market-legend").style("--legend-columns",series.length).selectAll("button").data(series,s=>s.key).join("button")
      .attr("type","button").attr("class","industry-legend-item")
      .attr("aria-pressed",s=>String(choice.marketFocus===s.key)).attr("title",s=>s.industry||s.label)
      .html(s=>"<span>"+escapeHtml(s.label)+"</span><b><i style='border-top:"+s.width+"px "+(s.dash?"dashed":"solid")+" "+s.color+"'></i>"
        +(s.share?percent(100*s.share):"")+"</b>")
      .on("click",(_,s)=>{choice.marketFocus=choice.marketFocus===s.key?"":s.key;hideTooltip();rerender();});
    drawMarketLines(series,isPay,choice.marketFocus,isPay?pay.basis+" · YoY":"Job postings index · Feb 2020 = 100");
  }
  const seriesColorsHiring=["#315fa6","#177b84"];

  function drawMarketLines(series,isPay,focus,axis) {
    const chart=createChart("country-market-svg");
    const {svg,w,h}=chart;
    const points=series.flatMap(s=>s.points).filter(p=>hasNumber(p[1]));
    if(!points.length){empty(chart);return;}
    const m={l:48,r:24,t:22,b:isPay?34:24};
    const dates=[...new Set(points.map(p=>p[0]))].sort().map(d=>new Date(d));
    const x=d3.scaleUtc(d3.extent(dates),[m.l,w-m.r]);
    const [lo,hi]=d3.extent(points,p=>p[1]),pad=Math.max((hi-lo)*.1,.35);
    const y=d3.scaleLinear([lo-pad,hi+pad],[h-m.b,m.t]).nice();
    svg.append("g").attr("class","grid").attr("transform","translate("+m.l+",0)")
      .call(d3.axisLeft(y).ticks(4).tickSize(-(w-m.l-m.r)).tickFormat(""));
    svg.append("g").attr("class","axis").attr("transform","translate("+m.l+",0)")
      .call(d3.axisLeft(y).ticks(4).tickFormat(v=>d3.format(".0f")(v)+(isPay?"%":"")));
    const ticks=d3.axisBottom(x).tickSize(3);
    if(isPay)ticks.tickValues(dates).tickFormat(d=>"Q"+(Math.floor(d.getUTCMonth()/3)+1));
    else ticks.ticks(5);
    svg.append("g").attr("class","axis").attr("transform","translate(0,"+(h-m.b)+")").call(ticks);
    if(isPay)for(const [year,group] of d3.group(dates,d=>d.getUTCFullYear())){
      svg.append("text").attr("class","axis-label").attr("text-anchor","middle")
        .attr("x",d3.mean(group,d=>x(d))).attr("y",h-6).text(year);
    }
    svg.append("text").attr("class","axis-label").attr("x",m.l).attr("y",12).text(axis);
    const line=d3.line().defined(p=>hasNumber(p[1])).x(p=>x(new Date(p[0]))).y(p=>y(p[1]));
    const groups=svg.selectAll(".country-market-series").data(series).join("g").attr("class","country-market-series")
      .attr("data-series",s=>s.key).attr("opacity",s=>!focus||s.key===focus||s.key==="cpi"?1:.17);
    groups.append("path").attr("d",s=>line(s.points)).attr("fill","none").attr("stroke",s=>s.color)
      .attr("stroke-width",s=>s.width).attr("stroke-dasharray",s=>s.dash?"5 3":null);
    const nearest=d3.bisector(d=>+d).center;
    const byDate=series.map(s=>new Map(s.points));
    svg.append("rect").attr("x",m.l).attr("y",m.t).attr("width",w-m.l-m.r).attr("height",h-m.t-m.b)
      .attr("fill","transparent").on("mousemove",(event)=>{
        const [px,py]=d3.pointer(event,svg.node()),date=dates[nearest(dates,+x.invert(px))];
        if(!date)return;
        const day=date.toISOString().slice(0,10);
        const heading=isPay?date.getUTCFullYear()+" Q"+(Math.floor(date.getUTCMonth()/3)+1):day;
        const values=series.map((s,i)=>[s,byDate[i].get(day)]).filter(([,v])=>hasNumber(v));
        const closest=d3.least(values,([,v])=>Math.abs(py-y(v)));
        if(!closest){hideTooltip();return;}
        const [track,value]=closest;
        showTooltip(event,"<strong>"+escapeHtml(track.label)+"</strong>"
          +tooltipRow(heading,isPay?d3.format("+.1f")(value)+"%":d3.format(".1f")(value)),"market");
      }).on("mouseleave",hideTooltip);
  }

  function initial(view) {
    return {region:"",school:"",field:"",period:view.default,mode:"pay",marketFocus:"",programView:"mix",brush:null};
  }

  function render() {
    if(code==="US")return;
    const view=views[code],data=supplements[code],choice=sessions.get(code),rows=view.rows[choice.period];
    const regions=[...new Set(rows.map(r=>view.schools[r[0]][1]))].sort();
    if(choice.region&&!regions.includes(choice.region)&&!data.geometry.features.some(f=>f.properties.key===choice.region))choice.region="";
    const inRegion=r=>!choice.region||view.schools[r[0]][1]===choice.region;
    const schools=[...new Set(rows.filter(inRegion).map(r=>r[0]))].sort((a,b)=>view.schools[a][0].localeCompare(view.schools[b][0]));
    if(choice.school&&!schools.includes(choice.school))choice.school="";
    const scoped=r=>inRegion(r)&&(!choice.school||r[0]===choice.school)&&(!choice.brush||choice.brush.has(r[0]));
    const programRows=rows.filter(scoped);
    const fields=[...new Set(programRows.map(r=>r[1]).filter(Boolean))].sort((a,b)=>view.fields[a].localeCompare(view.fields[b]));
    if(choice.field&&!fields.includes(choice.field))choice.field="";
    const set=(key,value)=>{
      choice[key]=value;
      if(key==="region")choice.school="";
      if(["region","school","period"].includes(key))choice.brush=null;
      choice.marketFocus="";
      hideTooltip();render();
    };
    const options=data.geometry.features.map(f=>[f.properties.key,f.properties.name]);
    if(regions.includes("Multi-state / unspecified"))options.push(["Multi-state / unspecified","Multi-state / unspecified"]);
    pick([["","All regions"],...options],controls.region,choice.region);
    pick([["","All institutions"],...schools.map(id=>[id,view.schools[id][0]])],controls.school,choice.school);
    pick([["","All fields"],...fields.map(id=>[id,view.fields[id]])],controls.field,choice.field);
    pick(view.periods,controls.period,choice.period);
    keys.forEach(key=>{controls[key].onchange=event=>set(key,event.target.value);});
    const search=getElement("country-search");
    search.value=choice.school?view.schools[choice.school][0]:"";
    d3.select("#country-schools").selectAll("option").data(schools,id=>id).join("option").attr("value",id=>view.schools[id][0]);
    const find=()=>{
      const value=search.value.trim().toLowerCase();
      const id=schools.find(s=>view.schools[s][0].toLowerCase()===value);
      const matches=value?schools.filter(s=>view.schools[s][0].toLowerCase().includes(value)):[];
      if(id||matches.length===1){search.removeAttribute("aria-invalid");set("school",id||matches[0]);}
      else search.setAttribute("aria-invalid","true");
    };
    getElement("country-open-school").onclick=find;
    search.onkeydown=event=>{if(event.key==="Enter")find();};
    getElement("country-reset").onclick=()=>{Object.assign(choice,initial(view));search.removeAttribute("aria-invalid");hideTooltip();render();};
    const available=choice.school&&programRows.some(r=>r[1]&&[3,4,5].every(i=>hasNumber(r[i])));
    const programView=getElement("country-program-view");
    programView.querySelector("[value=income]").disabled=!available;
    if(!available)choice.programView="mix";
    programView.value=choice.programView;
    programView.onchange=event=>set("programView",event.target.value);
    const comparison=rows.filter(r=>choice.field?r[1]===choice.field:!r[1]);
    const peers=comparison.filter(inRegion);
    const paired=peers.filter(r=>hasNumber(r[4])&&hasNumber(r[6])).length;
    text("country-count",numberFormat.format(schools.length));
    text("country-scope-name",choice.region||view.name);
    text("country-paired",peers.length?percent(100*paired/peers.length):"—");
    text("country-pair-note",numberFormat.format(paired)+" / "+numberFormat.format(peers.length)+" institutions");
    text("country-scatter-note",choice.school?view.schools[choice.school][0]:choice.brush?choice.brush.size+" selected":choice.field?"Published field outcomes":"Published institution outcomes");
    text("country-program-count",numberFormat.format(d3.sum(numeric(programRows.filter(r=>r[1]),2)))+" "+view.count.toLowerCase());
    text("country-program-note",choice.programView==="income"?"P25–P75 · median dot":choice.school?"Area: "+view.count.toLowerCase()+" · published medians":"Area: "+view.count.toLowerCase()+" · median of reported medians");
    text("country-active-scope",[view.name,choice.region,choice.school&&view.schools[choice.school][0],choice.field&&view.fields[choice.field]].filter(Boolean).join(" › "));
    text("country-release",view.release);
    map(view,data,comparison,choice.region,key=>set("region",choice.region===key?"":key));
    scatter(view,comparison,peers,choice,id=>set("school",choice.school===id?"":id),(ids)=>{
      choice.school="";choice.brush=ids;hideTooltip();render();
    });
    programs(view,programRows,rows,choice,key=>set("field",choice.field===key?"":key));
    market(view,data,choice,choice.region||(choice.school&&view.schools[choice.school][1]),render);
  }

  function switchCountry(next) {
    code=next;
    hideTooltip();
    const isUS=code==="US";
    for(const id of ["us-toolbar","us-dashboard","us-selection"])getElement(id).hidden=!isUS;
    for(const el of [toolbar,dashboard,getElement("country-selection")])el.hidden=isUS;
    picker.querySelectorAll("button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.country===code)));
    if(isUS){requestRender();return;}
    if(!sessions.has(code))sessions.set(code,initial(views[code]));
    render();
  }

  for (const [key,name] of [["US","United States"],...Object.keys(supplements).map(key=>[key,views[key].name])]) {
    const button=document.createElement("button");
    button.type="button";button.dataset.country=key;button.textContent=name;
    button.setAttribute("aria-pressed",String(key==="US"));
    button.onclick=()=>switchCountry(key);
    picker.append(button);
  }
  window.addEventListener("resize",()=>{
    if(code==="US"||frame)return;
    frame=requestAnimationFrame(()=>{frame=0;render();});
  });
})();
