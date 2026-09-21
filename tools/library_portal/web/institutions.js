/* Institution directory and detail pages. Keyword-based document filters stay in the browse page. */
let institutionRegistry;
const ORG_HIERARCHY = new Set(['internal','subordinate','direct']);
const ORG_STATUS = {current:'现行机构',historical:'历史机构',abolished:'已撤销',conditional:'条件性机制',planned:'拟设',unknown:'状态不明'};
const ORG_RELATION = {management:['主管机关','主管单位'],internal:['内设于','内设单位'],subordinate:['隶属／由其管理','所属单位'],direct:['直属于','直属单位'],dual:['双重领导／业务指导','双重领导／业务指导'],oversight:['监督对象','监督来源'],appointment:['任命关系','任命关系'],authorization:['授权对象','授权来源'],cooperation:['协作','协作'],business:['业务联系','业务联系'],history:['历史沿革','历史沿革'],accountability:['负责对象','向本机关负责'],joint:['联合组成','联合机制'],appeal:['上诉审级','下级审级']};
const ORG_SCOPES = [['current','现行机构'],['other','历史、撤销与条件性机制'],['facilities','具名设施'],['all','全部条目']];
let orgIndex = null;
const orgMap = () => orgIndex && orgIndex.source === institutionRegistry ? orgIndex.map : (orgIndex = {source:institutionRegistry, map:new Map(institutionRegistry.institutions.map(r=>[r.id,r]))}).map;
function orgMatches(r,q){return [r.name,...r.aliases].some(n=>n.toLocaleLowerCase().includes(q.trim().toLocaleLowerCase()));}
function orgInScope(r,status){return status==='all'||(status==='facilities'?r.kind==='设施':r.kind!=='设施'&&(status==='other'?r.status!=='current':r.status===status));}
function orgDirectoryUrl(params={}){return '#/institutions'+(Object.keys(params).length?'?'+new URLSearchParams(params):'');}
function orgReturn(value){return /^#\/institutions(?:\?|$)/.test(value||'')?value:'#/institutions';}
function orgHref(r){return '#/institution/'+r.id;}
function orgParent(r){return r.relations.find(e=>ORG_HIERARCHY.has(e.type));}
function orgContext(r){const p=orgParent(r);return p?orgMap().get(p.target)?.name:'';}
function orgStatusBadge(r){return r.kind!=='设施'&&r.status!=='current'?`<span class="org-status">${esc(ORG_STATUS[r.status])}</span>`:'';}

/* Navigation memory: the browser's own back button is the way back. We only
   remember where the reader was on each page, so returning lands in place. */
const orgNav = {stack:[], clickedAt:0, returning:true, saved:{}};
function orgPersist(){try{sessionStorage.setItem('org-scroll',JSON.stringify(orgNav.saved));}catch{}}
function orgRemember(){
  if(!main.querySelector('.org-directory,.org-detail'))return;
  orgNav.saved[location.hash]={y:scrollY,open:[...main.querySelectorAll('.org-branch[open]')].map(n=>n.dataset.branch)};
  orgPersist();
}
function orgTrackNavigation(){
  orgNav.stack=[location.hash||'#/home'];
  try{orgNav.saved=JSON.parse(sessionStorage.getItem('org-scroll')||'{}')||{};}catch{}
  document.addEventListener('click',e=>{
    const a=e.target.closest&&e.target.closest('a[href^="#"]');
    if(!a||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    orgNav.clickedAt=performance.now();orgRemember();
  },true);
  document.addEventListener('click',e=>{
    const back=e.target.closest&&e.target.closest('[data-org-back]');
    if(!back||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey||orgNav.stack.length<2)return;
    e.preventDefault();orgNav.clickedAt=0;history.back();
  });
  window.addEventListener('hashchange',()=>{
    const s=orgNav.stack, clicked=performance.now()-orgNav.clickedAt<800;
    if(!clicked&&s.length>1&&s[s.length-2]===location.hash){s.pop();orgNav.returning=true;}
    else{s.push(location.hash);orgNav.returning=false;}
    orgNav.clickedAt=0;
  });
}
if(typeof window!=='undefined'&&typeof document!=='undefined')orgTrackNavigation();
function orgRestore(fallback){
  const saved=orgNav.returning?orgNav.saved[location.hash]:null;
  for(const id of saved?.open||[]){const d=main.querySelector(`.org-branch[data-branch="${CSS.escape(id)}"]`);if(d)d.open=true;}
  const apply=()=>{if(saved)window.scrollTo(0,saved.y);else if(fallback)fallback();else window.scrollTo(0,0);};
  (document.fonts?.ready||Promise.resolve()).then(()=>setTimeout(apply,0));
}
function orgReplaceUrl(url){history.replaceState(null,'',url);if(orgNav.stack.length)orgNav.stack[orgNav.stack.length-1]=location.hash;}

const ORG_KIND_LABEL={'组成部门':'组成部门（部委）','专项局':'部委管理的专项局'};
/* Only the executive council's list follows its charter's sections (部委、直属机构…); other lists stay flat. */
function orgByKind(rows){if(!rows.some(r=>r.kind==='组成部门'))return [['',rows]];const g=new Map();for(const r of rows){if(!g.has(r.kind))g.set(r.kind,[]);g.get(r.kind).push(r);}return [...g];}
/* Sub-units shown under a root: its direct units plus the special bureaus its departments manage. */
function orgUnits(r,kids){const list=kids.get(r.id)||[];return list.some(c=>c.kind==='组成部门')?[...list,...list.flatMap(c=>(kids.get(c.id)||[]).filter(g=>g.kind==='专项局'))]:list;}
function orgRow(r,kids){
  const units=orgUnits(r,kids), groups=orgByKind(units);
  const sub=rows=>`<ul class="org-sublist">${rows.map(k=>`<li><a href="${esc(orgHref(k))}">${esc(k.name)}</a></li>`).join('')}</ul>`;
  const body=groups.length>1?`<div class="org-kinds">${groups.map(([kind,rows])=>`<details class="org-branch" data-branch="${r.id}:${esc(kind)}"><summary>${esc(ORG_KIND_LABEL[kind]||kind)} <span>${rows.length}</span></summary>${sub(rows)}</details>`).join('')}</div>`
    :units.length?`<details class="org-branch" data-branch="${r.id}"><summary>下设 ${units.length} 个单位</summary>${sub(units)}</details>`:'';
  return `<li class="org-entry${groups.length>1?' org-entry-wide':''}"><a href="${esc(orgHref(r))}" class="org-name">${esc(r.name)}</a>${orgStatusBadge(r)}<p>${esc(r.summary)}</p>${body}</li>`;
}
function orgMatchRow(r){
  const context=orgContext(r);
  return `<li class="org-entry"><a href="${esc(orgHref(r))}" class="org-name">${esc(r.name)}</a>${orgStatusBadge(r)}${context?`<small>${esc(context)}</small>`:''}<p>${esc(r.summary)}</p></li>`;
}

function institutionDirectory(params){
  document.title='机构总目 · 白塔档案馆';
  const state={q:params.get('q')||'',status:params.get('status')||'current',group:params.get('group')||''};
  if(!ORG_SCOPES.some(([id])=>id===state.status))state.status='current';
  if(!institutionRegistry.categories.some(c=>c.id===state.group))state.group='';
  main.innerHTML=`<div class="org-directory"><header class="org-heading"><h1>机构总目</h1><p>银色联盟的议会、行政、司法、军事与学术机关。点开机构名称，可查看职责、下设单位和依据条文。</p></header><form class="org-search" role="search"><label class="sr-only" for="org-query">查找机构</label><input id="org-query" type="search" autocomplete="off" placeholder="查找机构，如：白塔、反垄断局" value="${esc(state.q)}"><label class="sr-only" for="org-scope">显示范围</label><select id="org-scope">${ORG_SCOPES.map(([id,label])=>`<option value="${id}"${id===state.status?' selected':''}>${label}</option>`).join('')}</select></form><nav class="org-jumps" aria-label="机构分组"></nav><p id="org-result-count" class="org-count" role="status" aria-live="polite"></p><div id="org-results"></div></div>`;
  function params_(){const p={};if(state.q)p.q=state.q;if(state.status!=='current')p.status=state.status;return p;}
  function render(){
    const selected=institutionRegistry.institutions.filter(r=>orgInScope(r,state.status)&&orgMatches(r,state.q));
    main.querySelector('#org-result-count').textContent=state.q?`找到 ${selected.length} 个${state.status==='facilities'?'设施':'机构'}`:'';
    const kids=new Map();
    for(const r of selected){const p=orgParent(r);if(p){if(!kids.has(p.target))kids.set(p.target,[]);kids.get(p.target).push(r);}}
    const groups=institutionRegistry.categories.map(c=>[c,selected.filter(r=>r.category===c.id)]).filter(([,m])=>m.length);
    main.querySelector('.org-jumps').innerHTML=groups.map(([c])=>`<a href="${esc(orgDirectoryUrl({...params_(),group:c.id}))}" data-org-group="${c.id}">${esc(c.name)}</a>`).join('');
    main.querySelector('#org-results').innerHTML=groups.length?groups.map(([c,members])=>{
      let body;
      if(state.q)body=`<ul class="org-list">${members.map(orgMatchRow).join('')}</ul>`;
      else{
        const ids=new Set(members.map(r=>r.id));
        const roots=members.filter(r=>{const p=orgParent(r);return !p||!ids.has(p.target);});
        body=`<ul class="org-list">${roots.map(r=>orgRow(r,kids)).join('')}</ul>`;
      }
      return `<section class="org-group" id="org-group-${c.id}" aria-labelledby="org-title-${c.id}"><h2 id="org-title-${c.id}" tabindex="-1">${esc(c.name)}</h2>${body}</section>`;
    }).join(''):`<div class="empty"><h2>没有找到匹配的机构</h2><p>可以换用正式名称、简称或别名，或者把显示范围切换为“全部条目”。</p></div>`;
  }
  function sync(){state.group='';orgReplaceUrl(orgDirectoryUrl(params_()));render();}
  main.querySelector('.org-search').addEventListener('submit',e=>e.preventDefault());
  main.querySelector('#org-query').addEventListener('input',e=>{state.q=e.target.value;sync();});
  main.querySelector('#org-scope').addEventListener('change',e=>{state.status=e.target.value;sync();});
  main.querySelector('.org-directory').addEventListener('click',e=>{
    const jump=e.target.closest('[data-org-group]');
    if(!jump)return;
    e.preventDefault();state.group=jump.dataset.orgGroup;orgReplaceUrl(orgDirectoryUrl({...params_(),group:state.group}));
    document.getElementById('org-title-'+state.group)?.focus({preventScroll:true});
    document.getElementById('org-group-'+state.group)?.scrollIntoView({behavior:'smooth'});
  });
  render();
  orgRestore(state.group?()=>document.getElementById('org-group-'+state.group)?.scrollIntoView():null);
}


function institutionDetail(id){
  const mapped=institutionRegistry.legacy[decodeURIComponent(id)]||id;
  if(mapped.startsWith('category:')){location.hash=orgDirectoryUrl({group:mapped.slice(9)});return;}
  const map=orgMap(), r=map.get(mapped);
  if(!r)throw new Error('该机构未收入名录，请返回机构总目查找。');
  document.title=r.name+' · 机构总目 · 白塔档案馆';
  const chain=[];
  for(let p=orgParent(r),guard=0;p&&guard<8;guard++){const x=map.get(p.target);if(!x)break;chain.unshift(x);p=orgParent(x);}
  const incoming=institutionRegistry.institutions.flatMap(x=>x.relations.filter(e=>e.target===r.id).map(e=>({row:x,edge:e,incoming:true})));
  const outgoing=r.relations.map(e=>({row:map.get(e.target),edge:e,incoming:false})).filter(e=>e.row);
  const firstParent=orgParent(r);
  const children=incoming.filter(e=>ORG_HIERARCHY.has(e.edge.type)).map(e=>e.row);
  const others=[...outgoing.filter(e=>e.edge!==firstParent),...incoming.filter(e=>!ORG_HIERARCHY.has(e.edge.type))];
  const seen=new Set(), sources=r.sources.filter(s=>{const k=s.docId+':'+s.anchor;if(seen.has(k))return false;seen.add(k);return true;});
  const unitKids=new Map(institutionRegistry.institutions.map(x=>[x.id,[]]));
  for(const x of institutionRegistry.institutions){const p=orgParent(x);if(p&&unitKids.has(p.target))unitKids.get(p.target).push(x);}
  unitKids.set(r.id,children);
  const units=orgUnits(r,unitKids), unitGroups=orgByKind(units);
  const unitList=rows=>`<ul class="org-list">${rows.map(k=>`<li class="org-entry"><a href="${esc(orgHref(k))}" class="org-name">${esc(k.name)}</a>${orgStatusBadge(k)}<p>${esc(k.summary)}</p></li>`).join('')}</ul>`;
  const backLabel=orgNav.stack.length>1?'← 返回':'← 机构总目';
  main.innerHTML=`<article class="org-detail"><a class="org-back" href="#/institutions" data-org-back>${backLabel}</a><header class="org-heading"><p class="eyebrow">${esc(r.kind)}</p><h1>${esc(r.name)}</h1>${chain.length?`<p class="org-chain">隶属：${chain.map(x=>`<a href="${esc(orgHref(x))}">${esc(x.name)}</a>`).join(' › ')}</p>`:''}${r.aliases.length?`<p class="org-aliases">又称：${r.aliases.map(esc).join('、')}</p>`:''}<p class="org-intro">${esc(r.summary)}</p>${r.kind!=='设施'&&r.status!=='current'?`<p class="org-note">${esc(ORG_STATUS[r.status])}。${esc(r.statusNote||'')}</p>`:''}${r.note?`<p class="org-note">${esc(r.note)}</p>`:''}</header>${units.length?`<section><h2>下设单位</h2>${unitGroups.length>1?unitGroups.map(([kind,rows])=>`<h3 class="org-kind">${esc(ORG_KIND_LABEL[kind]||kind)} <span>${rows.length}</span></h3>${unitList(rows)}`).join(''):unitList(units)}</section>`:''}${others.length?`<section><h2>相关机关</h2><ul class="org-relations">${others.map(({row,edge,incoming})=>`<li><span class="org-relation-type">${esc(ORG_RELATION[edge.type][incoming?1:0])}</span><a href="${esc(orgHref(row))}"><strong>${esc(row.name)}</strong></a>${edge.detail?`<p>${esc(edge.detail)}</p>`:''}</li>`).join('')}</ul></section>`:''}${sources.length?`<section><h2>依据条文</h2><ul class="org-sources">${sources.map(s=>`<li><a href="#/doc/${s.docId}${s.anchor?'?anchor='+encodeURIComponent(s.anchor):''}">${esc(s.title)}${s.section?` ${esc(s.section)}`:''}</a></li>`).join('')}</ul></section>`:''}</article>`;
  orgRestore();
}

function institutionLegacyBanner(params){const target=institutionRegistry?.legacy[params.get('institution')];if(!target)return;const href=target.startsWith('category:')?orgDirectoryUrl({group:target.slice(9)}):orgHref({id:target});main.insertAdjacentHTML('afterbegin',`<aside class="org-legacy"><p>此页按关键词检索提及该机构的文献。<a href="${esc(href)}">查看机构介绍 →</a></p></aside>`);}
