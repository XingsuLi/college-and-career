/* Program composition follows the active geographic/institution scope.
 * Counts sum across schools. Income percentiles remain school-specific. */
"use strict";
const PROGRAMS = window.SCHOOL_PROGRAM_DATA;
const FINE_INCOME = { labels: EARNINGS.labels.fine };
const programState = { view:"mix", grain:"2", fine:null, page:0, school:null, scope:null };
const programColor = d3.scaleSequential(sequentialColor(COLORS.income)).domain([0,150000]).clamp(true);
function programFamilies() { return state.pseoField==='all'?[]:[state.pseoField]; }
const programShareColor = d3.scaleSequential(sequentialColor(COLORS.share)).domain([0,.30]).clamp(true);
function resolveProgramScope() {
  const schools=filteredInstitutions.filter(matchesAcademicSelection);
  const explicitSchool=state.scatter?.size===1 && schools.length===1 ? schools[0] : null;
  const kind=explicitSchool?'school':state.scatter!==null?'selection':state.region!=='all'?'state':'national';
  const name=explicitSchool?.name || (kind==='selection'?`Selected schools${state.region!=='all'?' in '+stateNames[state.region]:''}`:state.region!=='all'?stateNames[state.region]:'United States');
  return {kind,name,school:explicitSchool?.id||null,schools,ids:schools.map((s)=>s.id),key:schools.map((s)=>s.id).join('|'),
    awardSchools:schools.filter((s)=>PROGRAMS.awards[s.id]).length};
}
function programScopeRows(scope) {
  if(!scope)return [];
  const counts=new Map();let total=0;
  for(const school of scope.schools){
    const awards=PROGRAMS.awards[school.id];if(!awards)continue;
    total+=awards.total;
    for(const [cip,count] of awards.programs){const code=programState.grain==='2'?cip.slice(0,2):cip.slice(0,5);counts.set(code,(counts.get(code)||0)+count);}
  }
  return [...counts].map(([code,count])=>{
    const income=scope.school?lookupEarnings(scope.school,code,state.pseoSnapshot):null;
    return {code,count,share:total?count/total:0,
      name:programState.grain==='2'?PSEO.labels.fields[code]||`CIP ${code}`:FINE_INCOME.labels[code]||`CIP ${code}`,
      short:programState.grain==='2'?fieldNames[code]||`CIP ${code}`:FINE_INCOME.labels[code]||`CIP ${code}`,
      values:income?.values||[null,null,null],status:income?.status[0]||(scope.school?'unavailable':'not_pooled')};
  }).sort((a,b)=>b.count-a.count||a.code.localeCompare(b.code));
}
function schoolProgramRows(id) {
  const school=institutions.find((s)=>s.id===id);
  return school?programScopeRows({schools:[school],school:id}):[];
}
function programTileColor(row) {
  return programState.scope?.school ? (hasNumber(row.values[1])?programColor(row.values[1]):row.status==='suppressed'?'url(#program-suppressed)':'#ffffff') : programShareColor(row.share);
}
function programIsSelected(row) {
  return programState.grain === "4" && programState.fine ? row.code === programState.fine : programFamilies().includes(row.code.slice(0,2));
}
function chooseSchoolProgram(code) {
  const family = code.slice(0,2);
  const same = programState.grain === "4" ? programState.fine === code : programFamilies().length===1 && programFamilies()[0]===family;
  state.pseoField = code === "all" || same ? "all" : family;
  programState.fine = code !== "all" && !same && programState.grain === "4" ? code : null;
  const index = programScopeRows(programState.scope).findIndex((row) => row.code === code);
  programState.page = index < 0 ? 0 : Math.floor(index / 6);
  hideTooltip();requestRender();
}
function programTooltip(row, scope) {
  const total=d3.sum(scope.schools,(school)=>PROGRAMS.awards[school.id]?.total||0);
  let html=`<strong>${escapeHtml(row.short)}</strong><div class="tip-muted">${escapeHtml(scope.name)}</div>`
    +tooltipRow('Awards',`${numberFormat.format(row.count)}/${numberFormat.format(total)} · ${(100*row.share).toFixed(1)}%`);
  if(scope.school){
    html+=hasNumber(row.values[1])
      ?tooltipRow('Median / year',currency(row.values[1]))+tooltipRow('P25–P75',`${currency(row.values[0])}–${currency(row.values[2])}`)
      :tooltipRow('Income',row.status==='suppressed'?'Suppressed':'N/A');
    html+=`<div class="tip-muted">${cohortLabel(state.pseoSnapshot)} · ${META.pseoDollarYear} USD</div>`;
  }else html+=`<div class="tip-muted">Awards ${META.awardYear}</div>`;
  return html;
}
function renderSchoolPrograms() {
  const scope=resolveProgramScope(),school=scope.school?scope.schools[0]:null;
  if(programState.scope?.key!==scope.key){programState.page=0;}
  programState.scope=scope;programState.school=scope.school;
  if(!school)programState.view='mix';
  if(programState.fine&&!programFamilies().includes(programState.fine.slice(0,2)))programState.fine=null;
  const parentLabel=state.region==='all'?'All U.S. schools in dataset':`All ${stateNames[state.region]} schools`;
  const picker=getElement('program-school');
  const pickerKey=filteredInstitutions.map((r)=>r.id).join(',')+'|'+parentLabel;
  if(picker.dataset.scopeKey!==pickerKey){picker.dataset.scopeKey=pickerKey;picker.innerHTML=`<option value="">${escapeHtml(parentLabel)}</option>`+filteredInstitutions.map((r)=>`<option value="${r.id}">${escapeHtml(schoolSearchLabel(r))}</option>`).join('');}
  picker.value=scope.school||'';picker.title=school?schoolSearchLabel(school):parentLabel;
  const viewControl=getElement('program-view');
  viewControl.querySelector('[value="mix"]').textContent=school?'Size and earnings':'Program composition';
  viewControl.querySelector('[value="income"]').disabled=!school;
  viewControl.title=school?'Choose program composition or income intervals':'Income intervals require one school; aggregated school medians are not valid percentiles.';
  viewControl.value=programState.view;
  getElement('program-grain').value=programState.grain;
  getElement('programs-title').textContent=school?'School program size and earnings':`${scope.name} · program composition`;
  getElement('programs-title').title=`${scope.name} · ${scope.schools.length} institutions in scope`;
  getElement('program-color-key').hidden=programState.view!=='mix';
  getElement('program-color-key').dataset.metric=school?'income':'share';
  getElement('program-color-key').innerHTML=school?'Median <span class="program-gradient"></span> $0–150k+ <i class="suppressed-key"></i>Supp. <i class="unpublished-key"></i>Not pub.':'Award share <span class="program-gradient"></span> 0–30%+';
  setColorLegend(".program-gradient", school ? programColor : programShareColor);
  getElement('program-pages').hidden=programState.view!=='income';
  const rows=programScopeRows(scope),total=d3.sum(rows,(r)=>r.count);
  const empty=getElement('programs-empty');empty.hidden=!!rows.length;
  getElement('programs-empty-title').textContent=scope.schools.length?'No positive bachelor’s awards in this scope':'No schools match the selection';
  getElement('programs-empty-note').textContent='Broaden the geographic or institution filters. Missing awards are not estimated.';
  getElement('program-total').textContent=school?`${hasNumber(school.metrics.undergrad_size)?numberFormat.format(school.metrics.undergrad_size):'—'} undergrads · ${numberFormat.format(total)} awards`
    :`${numberFormat.format(scope.awardSchools)}/${numberFormat.format(scope.schools.length)} schools with data · ${numberFormat.format(total)} awards`;
  getElement('program-total').title=`${scope.name}. ${scope.awardSchools} of ${scope.schools.length} institutions have an IPEDS awards table. Totals cover this dashboard’s eligible school sample, not every U.S. institution. First-major bachelor’s degrees, ${META.awardYear}; not current enrollment.`;
  const selectedRows=rows.filter(programIsSelected);
  const selectionKey=`${scope.key}|${programState.grain}|${selectedRows.map((r)=>r.code).join(',')}`;
  if(programState.view==='income'&&selectionKey!==programState.lastSelection&&selectedRows.length)programState.page=Math.floor(rows.findIndex((r)=>r.code===selectedRows[0].code)/6);
  programState.lastSelection=selectionKey;
  const item=getElement('program-item');
  item.innerHTML='<option value="all">All fields / programs</option>'+rows.map((r)=>`<option value="${r.code}">${escapeHtml(r.short)} (${numberFormat.format(r.count)})</option>`).join('');
  if(selectedRows.length===1)item.value=selectedRows[0].code;
  else if(selectedRows.length>1){item.add(new Option(`${selectedRows.length} linked programs`,'linked'));item.value='linked';}
  getElement('program-source-note').textContent=school?(programState.view==='mix'?`Awards ${META.awardYear} · color: median`:'P25–P75 · dot: median · right: awards'):'Area: awards · color: share';
  getElement('program-link-note').textContent=school?`Year ${state.pseoSnapshot.split(':')[1]} · ${META.pseoDollarYear} USD${programState.fine?' · CIP '+programState.fine:''}`:`IPEDS ${META.awardYear}`;
  const pages=Math.max(1,Math.ceil(rows.length/6));programState.page=Math.min(programState.page,pages-1);
  getElement('program-page').textContent=`${programState.page+1}/${pages}`;
  getElement('program-prev').disabled=programState.page===0;getElement('program-next').disabled=programState.page>=pages-1;
  const chart=createChart('programs-svg');
  if(rows.length){if(programState.view==='mix')drawProgramTreemap(chart,rows,scope);else drawProgramIntervals(chart,rows,scope);}
  window.schoolProgramAudit={school:scope.school,scope:{kind:scope.kind,name:scope.name,ids:[...scope.ids],schoolCount:scope.schools.length,awardSchools:scope.awardSchools},
    view:programState.view,grain:programState.grain,total,selected:selectedRows.map((r)=>r.code),families:[...programFamilies()],snapshot:state.pseoSnapshot,
    sum:d3.sum(rows,(r)=>r.count),rows:rows.map((r)=>({...r,values:[...r.values]})),page:programState.page,
    colorMetric:school?'School PSEO median':'Share of selected-scope awards',population:'Selected institution sample; first-major bachelor’s awards'};
}
function bindProgramEvents(selection, school) {
  return selection.attr("role","button").attr("tabindex",0).attr("data-code",(r)=>r.code)
    .attr("aria-label",(r)=>`${r.name}: ${r.count} awards, ${(r.share*100).toFixed(1)} percent. ${hasNumber(r.values[1])?'P25 '+currency(r.values[0])+', median '+currency(r.values[1])+', P75 '+currency(r.values[2]):r.status==='not_pooled'?'Select a school for income':'Earnings '+r.status}. Select program.`)
    .on("click",(_,r)=>chooseSchoolProgram(r.code))
    .on("keydown",(event,r)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();chooseSchoolProgram(r.code);}})
    .on("mousemove",(event,r)=>showTooltip(event,programTooltip(r,school))).on("mouseleave",hideTooltip);
}
function drawProgramTreemap({svg,w,h}, rows, school) {
  const defs=svg.append('defs');
  const suppressed=defs.append('pattern').attr('id','program-suppressed').attr('patternUnits','userSpaceOnUse').attr('width',6).attr('height',6);
  suppressed.append('rect').attr('width',6).attr('height',6).attr('fill',COLORS.missing);
  suppressed.append('path').attr('d','M0,6 L6,0').attr('stroke',COLORS.hatch).attr('stroke-width',1);
  const root=d3.hierarchy({children:rows}).sum((r)=>r.count||0);
  d3.treemap().size([w,h]).paddingOuter(5).paddingInner(3).round(true)(root);
  const cells=svg.selectAll(".program-tile").data(root.leaves().map((node)=>({...node.data,box:node}))).join("g").attr("class","program-tile");
  bindProgramEvents(cells,school);
  cells.append("rect").attr("class","program-tile-base").attr("x",(r)=>r.box.x0).attr("y",(r)=>r.box.y0)
    .attr("width",(r)=>r.box.x1-r.box.x0).attr("height",(r)=>r.box.y1-r.box.y0).attr("rx",2)
    .attr("fill",programTileColor)
    .attr("stroke",(r)=>school.school&&!hasNumber(r.values[1])&&r.status!=="suppressed"?COLORS.unpublished:"none")
    .attr("stroke-dasharray",(r)=>school.school&&!hasNumber(r.values[1])&&r.status!=="suppressed"?"3 2":null)
    .attr("stroke-width",1);
  for (const [stroke,width] of [["#ffffff",5],[COLORS.selected,2.2]]) {
    cells.filter(programIsSelected).append("rect").attr("class","program-selection-outline")
      .attr("x",(r)=>r.box.x0+1.5).attr("y",(r)=>r.box.y0+1.5)
      .attr("width",(r)=>Math.max(0,r.box.x1-r.box.x0-3)).attr("height",(r)=>Math.max(0,r.box.y1-r.box.y0-3))
      .attr("rx",2).attr("fill","none").attr("stroke",stroke).attr("stroke-width",width).attr("pointer-events","none");
  }
  cells.append("rect").attr("class","program-focus-outline")
    .attr("x",(r)=>r.box.x0+2).attr("y",(r)=>r.box.y0+2)
    .attr("width",(r)=>Math.max(0,r.box.x1-r.box.x0-4)).attr("height",(r)=>Math.max(0,r.box.y1-r.box.y0-4))
    .attr("rx",2).attr("fill","none").attr("pointer-events","none");
  cells.each(function(r){
    const width=r.box.x1-r.box.x0,height=r.box.y1-r.box.y0;
    if(width<50||height<27)return;
    const tileColor=programTileColor(r);
    const fill=tileColor.startsWith('url')?COLORS.ink:readableColor(tileColor);
    const max=Math.max(4,Math.floor((width-10)/5.4));
    const text=d3.select(this).append("text").attr("x",r.box.x0+6).attr("y",r.box.y0+14).attr("fill",fill).attr("font-size",10).attr("pointer-events","none");
    text.append("tspan").text(r.short.length>max?r.short.slice(0,max-1)+'…':r.short);
    if(height>=40)text.append("tspan").attr("x",r.box.x0+6).attr("dy",14).text(width<80?d3.format('.3~s')(r.count):`${d3.format('.3~s')(r.count)} · ${(100*r.share).toFixed(1)}%`);
    if(school.school&&height>=57&&width>75)text.append("tspan").attr("x",r.box.x0+6).attr("dy",14).text(hasNumber(r.values[1])?`${currency(r.values[1])} median`:r.status==='suppressed'?'Income suppressed':'Income unavailable');
  });
}
function drawProgramIntervals({svg,w,h}, rows, school) {
  const m={l:Math.min(155,w*.25),r:80,t:20,b:25};
  const maximum=d3.max(rows,(r)=>r.values[2])||100000;
  const x=d3.scaleLinear().domain([0,Math.max(100000,Math.ceil(maximum/50000)*50000)]).range([m.l,w-m.r]);
  const visible=rows.slice(programState.page*6,(programState.page+1)*6);
  const y=d3.scaleBand().domain(visible.map((r)=>r.code)).range([m.t,h-m.b]).padding(.18);
  svg.append("g").attr("class","grid").attr("transform",`translate(0,${h-m.b})`).call(d3.axisBottom(x).ticks(4).tickSize(-(h-m.b-m.t)).tickFormat(""));
  const groups=svg.selectAll(".program-interval").data(visible).join("g").attr("class","program-interval");bindProgramEvents(groups,school);
  groups.append("rect").attr("x",3).attr("y",(r)=>y(r.code)).attr("width",w-6).attr("height",y.bandwidth()).attr("rx",3)
    .attr("fill",(r)=>programIsSelected(r)?COLORS.selectedFill:'transparent');
  groups.append("text").attr("x",m.l-9).attr("y",(r)=>y(r.code)+y.bandwidth()/2+3).attr("text-anchor","end").attr("class","program-row-label")
    .text((r)=>{const max=Math.floor((m.l-14)/5.4);return r.short.length>max?r.short.slice(0,max-1)+'…':r.short;});
  groups.append("text").attr("x",w-7).attr("y",(r)=>y(r.code)+y.bandwidth()/2+3).attr("text-anchor","end").attr("class","program-row-label").text((r)=>`${r.count} (${(r.share*100).toFixed(1)}%)`);
  groups.each(function(r){
    const g=d3.select(this),cy=y(r.code)+y.bandwidth()/2;
    if(r.values.every(hasNumber)){
      g.append("line").attr("x1",x(r.values[0])).attr("x2",x(r.values[2])).attr("y1",cy).attr("y2",cy).attr("stroke","#519681").attr("stroke-width",4);
      g.append("circle").attr("cx",x(r.values[1])).attr("cy",cy).attr("r",4).attr("fill","#185b46");
    }else g.append("text").attr("x",m.l+6).attr("y",cy+3).attr("class","program-row-label").attr("fill",COLORS.secondary).text(r.status==='suppressed'?'Income suppressed':'Income unavailable');
  });
  svg.append("g").attr("class","axis").attr("transform",`translate(0,${h-m.b})`).call(d3.axisBottom(x).ticks(4).tickFormat(shortDollar));
  svg.append("text").attr("class","axis-label").attr("x",m.l).attr("y",10).text(`${cohortLabel(state.pseoSnapshot)} · ${META.pseoDollarYear} USD`);
  svg.append("text").attr("class","axis-label").attr("x",w-7).attr("y",10).attr("text-anchor","end").text("Awards / share");
}
getElement("program-school").addEventListener("change",(event)=>{if(event.target.value)openSchool(event.target.value);else{resetSelection();requestRender();}});
getElement("program-grain").addEventListener("change",(event)=>{programState.grain=event.target.value;programState.fine=null;programState.page=0;hideTooltip();requestRender();});
getElement("program-view").addEventListener("change",(event)=>{programState.view=event.target.value;
  if(programState.view==='income'){const index=programScopeRows(programState.scope).findIndex(programIsSelected);programState.page=index<0?0:Math.floor(index/6);}
  hideTooltip();requestRender();});
getElement("program-item").addEventListener("change",(event)=>{if(event.target.value!=='linked')chooseSchoolProgram(event.target.value);});
getElement("program-prev").addEventListener("click",()=>{programState.page--;requestRender();});
getElement("program-next").addEventListener("click",()=>{programState.page++;requestRender();});
getElement("reset").addEventListener("click",()=>{Object.assign(programState,{view:'mix',grain:'2',fine:null,page:0});});
// No geographic/institution selection: begin with the full dataset scope.
render();
