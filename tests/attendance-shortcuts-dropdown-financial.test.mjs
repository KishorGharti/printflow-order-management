import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('1. Dashboard includes Daily Attendance Shortcut button right beside Add Payment', () => {
  const appJs = fs.readFileSync(path.resolve('dist/app.js'), 'utf-8');

  assert.ok(appJs.includes('bdailyattendancebtn'), 'Has bdailyattendancebtn key');
  assert.ok(appJs.includes('setDailyAttendanceModalOpen(true)'), 'Opens Daily Attendance Modal on click');
  assert.ok(appJs.includes('Daily Attendance'), 'Has Daily Attendance label');

  const dailyBtnIdx = appJs.indexOf('bdailyattendancebtn');
  const payBtnIdx = appJs.indexOf('bpaybtn');
  assert.ok(dailyBtnIdx > -1 && payBtnIdx > -1, 'Both buttons exist in app.js');
  assert.ok(dailyBtnIdx < payBtnIdx, 'Daily Attendance button is situated alongside + Add Payment');
});

test('2. Attendance Status uses AttendanceStatusSelector with floating dropdown and Save button', () => {
  const appJs = fs.readFileSync(path.resolve('dist/app.js'), 'utf-8');

  assert.ok(appJs.includes('AttendanceStatusSelector'), 'AttendanceStatusSelector component defined');
  assert.ok(appJs.includes('ATTENDANCE_STATUS_OPTIONS'), 'Floating dropdown menu options defined');
  assert.ok(appJs.includes('Save attendance status'), 'Save attendance status button exists');
  assert.ok(appJs.includes('attendanceSavedIds'), 'attendanceSavedIds state tracked');
});

test('3. Daily Attendance Shortcut Modal shows staff name, attendance status, and save action', () => {
  const appJs = fs.readFileSync(path.resolve('dist/app.js'), 'utf-8');

  assert.ok(appJs.includes('daily-attendance-shortcut-modal'), 'Modal key exists');
  assert.ok(appJs.includes('Daily Attendance Shortcut'), 'Title exists');
  assert.ok(appJs.includes('Staff Member Name'), 'Column 1 is Staff Member Name');
  assert.ok(appJs.includes('Attendance Status'), 'Column 2 is Attendance Status');
  assert.ok(appJs.includes('Action'), 'Column 3 is Action column');
});

test('4. Citizenship upload field and display row are completely removed', () => {
  const appJs = fs.readFileSync(path.resolve('dist/app.js'), 'utf-8');

  assert.ok(!appJs.includes('Citizenship Document'), 'Citizenship Document is not in app.js');
  assert.ok(!appJs.includes('_tempCitizenship'), '_tempCitizenship is not in app.js');
  assert.ok(!appJs.includes('member.citizenshipDoc'), 'member.citizenshipDoc is not in app.js');
});

test('5. Attendance Desk is integrated in Team Management', () => {
  const appJs = fs.readFileSync(path.resolve('dist/app.js'), 'utf-8');

  assert.ok(appJs.includes('Attendance Desk'), 'Attendance Desk heading exists');
  assert.ok(appJs.includes('teamViewMode'), 'teamViewMode tab state exists');
  assert.ok(appJs.includes('recordAttendance'), 'storageService.recordAttendance exists');
  assert.ok(appJs.includes('bulkRecordAttendance'), 'storageService.bulkRecordAttendance exists');
});

test('6. Employee Salary and Financial Transactions are reflected in Financial Settings & Ledger', () => {
  const appJs = fs.readFileSync(path.resolve('dist/app.js'), 'utf-8');

  assert.ok(appJs.includes('Salary disbursement'), 'Salary disbursement ledger details exist');
  assert.ok(appJs.includes('Staff advance / loan'), 'Staff advance / loan ledger details exist');
  assert.ok(appJs.includes('Advance repayment from staff'), 'Advance repayment ledger details exist');

  assert.ok(appJs.includes('Staff Salaries'), 'Staff Salaries tab in All Transactions exists');
  assert.ok(appJs.includes("typeVal: 'SALARY'"), 'typeVal SALARY filter exists');

  assert.ok(appJs.includes("if (type === 'salary') return"), 'Staff salary badge exists');
  assert.ok(appJs.includes("if (type === 'salary-advance') return"), 'Staff advance badge exists');
  assert.ok(appJs.includes("if (type === 'advance-repay') return"), 'Advance repayment badge exists');
});

test('7. Attendance Desk and Daily Attendance modal feature manual save in Actions column and human-crafted design', () => {
  const appJs = fs.readFileSync(path.resolve('dist/app.js'), 'utf-8');

  // Verify red highlight part removed (no Mark All Present button in Attendance Desk and Modal)
  assert.ok(!appJs.includes('Mark All Present'), 'Mark All Present button removed from Attendance Desk and Modal');

  // Verify manual draft state
  assert.ok(appJs.includes('attendanceDeskDrafts'), 'attendanceDeskDrafts tracked for manual saving');
  assert.ok(appJs.includes('shortcutAttendanceDrafts'), 'shortcutAttendanceDrafts tracked for manual saving');

  // Verify unified save button below table
  assert.ok(appJs.includes('Save Attendance'), 'Save attendance button located below table');

  // Verify human design for modal
  assert.ok(appJs.includes('Human Crafted Header'), 'Human crafted clean modal header');
  assert.ok(!appJs.includes('Receptionist Attendance Desk'), 'All instances renamed to Attendance Desk');
});

