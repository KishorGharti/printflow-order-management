const fs = require('fs');
let content = fs.readFileSync('dist/app.js', 'utf8');

// 1. In main block, if selectedTeam, don't show list.
content = content.replace(
  "profileTopic === 'team' && (() => {",
  "profileTopic === 'team' && (() => {\n              if (selectedTeam) return null;\n"
);

// 2. Remove + sign from Add Member button
content = content.replace(
  '[h(Icon, { name: "plus", className: "w-3.5 h-3.5" }), "+ Add Member"]',
  '"Add Member"'
);

// 3. Fix UI error in Add Record form
content = content.replace(
  'className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_130px_140px_1.5fr_auto] gap-2"',
  'className: "flex flex-wrap items-center gap-3"'
);
content = content.replace(
  'className: "rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"',
  'className: "flex-1 min-w-[140px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"'
);
content = content.replace(
  'h("input", { name: "recDate", type: "date", defaultValue: todayStr, required: true, className: "rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none" })',
  'h("input", { name: "recDate", type: "date", defaultValue: todayStr, required: true, className: "flex-1 min-w-[120px] rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none" })'
);
content = content.replace(
  'className: "rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"',
  'className: "flex-1 min-w-[120px] rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none"'
);
content = content.replace(
  'className: "rounded-xl border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"',
  'className: "flex-[2] min-w-[160px] rounded-xl border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"'
);
content = content.replace(
  'className: "px-4 py-2 rounded-xl bg-indigo-600 text-xs font-black text-white hover:bg-indigo-700 cursor-pointer whitespace-nowrap"',
  'className: "shrink-0 px-5 py-2.5 rounded-xl bg-indigo-600 text-xs font-black text-white hover:bg-indigo-700 cursor-pointer whitespace-nowrap"'
);

// 4. Change profile modal from popup to inline.
content = content.replace(
  'className: "fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm",',
  'className: "w-full animate-fade-in",'
);
content = content.replace(
  'className: "w-full sm:max-w-3xl max-h-[96vh] sm:max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl flex flex-col"',
  'className: "w-full rounded-3xl border border-slate-200 bg-slate-50 shadow-sm flex flex-col overflow-hidden"'
);
content = content.replace(
  'onMouseDown: e => { if (e.target === e.currentTarget) { setSelectedTeam(null); setTeamMemberEditMode(false); } }',
  ''
);
content = content.replace(
  'h("button", { type: "button", onClick: () => { setSelectedTeam(null); setTeamMemberEditMode(false); setTeamProfileTab(\'info\'); }, className: "flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 cursor-pointer", "aria-label": "Close" }, h(Icon, { name: "x", className: "w-4 h-4" }))',
  'h("button", { type: "button", onClick: () => { setSelectedTeam(null); setTeamMemberEditMode(false); setTeamProfileTab(\'info\'); }, className: "inline-flex h-8 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/20 cursor-pointer" }, [h(Icon, { name: "arrowLeft", className: "w-3.5 h-3.5" }), "Back"])'
);
// Also change the header to say "Team Management" instead of being sticky if we want, but sticky is fine.

// 5. Add Citizenship Upload
// In the display mode:
const displayFieldsStr = `['Join Date', member.createdAt ? storageService.displayDate(member.createdAt.slice(0,10)) : 'Unknown']
                        ]`;
const newDisplayFieldsStr = `['Join Date', member.createdAt ? storageService.displayDate(member.createdAt.slice(0,10)) : 'Unknown']
                        ];
                        if (member.citizenshipDoc) {
                           fieldsArray.push(['Citizenship', h('a', { href: member.citizenshipDoc, target: '_blank', className: 'text-indigo-600 hover:underline' }, 'View Document')]);
                        }`;
content = content.replace(
  `['Join Date', member.createdAt ? storageService.displayDate(member.createdAt.slice(0,10)) : 'Unknown']\n                        ].map(([label, value]) =>`,
  `['Join Date', member.createdAt ? storageService.displayDate(member.createdAt.slice(0,10)) : 'Unknown'],
                          ['Citizenship', member.citizenshipDoc ? h('a', { href: member.citizenshipDoc, target: '_blank', className: 'text-indigo-600 hover:underline inline-flex items-center gap-1' }, [h(Icon, { name: "file", className: "w-3 h-3" }), 'View Document']) : 'Not uploaded']
                        ].map(([label, value]) =>`
);

// In the edit mode:
content = content.replace(
  `h("select", { name: "editStatus", defaultValue: member.status || 'active', className: "w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer" }, [h("option", { value: "active" }, "Active"), h("option", { value: "inactive" }, "Inactive")])])
                        ]),`,
  `h("select", { name: "editStatus", defaultValue: member.status || 'active', className: "w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer" }, [h("option", { value: "active" }, "Active"), h("option", { value: "inactive" }, "Inactive")])]),
                          h("div", { className: "col-span-1 sm:col-span-2" }, [
                            h("label", { className: "block font-bold uppercase text-slate-600 mb-1" }, "Citizenship Document"),
                            h("input", {
                              type: "file",
                              accept: "image/*,.pdf",
                              onChange: e => {
                                const file = e.target.files[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (ev) => { window._tempCitizenship = ev.target.result; };
                                  reader.readAsDataURL(file);
                                } else {
                                  window._tempCitizenship = null;
                                }
                              },
                              className: "w-full p-2 border border-slate-200 rounded-xl text-xs bg-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                            }),
                            member.citizenshipDoc && !window._tempCitizenship && h("p", { className: "text-[10px] text-emerald-600 mt-1 font-semibold" }, "✓ Document already uploaded. Select a new file to replace it.")
                          ])
                        ]),`
);

// In the save logic:
content = content.replace(
  `saveMember({ name: f.editName.value.trim(), jobTitle: f.editTitle.value.trim(), phone: f.editPhone.value.replace(/\\D/g, ''), pin, salary: nextSalary, status: f.editStatus.value, records: nextRecords });`,
  `const updates = { name: f.editName.value.trim(), jobTitle: f.editTitle.value.trim(), phone: f.editPhone.value.replace(/\\D/g, ''), pin, salary: nextSalary, status: f.editStatus.value, records: nextRecords };
                          if (window._tempCitizenship) { updates.citizenshipDoc = window._tempCitizenship; window._tempCitizenship = null; }
                          saveMember(updates);`
);

// Add Icon arrowLeft if it doesn't exist, well we can just use chevronLeft or x. Let's use chevronLeft.
// Wait, the icon "arrowLeft" might not exist in the Icon component. Let's use "chevronLeft" which does exist.
content = content.replace(`name: "arrowLeft"`, `name: "chevronLeft"`);

fs.writeFileSync('dist/app.js', content, 'utf8');
console.log('File patched successfully.');
