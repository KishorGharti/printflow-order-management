import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const APP_JS_PATH = path.resolve(process.cwd(), 'dist', 'app.js');

test('Attendance System: Real-time Kathmandu Auto Time Stamping and Check Out Support', async (t) => {
  const content = fs.readFileSync(APP_JS_PATH, 'utf-8');

  await t.test('ATTENDANCE_STATUS_OPTIONS includes Check Out status', () => {
    assert.match(content, /value:\s*['"]Check Out['"]/);
    assert.match(content, /['"]Check Out['"]:\s*['"]bg-teal-50/);
  });

  await t.test('storageService.recordAttendance automatically stamps real time without requiring manual input', () => {
    assert.match(content, /const realNowTime = getKathmanduTimeKey\(\)/);
    assert.match(content, /if\s*\(!autoCheckIn\)\s*\{/);
    assert.match(content, /if\s*\(!autoCheckOut\)\s*\{/);
    assert.match(content, /finalStatus === ['"]Check Out['"]/);
  });

  await t.test('Attendance Desk table removed redundant manual Time / Check-In input column', () => {
    // Check that Attendance Desk table header does not contain Time / Check-In
    const deskSection = content.slice(content.indexOf('// View 2: Attendance Desk'), content.indexOf('// ── MONTHLY VIEW ──'));
    assert.doesNotMatch(deskSection, /h\("th",\s*\{[^}]*\}\s*,\s*["']Time \/ Check-In["']\)/);
    // Verifies that check-in and check-out are displayed automatically as read-only tags
    assert.match(deskSection, /Out:/);
    assert.match(deskSection, /In:/);
  });

  await t.test('Daily Attendance Shortcut Modal supports Check Out and automatic time stamping', () => {
    const modalSection = content.slice(content.indexOf('daily-attendance-shortcut-modal'), content.indexOf('daily-attendance-shortcut-modal') + 12000);
    assert.match(modalSection, /finalStatus === ['"]Check Out['"]/);
    assert.match(modalSection, /const realNow = getKathmanduTimeKey\(\)/);
    assert.match(modalSection, /Out:/);
  });

  await t.test('Member Modal attendance tab reflects Check Out status', () => {
    const memberModalSection = content.slice(content.indexOf('// ── ATTENDANCE HISTORY TAB ──'), content.indexOf('// ── ATTENDANCE HISTORY TAB ──') + 3000);
    assert.match(memberModalSection, /['"]Check Out['"]:\s*['"]bg-teal-50 text-teal-700 border-teal-200['"]/);
    assert.match(memberModalSection, /a\.status === ['"]Present['"]\s*\|\|\s*a\.status === ['"]Check Out['"]/);
  });
});
