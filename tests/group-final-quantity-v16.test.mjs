import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const app = fs.readFileSync(new URL('../dist/app.js', import.meta.url), 'utf8');

test('Final Quantity Required supports Group Item breakdown', () => {
  assert.match(app, /printingGateGroupBreakdowns/);
  assert.match(app, /File \/ Design Final Quantity/);
  assert.match(app, /Each design becomes one product row in Bill and Chalan/);
  assert.match(app, /\+ Add Group Item/);
});

test('group final quantity sum becomes the production parent quantity', () => {
  assert.match(app, /const qty=rows\.reduce\(\(sum,row\)=>sum\+Number\(row\.quantity\|\|0\),0\)/);
  assert.match(app, /fileBreakdown:rows,showFileBreakdownOnClientDocs:true/);
  assert.match(app, /next\.lineTotal=storageService\.calculateLineTotal\(next\)/);
});

test('five grouped designs are five Bill and Chalan document products', () => {
  assert.match(app, /flatMap\(\(item,itemIndex\)=>/);
  assert.match(app, /return rows\.map\(\(row,rowIndex\)=>/);
  assert.match(app, /productName:`\$\{row\.name\} \(\$\{parentName\}\)`/);
  const billStart=app.indexOf('const createReferenceBillPdf');
  const chalanStart=app.indexOf('const createReferenceChalanPdf');
  const chalanEnd=app.indexOf('const storageService',chalanStart);
  assert.match(app.slice(billStart,chalanStart), /const items=expandGroupedItemsForDocuments\(sourceItems\)/);
  assert.match(app.slice(chalanStart,chalanEnd), /const items=expandGroupedItemsForDocuments\(sourceItems\)/);
});
