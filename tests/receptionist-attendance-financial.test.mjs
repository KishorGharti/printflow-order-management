import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appJsPath = path.join(__dirname, '..', 'dist', 'app.js');

test('Citizenship upload field is completely removed from team forms in app.js', () => {
  const content = fs.readFileSync(appJsPath, 'utf8');

  // Verify citizenship file inputs and temp variables are eliminated
  assert.equal(content.includes('window._tempCitizenship'), false, 'window._tempCitizenship should be removed');
  assert.equal(content.includes('Upload Citizenship Document'), false, 'Upload Citizenship Document field should be removed');
  assert.equal(content.includes("['Citizenship', member.citizenshipDoc"), false, 'Citizenship profile row should be removed');
});

test('Employee salary and financial transactions are integrated into Financial Settings & Ledger', () => {
  const content = fs.readFileSync(appJsPath, 'utf8');

  // Verify getFinancialLedgerData extracts staff transactions
  assert.ok(content.includes("teamrec-"), "Ledger should include staff salary entries");
  assert.ok(content.includes("salary-advance"), "Ledger should include staff advance entries");
  assert.ok(content.includes("advance-repay"), "Ledger should include advance repayment entries");

  // Verify type badges and tabs
  assert.ok(content.includes("Staff Salaries"), "Financial settings tabs should include Staff Salaries");
  assert.ok(content.includes("typeVal: 'SALARY'"), "SALARY filter value should be supported in txTabs");
  assert.ok(content.includes("Salary Paid"), "Type badge should support Salary Paid");
  assert.ok(content.includes("Staff Advance"), "Type badge should support Staff Advance");
  assert.ok(content.includes("Advance Repaid"), "Type badge should support Advance Repaid");

  // Verify Balance sheet includes staff salaries
  assert.ok(content.includes("entry.type === 'salary' || entry.type === 'salary-advance'"), "Balance sheet costs should include staff salaries");
});

test('Receptionist Attendance System is implemented in app.js', () => {
  const content = fs.readFileSync(appJsPath, 'utf8');

  // Verify Attendance Desk UI components
  assert.ok(content.includes("Attendance Desk"), "Team Management should contain Attendance Desk");
  assert.ok(content.includes("Duty Officer:"), "Attendance Desk should show Duty Officer");
  assert.ok(content.includes("Save Attendance"), "Attendance Desk should have unified Save Attendance button below");
  assert.ok(content.includes("canCheckOut"), "Attendance Desk should show Check Out button when staff is present");

  // Verify Member Profile Attendance Tab
  assert.ok(content.includes("Attendance History"), "Member modal tabList should include Attendance History");
  assert.ok(content.includes("ATTENDANCE RATE"), "Attendance tab should display attendance rate KPI");

  // Verify storageService attendance helpers
  assert.ok(content.includes("recordAttendance("), "storageService should have recordAttendance helper");
  assert.ok(content.includes("bulkRecordAttendance("), "storageService should have bulkRecordAttendance helper");
  assert.ok(content.includes("getTeamMonthlyAttendance("), "storageService should have getTeamMonthlyAttendance helper");
});
