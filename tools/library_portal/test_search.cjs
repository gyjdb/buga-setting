// Run the actual browser-worker algorithm against the generated corpus in Node.
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const assert = require("node:assert/strict");
const site = path.resolve(__dirname, "../../site/library_portal");
const index = JSON.parse(
  fs.readFileSync(path.join(site, "data/metadata.json"), "utf8"),
);
const results = [];
const context = vm.createContext({
  Map,
  Error,
  postMessage: (r) => results.push(r),
  fetch: async (url) => ({
    ok: true,
    json: async () => JSON.parse(fs.readFileSync(path.join(site, url), "utf8")),
  }),
});
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "web/search-worker.js"), "utf8"),
  context,
);
async function search(query, scope = "", documents = index.documents) {
  results.length = 0;
  await context.onmessage({
    data: {
      type: "search",
      request: 1,
      query,
      scope,
      documents,
      shards: index.searchShards,
    },
  });
  const result = results.find((r) => r.type === "results");
  assert.ok(result, JSON.stringify(results));
  return result.results;
}
(async () => {
  const tower = index.documents.find(
    (d) => d.alias === "K28" && d.status === "CURRENT_CANON",
  );
  assert.ok(
    (await search("寰宇文库")).some((r) => r.id === tower.id),
    "full body term absent from title",
  );
  assert.ok(
    !(await search("寰宇文库", "title")).some((r) => r.id === tower.id),
    "title-only scope",
  );
  assert.ok(
    (await search("白塔 封存")).some((r) => r.id === tower.id),
    "multi-term AND search",
  );
  assert.equal(
    (await search("不存在的术语zzzz20260918")).length,
    0,
    "empty results",
  );
  const canonManifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../organized_project/00_PROJECT/CURRENT_CANON_MANIFEST.json"), "utf8"));
  assert.equal(tower.version, "v" + canonManifest.files.find((d) => d.alias === "K28").version, "version from current manifest; world title need not contain metadata");
  assert.equal(
    (
      await search(
        "白塔",
        "",
        index.documents.filter((d) => d.status === "CANDIDATE"),
      )
    ).some((r) => r.id === tower.id),
    false,
    "filters constrain the result set",
  );
  const regexp = await search("[.*+?");
  assert.ok(Array.isArray(regexp), "literal punctuation is safe");
  const current = index.documents.filter((d) => d.status === "CURRENT_CANON");
  assert.equal(current.length, 17);
  const cases = [
    ["K20", "当前大陆明确使用弦魔法的种族为巨龙", "凡人术式以十四环为极限"],
    ["K15", "自然能力与行政认定分别成立", "器物辅助条件依"],
    ["K14", "在布加人的文明中", "依第三十九条备案之政治团体不构成法定党派身份"],
    ["K25", "十二环领袖身份不等于", "普通白塔成员不享有此项豁免"],
    ["K28", "该说法白塔学会不予正式采信", "为登塔者提供未越要素之壁"],
    ["K24", "不是互相替代的三本账", "每笔结算须同时登记预算用途"],
  ];
  for (const [alias, oldPhrase, newPhrase] of cases) {
    assert.equal((await search(oldPhrase, "", current)).length, 0, alias + " old phrase excluded from CURRENT_CANON");
    assert.ok((await search(newPhrase, "", current)).some((r) => current.find((d) => d.id === r.id)?.alias === alias), alias + " new phrase locates current body");
  }
  assert.ok((await search("当前大陆明确使用弦魔法的种族为巨龙")).length > 0, "old text remains searchable as history, not current");
  console.log("PASS: 21 search behavior checks against actual generated corpus (7 existing, current count, 12 old/new phrase assertions, historical retention)");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
