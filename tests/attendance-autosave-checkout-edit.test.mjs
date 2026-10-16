import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const appJs = fs.readFileSync(path.resolve('dist/app.js'), 'utf-8');

test('Attendance System: Automatic real-time database save on status change (no save button required)', () => {
  // Verify handleAutoSaveStatus directly saves to storageService.recordAttendance
  assert.ok(appJs.includes('handleAutoSaveStatus'), 'Attendance Desk defines handleAutoSaveStatus');
  assert.match(appJs, /storageService\.recordAttendance\(\{\s*memberId:\s*mId,\s*date:\s*attendanceDate,\s*status:\s*newStatus/);

  // Verify Daily Attendance Shortcut modal auto-saves directly on status change
  const modalSection = appJs.slice(appJs.indexOf('daily-attendance-shortcut-modal'), appJs.indexOf('daily-attendance-shortcut-modal') + 12000);
  assert.match(modalSection, /triggerUpdate\(mId,\s*\{\s*status:\s*finalStatus/);

  // Verify manual row Save buttons have been removed from the Attendance Desk and Modal
  const deskSection = appJs.slice(appJs.indexOf('// View 2: Attendance Desk'), appJs.indexOf('// ADD MEMBER MODAL'));
  assert.doesNotMatch(deskSection, /h\(Icon,\s*\{\s*name:\s*['"]save['"]/);
  assert.doesNotMatch(modalSection, /isSaved\s*\?\s*['"]Saved['"]\s*:\s*['"]Save['"]/);
});

test('Attendance System: Edit button provides full edit mode for attendance status, check-in, and check-out', () => {
  const deskSection = appJs.slice(appJs.indexOf('// View 2: Attendance Desk'), appJs.indexOf('// ADD MEMBER MODAL'));

  // Edit button exists for marked attendance
  assert.ok(deskSection.includes('title: "Edit attendance status, check-in, or check-out"'), 'Edit button exists with descriptive title');

  // Check-In and Check-Out editable inputs exist when isEditing is true
  assert.ok(deskSection.includes('handleUpdateTimeOrNote(mem, row, \'checkIn\''), 'Check-in time is editable');
  assert.ok(deskSection.includes('handleUpdateTimeOrNote(mem, row, \'checkOut\''), 'Check-out time is editable');

  // Done button exists in edit mode to finalize save to database
  assert.ok(deskSection.includes('handleSaveEditRow'), 'handleSaveEditRow handler defined');
  assert.ok(deskSection.includes('title: "Done editing and save to database"'), 'Done button saves all edits to database');

  // Quick Check Out button exists for on-duty present staff
  assert.ok(deskSection.includes('handleDirectCheckOut'), 'handleDirectCheckOut handler exists');
  assert.ok(deskSection.includes('canCheckOut && h("button"'), 'Check Out button conditionally rendered');
});

test('Attendance System: Daily Attendance Shortcut modal uses static badge once marked and prevents direct editing without clicking Edit', () => {
  const modalSection = appJs.slice(appJs.indexOf('daily-attendance-shortcut-modal'), appJs.indexOf('daily-attendance-shortcut-modal') + 25000);

  // In modal, status selector is only shown when editing or when unmarked
  assert.ok(modalSection.includes('status: activeStatus'), 'AttendanceStatusSelector active status provided in edit mode');
  assert.ok(modalSection.includes("status: 'Unmarked'"), 'AttendanceStatusSelector unmarked status provided when not yet marked');

  // When marked and !isModalEditing, renders static badge with ATTENDANCE_TRIGGER_THEMES
  assert.ok(modalSection.includes('ATTENDANCE_TRIGGER_THEMES[curStatus]'), 'Static badge rendered using ATTENDANCE_TRIGGER_THEMES');

  // Edit button activates edit mode
  assert.ok(modalSection.includes('title: "Edit check-in and check-out times"'));
  assert.ok(modalSection.includes('title: "Done editing and save to database"'));
  assert.ok(modalSection.includes('title: "Cancel editing"'));
});

test('Attendance System: Workers marked Absent or Leave never display Check Out button or Checked Out badge in modal or desk', () => {
  const deskSection = appJs.slice(appJs.indexOf('// View 2: Attendance Desk'), appJs.indexOf('// ADD MEMBER MODAL'));
  const modalSection = appJs.slice(appJs.indexOf('daily-attendance-shortcut-modal'), appJs.indexOf('daily-attendance-shortcut-modal') + 25000);

  // Attendance Desk guards
  assert.ok(deskSection.includes("!['Leave', 'Absent', 'Unmarked'].includes(row.status) && ['Present', 'Late', 'Half Day'].includes(row.status)"), 'Desk isOnDuty guards against Absent and Leave');
  assert.ok(deskSection.includes("!['Leave', 'Absent', 'Unmarked'].includes(row.status) && (row.status === 'Check Out' || Boolean(row.checkOut))"), 'Desk isCheckedOut guards against Absent and Leave');
  assert.ok(deskSection.includes("!['Leave', 'Absent', 'Unmarked'].includes(row.status) && isMarked && isCheckedOut && !isEditing"), 'Desk Checked Out badge guards against Absent and Leave');

  // Daily Shortcut modal guards
  assert.ok(modalSection.includes("!['Leave', 'Absent', 'Unmarked'].includes(curStatus) && ['Present', 'Late', 'Half Day'].includes(curStatus)"), 'Modal isOnDuty guards against Absent and Leave');
  assert.ok(modalSection.includes("!['Leave', 'Absent', 'Unmarked'].includes(curStatus) && (curStatus === 'Check Out' || Boolean(rec?.checkOut))"), 'Modal isCheckedOut guards against Absent and Leave');
  assert.ok(modalSection.includes("!['Leave', 'Absent', 'Unmarked'].includes(curStatus) && isMarked && isCheckedOut && !isModalEditing"), 'Modal Checked Out badge guards against Absent and Leave');
});

