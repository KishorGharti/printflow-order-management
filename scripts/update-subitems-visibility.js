import fs from 'fs';

let code = fs.readFileSync('dist/app.js', 'utf8');
let changeCount = 0;

// ===== CHANGE 1: Hide Sub Items section when disabled + no entries =====
// Replace the sub items section IIFE to return null when hidden
const subItemsSectionTarget = `                // 2. Sub Items Section
                (() => {
                  const isSubItemsEnabled = selectedStockProduct.hasSubItems !== undefined
                    ? Boolean(selectedStockProduct.hasSubItems)
                    : selectedStockEntries.length > 0;

                  return h("div", { className: "rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" }, [`;

const subItemsSectionReplace = `                // 2. Sub Items Section
                (() => {
                  const isSubItemsEnabled = selectedStockProduct.hasSubItems !== undefined
                    ? Boolean(selectedStockProduct.hasSubItems)
                    : selectedStockEntries.length > 0;

                  // Hide section entirely when sub items are disabled and none exist
                  if (!isSubItemsEnabled && selectedStockEntries.length === 0) return null;

                  return h("div", { className: "rounded-2xl border border-slate-200 bg-white p-5 shadow-xs" }, [`;

if (code.includes(subItemsSectionTarget)) {
  code = code.replace(subItemsSectionTarget, subItemsSectionReplace);
  changeCount++;
  console.log('✅ 1. Sub Items section hidden when disabled + no entries');
} else {
  console.log('❌ 1. Sub Items section target NOT found');
}

// ===== CHANGE 2: Add "+ Add Sub Item" button in modal header =====
// Add the button next to "Edit Info" button
const headerButtonTarget = `h("button", {
                    type: "button",
                    onClick: () => { setEditingStockItem(selectedStockProduct); setStockParentId(''); setIsAddStockOpen(true); },
                    className: "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer transition-all"
                  }, [h(Icon, { name: "edit", className: "h-3.5 w-3.5 text-slate-400" }), "Edit Info"]),`;

const headerButtonReplace = `h("button", {
                    type: "button",
                    onClick: () => { setEditingStockItem(selectedStockProduct); setStockParentId(''); setIsAddStockOpen(true); },
                    className: "inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer transition-all"
                  }, [h(Icon, { name: "edit", className: "h-3.5 w-3.5 text-slate-400" }), "Edit Info"]),
                  (() => {
                    const _isSubEnabled = selectedStockProduct.hasSubItems !== undefined
                      ? Boolean(selectedStockProduct.hasSubItems)
                      : selectedStockEntries.length > 0;
                    return (!_isSubEnabled && selectedStockEntries.length === 0) ? h("button", {
                      type: "button",
                      onClick: () => {
                        storageService.saveStockItem({ ...selectedStockProduct, hasSubItems: true });
                        setEditingStockItem(null);
                        setStockParentId(selectedStockProduct.id);
                        setIsAddStockOpen(true);
                        refresh();
                      },
                      className: "inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 text-white px-3.5 py-2 text-xs font-bold hover:bg-indigo-700 cursor-pointer transition-all shadow-xs"
                    }, [h(Icon, { name: "plus", className: "h-3.5 w-3.5" }), "Add Sub Item"]) : null;
                  })(),`;

if (code.includes(headerButtonTarget)) {
  code = code.replace(headerButtonTarget, headerButtonReplace);
  changeCount++;
  console.log('✅ 2. "+ Add Sub Item" button added in modal header');
} else {
  console.log('❌ 2. Header button target NOT found');
}

// ===== CHANGE 3: Add "+ Add Sub Item" in stock operations card footer =====
// Add button next to the "Unit: ..." text at bottom of operations card
const opsCardFooterTarget = `h("div", { className: "text-xs text-slate-400 font-medium" }, \`Unit: \${selectedStockProduct.unit}\`)`;

