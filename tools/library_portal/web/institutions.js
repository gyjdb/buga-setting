/* Editorial institution entities. Legacy document keyword collections remain separate. */
let institutionRegistry;
const ORG_HIERARCHY = new Set(['internal','subordinate','direct']);
const ORG_STATUS = {current:'现行机构',historical:'历史机构',abolished:'已撤销',conditional:'条件性机制',planned:'拟设',unknown:'状态不明'};
const ORG_RELATION = {management:['主管机关','主管单位'],internal:['内设于','内设单位'],subordinate:['隶属／由其管理','所属单位'],direct:['直属于','直属单位'],dual:['双重领导／业务指导','双重领导／业务指导'],oversight:['监督对象','监督来源'],appointment:['任命关系','任命关系'],authorization:['授权对象','授权来源'],cooperation:['协作','协作'],business:['业务联系','业务联系'],history:['历史沿革','历史沿革'],accountability:['负责对象','向本机关负责'],joint:['联合组成','联合机制'],appeal:['上诉审级','下级审级']};
const orgMap = () => new Map(institutionRegistry.institutions.map(r=>[r.id,r]));
function orgMatches(r,q){return [r.name,...r.aliases].some(n=>n.toLocaleLowerCase().includes(q.trim().toLocaleLowerCase()));}
function orgInScope(r,status){return status==='all'||(status==='facilities'?r.kind==='设施':r.kind!=='设施'&&(status==='other'?r.status!=='current':r.status===status));}
function orgDirectoryUrl(params={}){return '#/institutions'+(Object.keys(params).length?'?'+new URLSearchParams(params):'');}
function orgReturn(value){return /^#\/institutions(?:\?|$)/.test(value||'')?value:'#/institutions';}
function orgHref(r,from){return '#/institution/'+r.id+'?'+new URLSearchParams({from:orgReturn(from||location.hash)});}
function orgParent(r){return r.relations.find(e=>ORG_HIERARCHY.has(e.type));}
function orgContext(r){const p=orgParent(r);return p?orgMap().get(p.target)?.name:'';}
function orgSourceLink(s){return `<a href="#/doc/${s.docId}${s.anchor?'?anchor='+encodeURIComponent(s.anchor):''}" title="${esc(s.path+' · 第 '+s.line+' 行')}">${esc(s.title)}${s.section?' · '+esc(s.section):''}</a>`;}
function orgSources(sources){const seen=new Set();return sources.filter(s=>{const k=s.docId+':'+s.anchor;if(seen.has(k))return false;seen.add(k);return true;}).map(orgSourceLink).join('；');}
function orgSaveDirectory(){if(!document.querySelector('.org-directory'))return;try{sessionStorage.setItem('org-directory-state',JSON.stringify({url:location.hash,y:scrollY,open:[...document.querySelectorAll('.org-branch[open]')].map(n=>n.dataset.branch)}));}catch{}}
function orgSaved(){try{return JSON.parse(sessionStorage.getItem('org-directory-state')||'null');}catch{return null;}}
function orgItem(r,context=false){return `<li class="org-entry"><a href="${esc(orgHref(r))}" class="org-name">${esc(r.name)}</a>${context&&orgContext(r)?`<small>${esc(orgContext(r))}</small>`:''}<p>${esc(r.summary)}</p>${r.status!=='current'?`<span class="org-status">${esc(ORG_STATUS[r.status])}</span>`:''}</li>`;}

function institutionDirectory(params){
  document.title='机构总目 · 白塔档案馆';
  const state={q:params.get('q')||'',status:params.get('status')||'current',group:params.get('group')||''};
  if(!['current','other','facilities','all'].includes(state.status))state.status='current';
  if(!institutionRegistry.categories.some(c=>c.id===state.group))state.group='';
  const count=institutionRegistry.counts.current;
  main.innerHTML=`<div class="org-directory"><header class="org-heading"><p class="eyebrow">白塔档案馆 · 机构名录</p><h1>机构总目</h1><p class="org-caption">${count} 个现行机构及具名单位 · ${institutionRegistry.categories.length} 个浏览分组。每个机构只计一次；分组不表示隶属。设施及其他状态另列。</p></header><form class="org-search" role="search"><label for="org-query">机构名称、简称或别名</label><div><input id="org-query" type="search" autocomplete="off" placeholder="如：白塔、反垄断局、许可证务科" value="${esc(state.q)}"><button type="submit">查找</button><button type="button" id="org-clear">清除条件</button></div></form><nav class="org-scopes" aria-label="机构状态">${[['current','现行名录'],['other','历史、撤销与条件性机制'],['facilities','具名设施'],['all','全部条目']].map(([id,label])=>`<a href="${esc(orgDirectoryUrl({status:id,...(state.q?{q:state.q}:{})}))}" ${id===state.status?'aria-current="page"':''}>${label}</a>`).join('')}</nav><details class="org-jump-panel" ${matchMedia("(max-width:600px)").matches?"":"open"}><summary>分类快速跳转 · ${institutionRegistry.categories.length} 组</summary><nav class="org-jumps" aria-label="分类快速跳转"></nav></details><div class="org-tools"><p id="org-result-count" role="status" aria-live="polite"></p><button type="button" id="org-expand">展开全部下属单位</button></div><div id="org-results"></div><footer class="org-footer"><p>简介与关系逐条附来源。仅提及机构的文献另作全文关联，不构成设立、隶属或授权依据。</p><details><summary>整理范围与资料边界</summary><p>以现行正文清单选中的 ${institutionRegistry.coverage.length} 份正文为基础，并核对适用的作者决定。按正文确定的建制收录，不推定过渡组建已经完成。历史材料保留全文检索，未把历次讨论方案全部当作机构事实。</p><ul>${institutionRegistry.coverage.map(c=>`<li>${linkDoc(docAt(c.path)?.id)}</li>`).join('')}</ul></details></footer></div>`;
  const saved=orgSaved();
  let opened=new Set(saved?.url===location.hash?saved.open:[]), expanded=false;
  function render(){
    document.querySelectorAll('.org-scopes a').forEach(a=>{const scope=new URLSearchParams(a.getAttribute('href').split('?')[1]).get('status');a.setAttribute('href',orgDirectoryUrl({status:scope,...(state.q?{q:state.q}:{})}));});
    const selected=institutionRegistry.institutions.filter(r=>orgInScope(r,state.status)&&orgMatches(r,state.q));
    document.querySelector('#org-result-count').textContent=`${state.q?'检索结果':'本视图'}：${selected.length} 个${state.status==='facilities'?'设施':'条目'}${state.q?'（包含所有折叠单位）':''}`;
    document.querySelector('.org-jumps').innerHTML=institutionRegistry.categories.map(c=>{const n=selected.filter(r=>r.category===c.id).length;return n?`<a href="${esc(orgDirectoryUrl({...state,group:c.id}))}" data-org-group="${c.id}" ${state.group===c.id?'aria-current="location"':''}>${esc(c.name)}<span>${n}</span></a>`:'';}).join('');
    document.querySelector('#org-results').innerHTML=selected.length?institutionRegistry.categories.map(c=>{
      const members=selected.filter(r=>r.category===c.id);if(!members.length)return '';
      const memberIds=new Set(members.map(r=>r.id));
      const children=new Map();
      for(const r of members){const p=orgParent(r);if(p&&memberIds.has(p.target)){if(!children.has(p.target))children.set(p.target,[]);children.get(p.target).push(r);}}
      function branches(parent,depth){return `<details class="org-branch" data-branch="${parent.id}" ${expanded||(saved?.url===location.hash?opened.has(parent.id):depth===0||opened.has(parent.id))?'open':''}><summary>${esc(parent.name)}所列单位 <span>${children.get(parent.id).length}</span></summary><ul class="org-list">${children.get(parent.id).map(r=>orgItem(r)).join('')}</ul>${children.get(parent.id).filter(r=>children.has(r.id)).map(r=>branches(r,depth+1)).join('')}</details>`;}
      const roots=members.filter(r=>!orgParent(r)||!memberIds.has(orgParent(r).target));
      const notes=institutionRegistry.notes.filter(n=>n.category===c.id);
      return `<section class="org-group" id="org-group-${c.id}" aria-labelledby="org-title-${c.id}"><div class="org-group-title"><h2 id="org-title-${c.id}" tabindex="-1">${esc(c.name)}</h2><span>${members.length} 个条目</span></div>${state.q?`<ul class="org-list">${members.map(r=>orgItem(r,true)).join('')}</ul>`:`<ul class="org-list org-roots">${roots.map(r=>orgItem(r,true)).join('')}</ul>${roots.filter(r=>children.has(r.id)).map(r=>branches(r,0)).join('')}`}${notes.length?`<details class="org-scope-note"><summary>本组收录说明</summary>${notes.map(n=>`<p>${esc(n.text)}</p><p class="org-citations">${orgSources(n.sources)}</p>`).join('')}</details>`:''}<a class="org-top" href="${esc(orgDirectoryUrl(state))}" data-org-top>回到分类导航 ↑</a></section>`;
    }).join(''):`<div class="empty"><h2>没有找到匹配机构</h2><p>可用正式名称、简称或别名重试，也可切换到全部条目。</p><button type="button" id="org-empty-clear">清除条件</button></div>`;
    document.querySelectorAll('.org-branch').forEach(el=>el.addEventListener('toggle',()=>{if(el.open)opened.add(el.dataset.branch);else opened.delete(el.dataset.branch);}));
    document.querySelector('#org-empty-clear')?.addEventListener('click',()=>{location.hash='/institutions';});
  }
  function updateUrl(){const p={};for(const k of ['q','status','group'])if(state[k]&&(k!=='status'||state[k]!=='current'))p[k]=state[k];history.replaceState(null,'',orgDirectoryUrl(p));}
  function search(){state.q=document.querySelector('#org-query').value;state.group='';updateUrl();render();}
  document.querySelector('.org-search').addEventListener('submit',e=>{e.preventDefault();search();});
  document.querySelector('#org-query').addEventListener('input',search);
  document.querySelector('#org-clear').addEventListener('click',()=>{location.hash='/institutions';if(location.hash==='#/institutions'){state.q='';state.status='current';state.group='';document.querySelector('#org-query').value='';institutionDirectory(new URLSearchParams());}});
  document.querySelector('#org-expand').addEventListener('click',()=>{expanded=[...document.querySelectorAll('.org-branch')].some(d=>!d.open);document.querySelectorAll('.org-branch').forEach(d=>d.open=expanded);document.querySelector('#org-expand').textContent=expanded?'收起下属单位':'展开全部下属单位';});
  main.querySelector('.org-directory').addEventListener('click',e=>{
    const jump=e.target.closest('[data-org-group]');
    if(jump){e.preventDefault();state.group=jump.dataset.orgGroup;updateUrl();document.querySelectorAll('[data-org-group]').forEach(a=>a.removeAttribute('aria-current'));jump.setAttribute('aria-current','location');document.getElementById('org-title-'+state.group)?.focus({preventScroll:true});document.getElementById('org-group-'+state.group)?.scrollIntoView();}
    if(e.target.closest('[data-org-top]')){e.preventDefault();state.group='';updateUrl();window.scrollTo(0,0);document.querySelector('#org-query').focus({preventScroll:true});}
    if(e.target.closest('a[href^="#/institution/"]')){e.target.closest('a').href=orgHref(orgMap().get(e.target.closest('a').getAttribute('href').split('/institution/')[1].split('?')[0]),location.hash);orgSaveDirectory();}
  });
  render();
  requestAnimationFrame(()=>{if(saved?.url===location.hash)window.scrollTo(0,saved.y);else if(state.group)document.getElementById('org-group-'+state.group)?.scrollIntoView();else window.scrollTo(0,0);});
}

function institutionDetail(id,params){
  const mapped=institutionRegistry.legacy[decodeURIComponent(id)]||id;
  if(mapped.startsWith('category:')){location.hash=orgDirectoryUrl({group:mapped.slice(9)});return;}
  const r=orgMap().get(mapped);if(!r)throw new Error('该机构未收入名录，请返回机构总目查找。');
  const from=orgReturn(params.get('from')), category=institutionRegistry.categories.find(c=>c.id===r.category);
  document.title=r.name+' · 机构名录 · 白塔档案馆';
  const incoming=institutionRegistry.institutions.flatMap(x=>x.relations.filter(e=>e.target===r.id).map(e=>({row:x,edge:e,incoming:true})));
  const outgoing=r.relations.map(e=>({row:orgMap().get(e.target),edge:e,incoming:false}));
  const all=[...outgoing,...incoming], parents=outgoing.filter(e=>ORG_HIERARCHY.has(e.edge.type)), children=incoming.filter(e=>ORG_HIERARCHY.has(e.edge.type)), others=all.filter(e=>!ORG_HIERARCHY.has(e.edge.type));
  const relationList=(entries)=>`<ul class="org-relations">${entries.map(({row,edge,incoming})=>`<li><div><span class="org-relation-type">${esc(ORG_RELATION[edge.type][incoming?1:0])}</span><a href="${esc(orgHref(row,from))}">${esc(row.name)}</a>${row.status!=='current'?` <small>${esc(ORG_STATUS[row.status])}</small>`:''}</div><p>${esc(edge.detail)}</p><details><summary>关系依据</summary><p class="org-citations">${orgSources(edge.sources)}</p></details></li>`).join('')}</ul>`;
  const basis=r.sources.filter(s=>['establishes','regulates'].includes(s.role)), descriptions=r.sources.filter(s=>!['establishes','regulates'].includes(s.role));
  const directIds=new Set([...r.sources,...all.flatMap(e=>e.edge.sources)].map(s=>s.docId));
  const current=[...directIds].map(id=>byId.get(id)).filter(d=>d?.status==='CURRENT_CANON');
  const history=[...directIds].map(id=>byId.get(id)).filter(d=>d&&d.status!=='CURRENT_CANON');
  const mentions=(r.mentions||[]).map(id=>byId.get(id)).filter(d=>d&&!directIds.has(d.id));
  const docList=items=>`<ul class="org-documents">${items.map(d=>`<li>${linkDoc(d.id)} <small>${esc(labels[d.status]||d.status)}</small></li>`).join('')}</ul>`;
  const mentionGroups=[['现行文献中的提及',mentions.filter(d=>d.status==='CURRENT_CANON')],['历史与其他材料中的提及',mentions.filter(d=>d.status!=='CURRENT_CANON')]].filter(([,items])=>items.length).map(([title,items])=>`<details><summary>${title} · ${items.length} 份</summary>${docList(items)}</details>`).join('');
  main.innerHTML=`<article class="org-detail"><nav class="org-breadcrumb" aria-label="机构导航"><a href="${esc(from)}">← 返回机构总目</a><a href="${esc(orgDirectoryUrl({group:category.id,...(r.kind==='设施'?{status:'facilities'}:r.status!=='current'?{status:'other'}:{})}))}">${esc(category.name)}</a></nav><header class="org-heading"><p class="eyebrow">${esc(r.kind)} · ${r.kind==='设施'?'具名设施':esc(ORG_STATUS[r.status])}</p><h1>${esc(r.name)}</h1>${r.aliases.length?`<p class="org-aliases">简称与别名：${r.aliases.map(esc).join('、')}</p>`:''}<p class="org-intro">${esc(r.summary)}</p><p class="org-citations">简介依据：${orgSources(r.sources)}</p>${r.note?`<p class="org-note">${esc(r.note)}</p>`:''}</header>${parents.length?`<section><h2>所属与内设关系</h2>${relationList(parents)}</section>`:''}${children.length?`<section><h2>所列下属单位 <small>${children.length}</small></h2>${relationList(children)}</section>`:''}${others.length?`<section><h2>其他有据关系</h2><p class="org-caption">按关系类型阅读；协作、监督、任命和审级均不自动构成行政隶属。</p>${relationList(others)}</section>`:''}${!all.length?'<p class="org-note">现有整理未确认本机构的组织隶属，不据同文提及推定。</p>':''}${basis.length?`<section><h2>设立与规范依据</h2><p class="org-citations">${orgSources(basis)}</p></section>`:''}${descriptions.length?`<section><h2>名称、描述与状态依据</h2><p class="org-citations">${orgSources(descriptions)}</p></section>`:''}${current.length?`<section><h2>相关现行文献</h2>${docList(current)}</section>`:''}${history.length?`<section><h2>历史及作者材料</h2>${docList(history)}</section>`:''}${mentions.length?`<section><h2>全文提及</h2><p class="org-caption">名称与别名命中的检索关联，不作为设立依据。短名可能有歧义，请核对原文。</p>${mentionGroups}</section>`:''}<footer class="org-footer"><a href="${esc(from)}">← 返回机构总目</a><a href="${esc(browseUrl({q:r.name}))}">在全部馆藏检索此名称</a><p>${esc(r.statusNote||'存续状态依本条所列来源判定。')}</p></footer></article>`;
}

function institutionLegacyBanner(params){const target=institutionRegistry?.legacy[params.get('institution')];if(!target)return;const href=target.startsWith('category:')?orgDirectoryUrl({group:target.slice(9)}):orgHref({id:target},'#/institutions');main.insertAdjacentHTML('afterbegin',`<aside class="org-legacy"><p>此页保留原有机构关键词检索。<a href="${esc(href)}">查看机构介绍与有据关系 →</a></p></aside>`);}
