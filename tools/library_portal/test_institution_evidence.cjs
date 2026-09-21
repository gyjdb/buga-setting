const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const registry=JSON.parse(fs.readFileSync(path.join(root,'site/library_portal/data/institutions.json'),'utf8'));
const main={innerHTML:''};
const ctx=vm.createContext({URLSearchParams,main,esc:s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;')});
vm.runInContext(fs.readFileSync(path.join(__dirname,'web/institutions.js'),'utf8'),ctx);
ctx.registry=registry;ctx.document={title:''};
vm.runInContext('institutionRegistry=registry;orgRestore=()=>{}',ctx);
let relations=0;
for(const row of registry.institutions){
  ctx.id=row.id;vm.runInContext('institutionDetail(id)',ctx);
  const edges=[...row.relations,...registry.institutions.flatMap(r=>r.relations.filter(e=>e.target===row.id))];
  for(const edge of edges){
    for(const source of edge.sources){
      const href='#/doc/'+source.docId+(source.anchor?'?anchor='+encodeURIComponent(source.anchor):'');
      assert.ok(main.innerHTML.includes(href),`${row.name}: missing relation evidence ${href}`);
    }
    relations++;
  }
  if(row.note)assert.ok(main.innerHTML.includes(ctx.esc(row.note)),`${row.name}: missing qualification`);
}
console.log(`PASS: ${registry.institutions.length} rendered institution details retain all ${relations} incoming/outgoing relation citations and notes`);
