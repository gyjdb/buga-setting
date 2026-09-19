// Regression for presentation-only audit aggregation, using the actual corpus.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'site/library_portal/data/metadata.json'), 'utf8'));
const scope = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, 'web/prototype.js'), 'utf8'), scope);
const summarize = rows => JSON.parse(JSON.stringify(scope.conflictStatusSummary(rows)));
const original = JSON.stringify(metadata.audit);
assert.deepEqual(summarize(metadata.audit.conflictRows), {
  RESOLVED_IN_CURRENT_CANON: 18,
  PROVENANCE_RETAINED: 1,
  AUTHOR_ONLY_DEFER: 2,
  INPUT_RISK_RETAINED: 3,
  AUTHOR_RESOLUTION_IN_CURRENT_CANON: 1,
}); // Verified against CONFLICTS.md, original F-number table; not EC or CC totals.
assert.equal(JSON.stringify(metadata.audit), original, 'aggregation must not mutate stored audit fields');
assert.equal(summarize([]), null, 'missing rows must not be reported as zero conflicts');
assert.equal(summarize(undefined), null);
assert.equal(summarize([['F01', 'K14第四十条', 'rule', 'scope']]), null, 'rule locations are not statuses');
assert.equal(summarize([['F01', 'OPEN', 'old shape']]), null, 'unknown table shapes remain unavailable');
console.log('PASS: 6 frontend audit regression checks against the actual F-number register');
