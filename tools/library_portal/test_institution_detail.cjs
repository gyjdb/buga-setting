const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const registry=JSON.parse(fs.readFileSync(path.join(root,'site/library_portal/data/institutions.json'),'utf8'));
const main={innerHTML:''};
const ctx=vm.createContext({URLSearchParams,main,esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')});
vm.runInContext(fs.readFileSync(path.join(__dirname,'web/institutions.js'),'utf8'),ctx);
ctx.registry=registry;ctx.document={title:''};
vm.runInContext('institutionRegistry=registry;orgRestore=()=>{}',ctx);
const render=id=>{ctx.id=id;vm.runInContext('institutionDetail(id)',ctx);return main.innerHTML;};
for(const row of registry.institutions){
  const html=render(row.id);
  assert.ok(html.includes(ctx.esc(row.name)),`${row.name}: title missing`);
  assert.ok(!html.includes('关系依据'),`${row.name}: relation evidence should not be shown`);
  if(row.note)assert.ok(html.includes(ctx.esc(row.note)),`${row.name}: missing qualification`);
}
const exec=registry.institutions.find(r=>r.name==='白银执政院');
const html=render(exec.id);
const heading=label=>(html.match(new RegExp(`<h3 class="org-kind">${label} <span>([0-9]+)</span>`))||[])[1];
assert.equal(heading('组成部门（部委）'),'23');
assert.equal(heading('直属机构'),'9');
assert.equal(heading('直属特设机构'),'1');
assert.equal(heading('直属事业单位'),'18');
assert.equal(heading('部委管理的专项局'),'17');
console.log(`PASS: ${registry.institutions.length} institution details render without relation evidence; executive units grouped by kind`);
