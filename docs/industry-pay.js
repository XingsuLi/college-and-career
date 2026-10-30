/* School/program destinations determine WHICH national industries to compare
 * and HOW WIDE their lines are. They never reweight or relabel national pay.
 */
"use strict";
const DESTINATIONS = window.INDUSTRY_DESTINATIONS;
const industryPayState = { mode:"pay-growth", focus:null };
const QUARTERLY = window.QUARTERLY_PAY;
// Compare wages and CPI only over their shared published period.
const PAY_COMPARISON_END = [QUARTERLY.latest, QUARTERLY.cpiLatest].sort()[0];
const WIDTH_PER_SHARE = 18; // Fixed scale: 10% -> 1.8px, 20% -> 3.6px, 40% -> 7.2px.
const signedPercent = (value) => d3.format('+.1f')(value)+'%';
function selectedIndustryComposition() {
  const scope=programState.scope,school=scope?.school||null;
  const families=programFamilies(),counts=new Map();let contributors=0;
  for(const id of scope?.ids||[]){
    const fields=DESTINATIONS.institutions[id]?.[state.pseoSnapshot]||{};let contributes=false;
    for(const [cip,rows] of Object.entries(fields)){
      if(families.length&&!families.includes(cip))continue;
      for(const [industry,n] of rows){counts.set(industry,(counts.get(industry)||0)+n);if(n>0)contributes=true;}
    }
    if(contributes)contributors++;
  }
  const total=d3.sum([...counts.values()]);
  const ranked=[...counts].map(([code,count])=>({code,count,share:count/total,
    label:QUARTERLY.labels[code] || PSEO.labels.industries[code] || industryNames[code] || code,
    short:industryNames[code] || code,available:!!QUARTERLY.series[code]}))
    .sort((a,b)=>b.count-a.count || a.code.localeCompare(b.code));
  return {school,scope,contributors,families,total,ranked,top:ranked.slice(0,5)};
}
// Nominal wage growth and CPI use the same quarter one year earlier.
function industryPayValue(code,year,quarter) {
  const rows=QUARTERLY.series[code]||[];
  const pay=rows.find((r)=>r[0]===year&&r[1]===quarter)?.[2];
  const previous=rows.find((r)=>r[0]===year-1&&r[1]===quarter)?.[2];
  return hasNumber(pay)&&hasNumber(previous)&&previous>0?100*(pay/previous-1):null;
}
function payPoints(code) {
  const [firstYear,firstQuarter]=QUARTERLY.firstDisplay.split('-Q').map(Number);
  return (QUARTERLY.series[code]||[])
    .filter(([year,q])=>year*4+q>=firstYear*4+firstQuarter&&`${year}-Q${q}`<=PAY_COMPARISON_END)
    .map(([year,q])=>({x:year+(q-1)/4,label:`${year} Q${q}`,year,q,
      value:industryPayValue(code,year,q)}));
}
function cpiPoints() {
  return Object.keys(QUARTERLY.cpi).sort()
    .filter((key)=>key>=QUARTERLY.firstDisplay&&key<=PAY_COMPARISON_END)
    .map((key)=>{
      const [year,q]=key.split('-Q').map(Number);
      const now=QUARTERLY.cpi[key],previous=QUARTERLY.cpi[`${year-1}-Q${q}`];
      return {year,q,x:year+(q-1)/4,label:`${year} Q${q}`,
        value:hasNumber(now)&&hasNumber(previous)&&previous>0?100*(now/previous-1):null};
    });
}
function renderIndustryPay() {
  const composition=selectedIndustryComposition();
  const hasWages=composition.top.some((row)=>row.available);
  // Keep both view choices visible; unavailable pay data disables its button.
  if(composition.scope?.ids.length&&!hasWages)industryPayState.mode='hiring';
  getElement('industry-pay-mode').querySelectorAll('[data-market-mode]').forEach((button)=>{
    const active=button.dataset.marketMode===industryPayState.mode;
    button.disabled=button.dataset.marketMode==='pay-growth'&&!hasWages;
    button.classList.toggle('active',active);
    button.setAttribute('aria-pressed',String(active));
    button.title=button.disabled?'No published industry destinations':'';
  });
  if (industryPayState.mode === 'hiring') { renderHiringDemand(); return; }
  window.hiringAudit = null;
  window.hiringHoverAudit = null;
  getElement('industry-pay-title').textContent = 'Industry pay benchmarks';
  getElement('industry-pay-svg').setAttribute('aria-label', 'National industry pay; line width proportional to historical graduate destination share');
  document.querySelector('.cohort-control > span').textContent = 'Graduates';
  getElement('pseo-snapshot').title = 'Graduates and years after graduation for program income and employment shares';
  getElement('pseo-snapshot').setAttribute('aria-label', 'Sets graduate cohort for program income and employment weights');
  const {school,scope,contributors,families,total,ranked,top}=composition;
  if(!top.some((row)=>row.code===industryPayState.focus))industryPayState.focus=null;
  getElement('pseo-snapshot').value=state.pseoSnapshot;
  const familyLabel=families.length===1?(fieldNames[families[0]]||families[0]):families.length?`${families.length} fields`:'All bachelor’s fields';
  const scopeLabel=scope?.kind==='national'?'U.S.':scope?.kind==='selection'?'Selected schools':scope?.name;
  const shortField=families.length===0?'All fields':familyLabel;
  getElement('industry-pay-scope').textContent=scope?.ids.length?`${school?'':scopeLabel+' · '}${shortField}${programState.fine?' (broader flow field)':''}`:'No schools in this scope';
  getElement('industry-pay-scope').title=scope?`${scope.name} · ${familyLabel} · ${cohortLabel(state.pseoSnapshot)}`:'';
  getElement('industry-coverage-line').textContent=`PSEO: ${numberFormat.format(contributors)} of ${numberFormat.format(scope?.ids.length||0)} schools · ${numberFormat.format(total)} published employment counts`;
  const available=top.filter((row)=>row.available),covered=d3.sum(available,(row)=>row.share),topShare=d3.sum(top,(row)=>row.share);
  const legend=d3.select('#industry-pay-legend').selectAll('button').data(top,(row)=>row.code).join('button')
    .attr('class','industry-legend-item').attr('data-code',(row)=>row.code)
    .attr('disabled',(row)=>!row.available||null)
    .attr('aria-pressed',(row)=>String(industryPayState.focus===row.code))
    .attr('title',(row)=>`${row.label} · Share: ${row.count}/${total} · ${(100*row.share).toFixed(1)}%${row.available?'':' · Pay: N/A'}`)
    .html((row)=>`<span>${escapeHtml(row.short)}${row.available?'':' · N/A'}</span><b><i style="border-top:${WIDTH_PER_SHARE*row.share}px solid ${row.available?industryColor(row.code):'#b6bcb8'}"></i>${(100*row.share).toFixed(1)}%</b>`)
    .on('click',(_,row)=>{industryPayState.focus=industryPayState.focus===row.code?null:row.code;hideTooltip();requestRender();});
  const reason=!scope?.ids.length?'No schools in this scope':!total?'No published employment destinations':!available.length?'No wage series for these employment sectors':null;
  getElement('industry-pay-empty').hidden=!reason;
  getElement('industry-pay-empty-title').textContent=reason||'';
  getElement('industry-pay-empty-note').textContent=!scope?.ids.length?'Broaden the state, institution or scatter filters.':!total?'Try another graduation cohort or field. No national proxy is substituted for missing graduate destinations.':'Destination shares remain visible; public administration is outside this private-sector wage dataset.';
  const chart=createChart('industry-pay-svg');
  if(!reason)drawIndustryPay(chart,available,composition);
  window.industryPayAudit={school,scope:scope?{kind:scope.kind,name:scope.name,ids:[...scope.ids]}:null,contributors,families:[...families],fineProgram:programState.fine,snapshot:state.pseoSnapshot,
    mode:industryPayState.mode,focus:industryPayState.focus,total,ranked,top,topShare,plottedShare:covered,
    widthScale:WIDTH_PER_SHARE,regionScope:'All work regions',wagePopulation:'National covered private-sector jobs',
    frequency:'quarterly',metric:'growth',
    reference:{label:'CPI inflation',values:cpiPoints().map((p)=>[p.label,p.value])},
    values:Object.fromEntries(available.map((row)=>[row.code,payPoints(row.code).map((p)=>[p.label,p.value])])),reason};
}
function drawIndustryPay({svg,w,h},industries,composition) {
  const m={l:49,r:24,t:20,b:32};
  const series=industries.map((row)=>({...row,points:payPoints(row.code)}));
  const cpi={code:'cpi',label:'CPI inflation',reference:true,share:null,points:cpiPoints()};
  series.push(cpi);
  const stroke=(row)=>row.reference?COLORS.reference:industryColor(row.code);
  const width=(row)=>row.reference?1.8:WIDTH_PER_SHARE*row.share;
  const values=series.flatMap((s)=>s.points.map((p)=>p.value)).filter(hasNumber);
  const dataExtent=d3.extent(series.flatMap((s)=>s.points),(p)=>p.x);
  const dataEnd=dataExtent[1];
  const wageEnd=d3.max(series.filter((row)=>!row.reference).flatMap((row)=>row.points),(p)=>p.x);
  const x=d3.scaleLinear().domain([dataExtent[0],dataEnd]).range([m.l,w-m.r]);
  for(const row of series){
    const valid=row.points.filter((p)=>hasNumber(p.value));
    const last=valid.at(-1),previous=valid.at(-2);
    row.tail=!row.reference&&last?.x===wageEnd&&previous
      ? {from:previous,to:last,missing:row.points.filter((p)=>p.x>previous.x&&p.x<last.x&&!hasNumber(p.value)).map((p)=>p.label)} : null;
  }
  const lo=Math.min(0,d3.min(values)),hi=Math.max(0,d3.max(values));
  const padding=Math.max(.25,(hi-lo)*.08);
  const y=d3.scaleLinear().domain([lo-padding,hi+padding]).range([h-m.b,m.t]);
  svg.append('g').attr('class','grid').attr('transform',`translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(h<160?3:4).tickSize(-(w-m.l-m.r)).tickFormat(''));
  svg.append('line').attr('class','pay-zero-baseline')
    .attr('x1',m.l).attr('x2',w-m.r).attr('y1',y(0)).attr('y2',y(0))
    .attr('stroke','#c3ccc5').attr('stroke-dasharray','2 4').attr('stroke-width',1);
  const line=d3.line().defined((p)=>hasNumber(p.value)).x((p)=>x(p.x)).y((p)=>y(p.value));
  // Connect observed CPI quarters directly; absent quarters get no point.
  const plottedPoints=(row)=>row.reference?row.points.filter((p)=>hasNumber(p.value)):row.points;
  const opacity=(row)=>row.reference||!industryPayState.focus||row.code===industryPayState.focus?1:.17;
  // Largest shares paint last. Highlighting changes opacity, NEVER line width.
  series.sort((a,b)=>(a.share||0)-(b.share||0));
  const groups=svg.selectAll('.destination-pay-series').data(series).join('g')
    .attr('class','destination-pay-series').attr('data-code',(row)=>row.code).attr('data-share',(row)=>row.share)
    .attr('opacity',opacity);
  groups.append('path').attr('class','weighted-pay-line').attr('d',(row)=>line(row.tail?row.points.filter((p)=>p.x<row.tail.to.x):plottedPoints(row))).attr('fill','none')
    .attr('stroke',stroke)
    .attr('stroke-width',width)
    .attr('stroke-dasharray',(row)=>row.reference?'6 3':null)
    .attr('stroke-linejoin','round').attr('stroke-linecap','round');
  groups.filter((row)=>row.tail).append('path').attr('class','pay-tail-bridge')
    .attr('d',(row)=>line([row.tail.from,row.tail.to])).attr('fill','none')
    .attr('stroke',stroke)
    .attr('stroke-width',width)
    .attr('stroke-dasharray','5 4').attr('stroke-linecap','round').attr('pointer-events','none')
    .append('title').text((row)=>`${row.tail.from.label} to ${row.tail.to.label}: visual guide only.${row.tail.missing.length?' Missing: '+row.tail.missing.join(', ')+'. No value is imputed.':' Latest-quarter pay is preliminary.'}`);
  groups.each(function(row){
    d3.select(this).selectAll('circle').data(row.points.filter((p)=>hasNumber(p.value))).join('circle')
      .attr('data-period',(p)=>p.label).attr('cx',(p)=>x(p.x)).attr('cy',(p)=>y(p.value)).attr('r',row.reference?2.3:Math.min(2,WIDTH_PER_SHARE*row.share/2))
      .attr('fill',stroke(row));
  });
  // Retain keyboard-focusable paths. One geometry-based pointer surface below
  // handles mouse interaction for paths, actual dots and dashed tail guides.
  groups.append('path').attr('class','industry-pay-hit').attr('d',(row)=>line(plottedPoints(row)))
    .attr('fill','none').attr('stroke','transparent').attr('stroke-width',10).attr('pointer-events','none').attr('tabindex',0).attr('role',(row)=>row.reference?'img':'button')
    .attr('aria-label',(row)=>`${row.label}${row.reference?'':`; ${(100*row.share).toFixed(1)} percent employment share`}. Latest ${row.points.filter((p)=>hasNumber(p.value)).at(-1)?.label}: ${signedPercent(row.points.filter((p)=>hasNumber(p.value)).at(-1)?.value)}.`)
    .on('click',(_,row)=>{if(!row.reference){industryPayState.focus=industryPayState.focus===row.code?null:row.code;requestRender();}})
    .on('keydown',(event,row)=>{if(!row.reference&&(event.key==='Enter'||event.key===' ')){event.preventDefault();industryPayState.focus=industryPayState.focus===row.code?null:row.code;requestRender();}});
  // Two tiers keep every quarter readable without repeating the year 13 times.
  const timeTicks=d3.range(Math.round(dataExtent[0]*4),Math.round(dataEnd*4)+1).map((q)=>q/4);
  svg.append('g').attr('class','axis quarterly-time-axis').attr('transform',`translate(0,${h-m.b})`)
    .call(d3.axisBottom(x).tickValues(timeTicks).tickFormat((v)=>`Q${Math.round((v-Math.floor(v))*4)+1}`));
  for(const year of d3.range(Math.floor(dataExtent[0]),Math.floor(dataEnd)+1)){
    const first=Math.max(year,dataExtent[0]),last=Math.min(year+.75,dataEnd);
    svg.append('text').attr('class','axis-label quarter-year-label')
      .attr('x',x((first+last)/2)).attr('y',h-5).attr('text-anchor','middle').text(year);
  }
  svg.append('g').attr('class','axis').attr('transform',`translate(${m.l},0)`)
    .call(d3.axisLeft(y).ticks(h<160?3:4).tickFormat((v)=>v+'%'));
  svg.append('text').attr('class','axis-label').attr('x',m.l).attr('y',11)
    .text('Pay growth · YoY');
  // Reference legend is separate from the five employment-share legend entries.
  const key=svg.append('g').attr('class','cpi-reference-key');
  const label=key.append('text').attr('class','axis-label').attr('x',w-m.r).attr('y',11)
    .attr('text-anchor','end').text('CPI inflation');
  const keyX=w-m.r-label.node().getComputedTextLength();
  key.append('line').attr('x1',keyX-26).attr('x2',keyX-6).attr('y1',7).attr('y2',7)
    .attr('stroke',COLORS.reference).attr('stroke-width',1.8).attr('stroke-dasharray','6 3');
  attachIndustryPointer(svg,groups,series,x,y,m,w,h,composition,opacity);
  window.industryPayInteractionAudit={xDomain:x.domain(),lastWageX:wageEnd,lastCPIX:d3.max(cpi.points,(p)=>p.x),lastDataX:dataEnd,lastDataPixel:x(dataEnd),plotRight:w-m.r,yDomain:y.domain(),observedValueExtent:d3.extent(values),rightPaddingPixels:w-m.r-x(dataEnd),bridges:series.filter((row)=>row.tail).map((row)=>({code:row.code,from:row.tail.from.label,to:row.tail.to.label,missing:row.tail.missing}))};
}
// Distance to a straight segment, in screen pixels (not data units).
function paySegmentDistance(px,py,ax,ay,bx,by) {
  const dx=bx-ax,dy=by-ay,length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/length)):0;
  return Math.hypot(px-(ax+t*dx),py-(ay+t*dy));
}
function attachIndustryPointer(svg,groups,series,x,y,m,w,h,composition,opacity) {
  window.industryHoverAudit=null;
  const candidates=[];
  for(const row of series){
    const valid=row.points.filter((p)=>hasNumber(p.value));
    for(const point of valid)candidates.push({row,point,kind:'point'});
    const segments=row.reference?valid:row.points;
    for(let i=1;i<segments.length;i++){
      const from=segments[i-1],to=segments[i];
      if(hasNumber(from.value)&&hasNumber(to.value)&&(!row.tail||to!==row.tail.to))
        candidates.push({row,from,to,kind:'segment'});
    }
    if(row.tail)candidates.push({row,from:row.tail.from,to:row.tail.to,kind:'tail'});
  }
  const cursor=svg.append('g').attr('class','industry-hover-markers').attr('pointer-events','none');
  let current=null,lastCode=null;
  function nearest(event) {
    const [px,py]=d3.pointer(event,svg.node());
    let best=null,bestDistance=14;
    for(const candidate of candidates){
      const distance=candidate.kind==='point'
        ?Math.hypot(px-x(candidate.point.x),py-y(candidate.point.value))
        :paySegmentDistance(px,py,x(candidate.from.x),y(candidate.from.value),x(candidate.to.x),y(candidate.to.value));
      const tie=best&&Math.abs(distance-bestDistance)<.2;
      const preferred=tie&&candidate.row.code===(industryPayState.focus||lastCode)&&best.row.code!==candidate.row.code;
      if(distance<bestDistance-.2||preferred){best=candidate;bestDistance=distance;}
    }
    if(!best)return null;
    // Near an observed dot, report the observation rather than its connecting guide.
    const points=best.row.points.filter((p)=>hasNumber(p.value));
    const point=points.reduce((a,b)=>Math.hypot(px-x(a.x),py-y(a.value))<=Math.hypot(px-x(b.x),py-y(b.value))?a:b);
    if(Math.hypot(px-x(point.x),py-y(point.value))<=9)best={row:best.row,point,kind:'point'};
    else if(best.kind!=='point')best={...best,point:Math.abs(px-x(best.from.x))<=Math.abs(px-x(best.to.x))?best.from:best.to};
    return {...best,distance:bestDistance};
  }
  function clear() {
    current=null;cursor.selectAll('*').remove();groups.attr('opacity',opacity);hideTooltip();
    window.industryHoverAudit=null;
  }
  function inspect(event) {
    current=nearest(event);
    if(!current){clear();return;}
    const {row,point,kind}=current;
    lastCode=row.code;
    const format=(p)=>signedPercent(p.value);
    const guide=kind==='tail';
    const detail=(guide?[row.tail.from,row.tail.to]:[point]).map((p)=>tooltipRow(p.label,format(p))).join('');
    const gap=guide&&row.tail.missing.length?tooltipRow('Missing',escapeHtml(row.tail.missing.join(', '))):'';
    groups.attr('opacity',(other)=>other.reference||other.code===row.code?1:.15);
    cursor.selectAll('circle').data(guide?[row.tail.from,row.tail.to]:[point]).join('circle')
      .attr('cx',(p)=>x(p.x)).attr('cy',(p)=>y(p.value)).attr('r',4.5)
      .attr('fill','white').attr('stroke',row.reference?COLORS.reference:industryColor(row.code)).attr('stroke-width',2);
    const share=row.reference?'':tooltipRow('Share',`${numberFormat.format(row.count)}/${numberFormat.format(composition.total)} · ${(100*row.share).toFixed(1)}%`);
    showTooltip(event,`<strong>${escapeHtml(row.label)}</strong>${detail}${share}${gap}`);
    window.industryHoverAudit={code:row.code,kind,period:guide?null:point.label,shownPeriods:guide?[row.tail.from.label,row.tail.to.label]:[point.label],missingPeriods:guide?row.tail.missing:[],distancePixels:current.distance};
  }
  svg.append('rect').attr('class','industry-pay-pointer-surface')
    .attr('x',m.l).attr('y',m.t).attr('width',w-m.l-m.r).attr('height',h-m.t-m.b)
    .attr('fill','transparent').attr('pointer-events','all')
    .on('pointermove',function(event){inspect(event);d3.select(this).style('cursor',current&&!current.row.reference?'pointer':'default');})
    .on('pointerleave',clear)
    .on('click',(event)=>{
      const chosen=nearest(event);
      if(chosen&&!chosen.row.reference){
        industryPayState.focus=industryPayState.focus===chosen.row.code?null:chosen.row.code;
        clear();requestRender();
      }
    });
}
getElement('industry-pay-mode').addEventListener('click',(event)=>{
  const button=event.target.closest('[data-market-mode]');
  if(!button||button.disabled)return;
  industryPayState.mode=button.dataset.marketMode;
  hideTooltip();requestRender();
});
getElement('reset').addEventListener('click',()=>{industryPayState.mode='pay-growth';industryPayState.focus=null;});
