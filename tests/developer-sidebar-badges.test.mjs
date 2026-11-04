import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dev = fs.readFileSync(new URL('../dist/developer.js', import.meta.url), 'utf8');

test('sidebar tracks "new since last opened" per tab in this browser', () => {
  assert.match(dev, /const SEEN_STORAGE_KEY = 'printflow_dev_seen_tabs_v1'/);
  assert.match(dev, /localStorage\.setItem\(SEEN_STORAGE_KEY, JSON\.stringify\(seenAt\)\)/);
  for (const tab of ['server', 'database', 'security', 'support', 'clients']) {
    assert.match(dev, new RegExp(`\\b${tab}: \\(`), `activity source for ${tab}`);
  }
});

test('a client login alone is not counted as a client update', () => {
  assert.match(dev, /const loginOnly = Math\.abs\(updated - ms\(c\.last_login_at\)\) < 5000;/);
});

test('opening a tab clears its count, and first use treats existing data as seen', () => {
  assert.match(dev, /const openIds = \[activeTab\];/);
  assert.match(dev, /markTabsSeen\(openIds\.filter\(\(id\) => activityTimes\[id\]\)\);/);
  assert.match(dev, /filter\(\(id\) => seenAt\[id\] === undefined\)/);
});

test('red count badge replaces the info badge only while there is something new', () => {
  assert.match(dev, /\.map\(\(item\) => \(\{ \.\.\.item, newCount: newCounts\[item\.id\] \|\| 0 \}\)\)/);
  assert.match(dev, /item\.newCount > 0\s*\?\s*h\(/);
  assert.match(dev, /title: item\.newCount \+ ' new since you last opened this tab'/);
});

test('background check runs once a minute and only while the console is visible', () => {
  assert.match(dev, /if \(document\.visibilityState !== 'visible'\) return;/);
  assert.match(dev, /setInterval\(refreshActivity, 60000\)/);
  assert.match(dev, /fetchApi\('\/api\/developer\/logs'\)\.catch\(\(\) => null\),\s*\]\);\s*if \(logsRes\?\.ok\) setLogsData\(logsRes\);/);
});

test('API & Server Status sub-tabs use the same "new since last opened" counts', () => {
  for (const id of ['crashes', 'errors', 'failed', 'auth', 'activity']) {
    assert.match(dev, new RegExp(`'log:${id}': \\(`), `activity source for log sub-tab ${id}`);
    assert.match(dev, new RegExp(`${id}: newCounts\\['log:${id}'\\] \\|\\| 0`), `count passed for ${id}`);
  }
  assert.match(dev, /if \(activeTab === 'server'\) openIds\.push\('log:' \+ logFilter\);/);
  assert.match(dev, /logNewCounts\[tab\.id\] > 0\s*\?\s*h\('span'/);
});

test('developer console eye icon has a valid SVG path', () => {
  assert.match(dev, /eye: '<path d="M2 12s3-7/);
});
