/* Shared interaction rules. Origin scope and destination highlighting are separate. */
"use strict";
function schoolSearchLabel(school) { return `${school.name} — ${school.city}, ${school.state}`; }
// Latest broadly covered snapshot for each representative graduate horizon.
const GRADUATE_SNAPSHOTS = ["2019:1", "2016:5", "2010:10"];
function cohortLabel(snapshot, expanded=false) {
  const [cohort,year]=snapshot.split(':');
  const period=`${cohort}–${String(Number(cohort)+2).slice(-2)}`;
  return expanded?`${period} graduates · ${year} year${year==='1'?'':'s'} later`:`${period} grads · ${year}y after`;
}
function normalizeProgramSelection(schools) {
  const families=new Set(),fine=new Set();
  for(const school of schools)for(const [cip] of PROGRAMS.awards[school.id]?.programs||[]){families.add(cip.slice(0,2));fine.add(cip.slice(0,5));}
  if(state.pseoField!=='all' && !families.has(state.pseoField)) {
    state.pseoField='all';programState.fine=null;
    toast('That field has no current awards in this scope; showing all fields.');
  }
  if(programState.fine&&!fine.has(programState.fine)){programState.fine=null;toast('That detailed program has no awards here; showing its broad field.');}
}
function renderScopeTrail(schools) {
  const school=state.scatter?.size===1&&schools.length===1?schools[0]:null;
  const origin=state.region!=='all'?state.region:school?.state;
  const parts=['<button id="scope-us" type="button">United States</button>'];
  if(origin)parts.push(`<span>›</span><button id="scope-state" type="button">${escapeHtml(stateNames[origin]||origin)}</button>`);
  if(school)parts.push(`<span>›</span><span class="scope-current" title="${escapeHtml(schoolSearchLabel(school))}">${escapeHtml(school.name)}</span>`);
  else if(state.scatter!==null)parts.push(`<span>›</span><span>${schools.length} selected schools</span>`);
  if(state.pseoField!=='all')parts.push(`<button id="scope-field" class="scope-field" title="Clear program selection">${escapeHtml(programState.fine?EARNINGS.labels.fine[programState.fine]||programState.fine:fieldNames[state.pseoField]||state.pseoField)} ×</button>`);
  if(mapFocus.division)parts.push(`<button id="scope-destination" title="Clear destination highlight">Map: ${escapeHtml(divisionNames[mapFocus.division])} ×</button>`);
  getElement('scope-trail').innerHTML=parts.join('');
  getElement('selection-description').textContent=getElement('scope-trail').textContent;
  getElement('scope-us').onclick=()=>{state.region='all';resetSelection();requestRender();};
  if(origin)getElement('scope-state').onclick=()=>{state.region=origin;resetSelection();requestRender();};
  if(getElement('scope-field'))getElement('scope-field').onclick=()=>{state.pseoField='all';programState.fine=null;requestRender();};
  if(getElement('scope-destination'))getElement('scope-destination').onclick=()=>{mapFocus.division=null;requestRender();};
}
let keyboardInteraction=false;
document.addEventListener('pointerdown',()=>{keyboardInteraction=false;});
document.addEventListener('keydown',(event)=>{
  keyboardInteraction=true;
  if(event.key==='Escape') {
    if(!getElement('tooltip').hidden){const owner=document.querySelector('[aria-controls="tooltip"][aria-expanded="true"]');hideTooltip();owner?.focus();return;}
    if(document.activeElement.matches('input,select'))return;
    if(mapFocus.division)mapFocus.division=null;
    else if(state.pseoField!=='all'){state.pseoField='all';programState.fine=null;}
    else if(state.scatter!==null)resetSelection();
    else if(state.region!=='all'){state.region='all';resetSelection();}
    requestRender();
  }
});
function captureChartFocus() {
  if(!keyboardInteraction)return null;
  const el=document.activeElement;if(!el||el===document.body)return null;
  if(el.id)return '#'+CSS.escape(el.id);
  for(const attr of ['data-state','data-division'])if(el.hasAttribute(attr))return `#map-svg [${attr}="${CSS.escape(el.getAttribute(attr))}"]`;
  for(const cls of ['program-tile','program-interval','industry-legend-item'])
    if(el.classList.contains(cls))return `.${cls}[data-code="${CSS.escape(el.dataset.code)}"]`;
  const series=el.closest('.destination-pay-series');
  return series?`.destination-pay-series[data-code="${CSS.escape(series.dataset.code)}"] .industry-pay-hit`:null;
}
function restoreChartFocus(selector) {
  if(selector&&document.activeElement===document.body)(document.querySelector(selector)||getElement('program-item'))?.focus({preventScroll:true});
}
// Focused SVG controls expose their accessible label without requiring a mouse.
document.addEventListener('focusin',(event)=>{
  const el=event.target;
  if(keyboardInteraction&&el.closest('svg')&&el.getAttribute('aria-label')){
    const r=el.getBoundingClientRect();showTooltip({clientX:r.x,clientY:r.bottom},escapeHtml(el.getAttribute('aria-label')));
    el.setAttribute('aria-describedby','tooltip');
  }
});
document.addEventListener('focusout',(event)=>{if(event.target.closest?.('svg')){event.target.removeAttribute('aria-describedby');hideTooltip();}});
