const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const site=path.join(root,'site/library_portal');
const registry=JSON.parse(fs.readFileSync(path.join(site,'data/institutions.json'),'utf8'));
const metadata=JSON.parse(fs.readFileSync(path.join(site,'data/metadata.json'),'utf8'));
// portal.js 与 portal-pages.js 在浏览器里共用全局；这里只给出机构详情页用到的几样。
const main={innerHTML:'',dataset:{}};
const document={title:'',querySelector:()=>main,addEventListener(){}};
const ctx=vm.createContext({URLSearchParams,document,window:{scrollTo(){}},location:{replace(){}}});
for(const file of ['web/portal.js','web/portal-pages.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,file),'utf8'),ctx,{filename:file});
ctx.data={registry,metadata};
vm.runInContext('registry=data.registry;index=data.metadata;docs=index.documents;byId=new Map(docs.map(d=>[d.id,d]))',ctx);
const esc=vm.runInContext('esc',ctx);
const render=id=>{ctx.id=id;vm.runInContext('institutionPage(id)',ctx);return main.innerHTML;};
for(const row of registry.institutions){
  const html=render(row.id);
  assert.ok(html.includes(`<h1>${esc(row.name)}</h1>`),`${row.name}: title missing`);
  assert.ok(!html.includes('关系依据'),`${row.name}: relation evidence should not be shown`);
  assert.ok(!html.includes('undefined'),`${row.name}: undefined in page`);
  if(row.note)assert.ok(html.includes(esc(row.note)),`${row.name}: missing qualification`);
}
const exec=registry.institutions.find(r=>r.name==='白银执政院');
const html=render(exec.id);
const heading=label=>(html.match(new RegExp(`<h3 class="rs-org-subhead">${label}<small>([0-9]+)</small></h3>`))||[])[1];
assert.equal(heading('组成部门（部委）'),'23');
assert.equal(heading('直属机构'),'9');
assert.equal(heading('直属特设机构'),'1');
assert.equal(heading('直属事业单位'),'18');
assert.equal(heading('部委管理的专项局'),'17');
console.log(`PASS: ${registry.institutions.length} institution details render without relation evidence; executive units grouped by kind`);