const opsCardFooterReplace = `h("div", { className: "flex items-center gap-3" }, [
                      (() => {
                        const _isSubEnabled2 = selectedStockProduct.hasSubItems !== undefined
                          ? Boolean(selectedStockProduct.hasSubItems)
                          : selectedStockEntries.length > 0;
                        return (!_isSubEnabled2 && selectedStockEntries.length === 0) ? h("button", {
                          type: "button",
                          onClick: () => {
                            storageService.saveStockItem({ ...selectedStockProduct, hasSubItems: true });
                            setEditingStockItem(null);
                            setStockParentId(selectedStockProduct.id);
                            setIsAddStockOpen(true);
                            refresh();
                          },
                          className: "inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100 cursor-pointer transition-all"
                        }, [h(Icon, { name: "plus", className: "h-3 w-3" }), "Add Sub Item"]) : null;
                      })(),
                      h("span", { className: "text-xs text-slate-400 font-medium" }, \`Unit: \${selectedStockProduct.unit}\`)
                    ])`;

if (code.includes(opsCardFooterTarget)) {
  code = code.replace(opsCardFooterTarget, opsCardFooterReplace);
  changeCount++;
  console.log('✅ 3. "+ Add Sub Item" button added in stock operations card footer');
} else {
  console.log('❌ 3. Ops card footer target NOT found');
}

// ===== CHANGE 4: Desktop table - Show "+ Add Sub Item" instead of "Sub Items (Off)" =====
const desktopTableTarget = `}, \`Sub Items (\${(item.hasSubItems !== false && (item.hasSubItems === true || stock.some(entry => entry.parentId === item.id))) ? stock.filter(entry => entry.parentId === item.id).length : 'Off'})\`),`;

const desktopTableReplace = `}, (() => {
                              const _subEnabled = item.hasSubItems !== false && (item.hasSubItems === true || stock.some(entry => entry.parentId === item.id));
                              return _subEnabled
                                ? \`Sub Items (\${stock.filter(entry => entry.parentId === item.id).length})\`
                                : "+ Add Sub Item";
                            })()),`;

if (code.includes(desktopTableTarget)) {
  code = code.replace(desktopTableTarget, desktopTableReplace);
  changeCount++;
  console.log('✅ 4. Desktop table: "+ Add Sub Item" replaces "Sub Items (Off)"');
} else {
  console.log('❌ 4. Desktop table target NOT found');
}

// ===== CHANGE 5: Mobile card - Show "+ Add Sub Item" instead of "Sub Items (Off)" =====
const mobileCardTarget = `}, \`Sub Items (\${(item.hasSubItems !== false && (item.hasSubItems === true || stock.some(entry => entry.parentId === item.id))) ? stock.filter(entry => entry.parentId === item.id).length : 'Off'})\`),`;

const mobileCardReplace = `}, (() => {
                        const _subEnabled = item.hasSubItems !== false && (item.hasSubItems === true || stock.some(entry => entry.parentId === item.id));
                        return _subEnabled
                          ? \`Sub Items (\${stock.filter(entry => entry.parentId === item.id).length})\`
                          : "+ Add Sub Item";
                      })()),`;

if (code.includes(mobileCardTarget)) {
  code = code.replace(mobileCardTarget, mobileCardReplace);
  changeCount++;
  console.log('✅ 5. Mobile card: "+ Add Sub Item" replaces "Sub Items (Off)"');
} else {
  console.log('❌ 5. Mobile card target NOT found');
}

// ===== CHANGE 6: Card view footer - Show "+ Add Sub Item" instead of "Sub items disabled" =====
const cardViewFooterTarget = `(item.hasSubItems !== false && (item.hasSubItems === true || entries.length > 0))
                        ? (entries.length > 0 ? \`\${entries.length} Sub Item\${entries.length === 1 ? '' : 's'}\` : "Sub items enabled (0)")
                        : "Sub items disabled"`;

const cardViewFooterReplace = `(item.hasSubItems !== false && (item.hasSubItems === true || entries.length > 0))
                        ? (entries.length > 0 ? \`\${entries.length} Sub Item\${entries.length === 1 ? '' : 's'}\` : "Sub items enabled (0)")
                        : "+ Add Sub Item"`;

if (code.includes(cardViewFooterTarget)) {
  code = code.replace(cardViewFooterTarget, cardViewFooterReplace);
  changeCount++;
  console.log('✅ 6. Card view footer: "+ Add Sub Item" replaces "Sub items disabled"');
} else {
  console.log('❌ 6. Card view footer target NOT found');
}

fs.writeFileSync('dist/app.js', code, 'utf8');
console.log(`\nDone. ${changeCount} changes applied.`);
