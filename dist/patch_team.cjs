const fs = require('fs');
let content = fs.readFileSync('dist/app.js', 'utf8');

// ============================================================
// PART 1: Replace the Team Management main block (profileTopic === 'team')
// From "TOPIC 5: TEAM MANAGEMENT" to just before "TOPIC 6: BRANDING"
// ============================================================
const teamBlockStart = content.indexOf('            // ==========================================\n            // TOPIC 5: TEAM MANAGEMENT');
const teamBlockEnd = content.indexOf('            // ==========================================\n            // TOPIC 6: BRANDING');
if (teamBlockStart === -1) { console.error('TEAM block start not found'); process.exit(1); }
if (teamBlockEnd === -1) { console.error('BRANDING block start not found'); process.exit(1); }

const newTeamBlock = `            // ==========================================
            // TOPIC 5: TEAM MANAGEMENT
            // ==========================================
            profileTopic === 'team' && (() => {
              const filteredTeam = team.filter(m => {
                if (!teamSearch.trim()) return true;
                const q = teamSearch.toLowerCase();
                return (m.name || '').toLowerCase().includes(q)
                  || (m.jobTitle || '').toLowerCase().includes(q)
                  || (m.phone || '').includes(q);
              });

              return h("div", { className: "space-y-5" }, [
                // Header
                h("div", { className: "flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200 pb-5" }, [
                  h("div", {}, [
                    h("div", { className: "mb-2 flex items-center gap-1.5 text-[11px] font-bold text-slate-400" }, [
                      h("button", { type: "button", onClick: () => setProfileTopic(null), className: "hover:text-indigo-600 cursor-pointer" }, "Settings"),
                      h("span", {}, ">"),
                      h("span", { className: "text-slate-600" }, "Team Management")
                    ]),
                    h("h1", { className: "text-2xl font-black tracking-tight text-slate-950" }, "Team Management"),
                    h("p", { className: "text-xs text-slate-500 mt-1" }, \`\${team.length} member\${team.length !== 1 ? 's' : ''} currently registered.\`)
                  ]),
                  h("button", {
                    type: "button",
                    onClick: () => setTeamExportModal(true),
                    className: "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition-all cursor-pointer"
                  }, [h(Icon, { name: "download", className: "w-3.5 h-3.5" }), "Export Team Records PDF"])
                ]),

                // Role Summary Cards
                roleList.length > 0 && h("div", { className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2.5" },
                  roleList.map(([role, count]) =>
                    h("div", { key: role, className: "p-3 rounded-xl border border-slate-200 bg-white shadow-2xs" }, [
                      h("span", { className: "block text-[9px] font-black uppercase tracking-widest text-slate-400 truncate" }, role),
                      h("span", { className: "block text-lg font-black text-slate-900 mt-0.5" }, count),
                      h("span", { className: "block text-[9px] text-slate-400 font-medium" }, \`member\${count !== 1 ? 's' : ''}\`)
                    ])
                  )
                ),

                // Search + Add Member
                h("div", { className: "flex items-center gap-2" }, [
                  h("div", { className: "relative flex-1" }, [
                    h("input", {
                      type: "text",
                      value: teamSearch,
                      onChange: e => setTeamSearch(e.target.value),
                      placeholder: "Search by name, role or phone...",
                      className: "w-full pl-8 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white shadow-2xs"
                    }),
                    h("span", { className: "absolute left-2.5 top-2.5 text-slate-400" }, h(Icon, { name: "search", className: "w-3.5 h-3.5" }))
                  ]),
                  h("button", {
                    type: "button",
                    onClick: () => setTeamAddModalOpen(true),
                    className: "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-xs transition-all cursor-pointer whitespace-nowrap"
                  }, [h(Icon, { name: "plus", className: "w-3.5 h-3.5" }), "+ Add Member"])
                ]),

                // Member Table
                h("div", { className: "bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden" }, [
                  teamActionMenuId && h("div", { className: "fixed inset-0 z-10 cursor-default", onClick: () => setTeamActionMenuId(null) }),
                  filteredTeam.length === 0
                    ? h("div", { className: "p-10 text-center text-slate-400 text-xs font-semibold" }, teamSearch ? "No members match your search." : "No team members yet. Click + Add Member to get started.")
                    : h("table", { className: "w-full text-left text-xs border-collapse" }, [
                        h("thead", { className: "bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500 select-none" }, [
                          h("tr", { className: "h-9" }, [
                            h("th", { className: "px-4 py-2 font-bold" }, "Member"),
                            h("th", { className: "px-3 py-2 font-bold" }, "Role"),
                            h("th", { className: "px-3 py-2 font-bold hidden sm:table-cell" }, "Phone"),
                            h("th", { className: "px-3 py-2 font-bold hidden md:table-cell" }, "Status"),
                            h("th", { className: "px-3 py-2 font-bold text-right" }, "Actions")
                          ])
                        ]),
                        h("tbody", { className: "divide-y divide-slate-100" },
                          filteredTeam.map(member => {
                            const isInactive = member.status === 'inactive';
                            return h("tr", {
                              key: member.id,
                              className: \`h-12 transition-colors \${isInactive ? 'opacity-50' : 'hover:bg-slate-50/70'}\`
                            }, [
                              // Member cell
                              h("td", { className: "px-4 py-2" }, [
                                h("div", { className: "flex items-center gap-2.5" }, [
                                  h("div", {
                                    className: \`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-black text-white shrink-0 uppercase shadow-2xs \${isInactive ? 'bg-slate-400' : 'bg-indigo-600'}\`
                                  }, member.name.slice(0, 2)),
                                  h("span", { className: "font-black text-slate-900 truncate max-w-[140px]" }, member.name)
                                ])
                              ]),
                              // Role cell
                              h("td", { className: "px-3 py-2" }, [
                                h("span", { className: "inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold" }, member.jobTitle || '—')
                              ]),
                              // Phone cell
                              h("td", { className: "px-3 py-2 text-slate-500 hidden sm:table-cell" }, member.phone || h("span", { className: "text-slate-300" }, "No phone")),
                              // Status cell
                              h("td", { className: "px-3 py-2 hidden md:table-cell" }, [
                                h("span", {
                                  className: \`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold \${isInactive ? 'bg-slate-100 text-slate-500' : 'bg-emerald-100 text-emerald-700'}\`
                                }, isInactive ? 'Inactive' : 'Active')
                              ]),
                              // Actions cell
                              h("td", { className: "px-3 py-2 text-right whitespace-nowrap relative" }, [
                                h("div", { className: "inline-flex items-center gap-1.5" }, [
                                  // Open Profile button
                                  h("button", {
                                    type: "button",
                                    onClick: () => { setSelectedTeam(member); setTeamProfileTab('info'); setTeamMemberEditMode(false); },
                                    className: "px-2.5 py-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 text-[11px] font-bold hover:bg-indigo-100 cursor-pointer"
                                  }, "Open Profile"),
                                  // ••• action menu
                                  h("div", { className: "relative" }, [
                                    h("button", {
                                      type: "button",
                                      onClick: e => { e.stopPropagation(); setTeamActionMenuId(teamActionMenuId === member.id ? null : member.id); },
                                      className: "inline-flex items-center justify-center w-7 h-7 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 cursor-pointer"
                                    }, h(Icon, { name: "moreHorizontal", className: "w-3.5 h-3.5" })),
                                    teamActionMenuId === member.id && h("div", {
                                      className: "absolute right-0 top-8 w-44 rounded-xl bg-white border border-slate-200 shadow-xl z-20 p-1 text-left animate-fade-in",
                                      onClick: e => e.stopPropagation()
                                    }, [
                                      h("button", { type: "button", onClick: () => { setTeamActionMenuId(null); setSelectedTeam(member); setTeamProfileTab('info'); setTeamMemberEditMode(false); }, className: "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2 cursor-pointer" }, [h(Icon, { name: "eye", className: "w-3 h-3" }), "Open Profile"]),
                                      h("button", { type: "button", onClick: () => { setTeamActionMenuId(null); setSelectedTeam(member); setTeamProfileTab('info'); setTeamMemberEditMode(true); }, className: "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer" }, [h(Icon, { name: "edit", className: "w-3 h-3" }), "Edit"]),
                                      h("button", {
                                        type: "button",
                                        onClick: () => {
                                          setTeamActionMenuId(null);
                                          const updated = { ...member, status: isInactive ? 'active' : 'inactive' };
                                          storageService.saveTeamMember(updated);
                                          refresh();
                                          showFeedback(\`\${member.name} \${isInactive ? 'activated' : 'deactivated'}.\`);
                                        },
                                        className: "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2 cursor-pointer"
                                      }, [h(Icon, { name: isInactive ? "check" : "pause", className: "w-3 h-3" }), isInactive ? "Activate" : "Deactivate"]),
                                      h("div", { className: "my-1 border-t border-slate-100" }),
                                      h("button", {
                                        type: "button",
                                        onClick: () => { setTeamActionMenuId(null); setTeamDeleteConfirm(member); },
                                        className: "w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                                      }, [h(Icon, { name: "trash", className: "w-3 h-3" }), "Delete"])
                                    ])
                                  ])
                                ])
                              ])
                            ]);
                          })
                        )
                      ])
                ]),

                // ADD MEMBER MODAL
                teamAddModalOpen && h("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" }, [
                  h("div", { className: "w-full max-w-md rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden" }, [
                    h("div", { className: "flex items-center justify-between px-5 py-4 border-b border-slate-100" }, [
                      h("h3", { className: "text-base font-black text-slate-900" }, "Add Team Member"),
                      h("button", { type: "button", onClick: () => setTeamAddModalOpen(false), className: "rounded-lg border border-slate-200 p-1.5 hover:bg-slate-50 cursor-pointer" }, h(Icon, { name: "x", className: "w-4 h-4 text-slate-500" }))
                    ]),
                    h("form", {
                      onSubmit: e => {
                        e.preventDefault();
                        const f = e.currentTarget;
                        const name = f.addMemberName.value.trim();
                        const jobTitle = f.addMemberTitle.value.trim();
                        const pin = f.addMemberPin.value.replace(/\\D/g, '');
                        const salary = Number(f.addMemberSalary.value || 0);
                        if (!name || !jobTitle) { alert('Name and Job Title are required.'); return; }
                        if (pin.length !== 6) { alert('Security PIN must be exactly 6 digits.'); return; }
                        if (salary < 0) { alert('Salary cannot be negative.'); return; }
                        storageService.saveTeamMember({
                          name,
                          jobTitle,
                          phone: f.addMemberPhone.value.replace(/\\D/g, ''),
                          salary,
                          pin,
                          status: f.addMemberStatus.value || 'active',
                          records: [], notes: [], attendance: []
                        });
                        setTeamAddModalOpen(false);
                        refresh();
                        showFeedback(\`✓ \${name} added to team!\`);
                        f.reset();
                      },
                      className: "p-5 space-y-3.5 text-xs"
                    }, [
                      h("div", { className: "grid grid-cols-2 gap-3" }, [
                        h("div", { className: "col-span-2" }, [
                          h("label", { className: "block font-bold uppercase text-slate-600 mb-1" }, "Full Name *"),
                          h("input", { name: "addMemberName", required: true, placeholder: "e.g. Ramesh Thapa", className: "w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none" })
                        ]),
                        h("div", { className: "col-span-2" }, [
                          h("label", { className: "block font-bold uppercase text-slate-600 mb-1" }, "Job Title *"),
                          h("input", { name: "addMemberTitle", required: true, placeholder: "e.g. Designer, Printer, Logistics", className: "w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none" })
                        ]),
                        h("div", {}, [
                          h("label", { className: "block font-bold uppercase text-slate-600 mb-1" }, "Phone Number"),
                          h("input", { name: "addMemberPhone", type: "tel", inputMode: "numeric", placeholder: "98XXXXXXXX", onInput: e => { e.currentTarget.value = e.currentTarget.value.replace(/\\D/g, ''); }, className: "w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" })
                        ]),
                        h("div", {}, [
                          h("label", { className: "block font-bold uppercase text-slate-600 mb-1" }, "Monthly Salary (Rs.)"),
                          h("input", { name: "addMemberSalary", type: "number", min: "0", placeholder: "35000", className: "w-full p-2.5 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none" })
                        ]),
                        h("div", {}, [
                          h("label", { className: "block font-bold uppercase text-slate-600 mb-1" }, "6-Digit Security PIN *"),
                          h("input", { name: "addMemberPin", type: "password", inputMode: "numeric", maxLength: 6, placeholder: "••••••", pattern: "[0-9]{6}", required: true, className: "w-full p-2.5 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none" })
                        ]),
                        h("div", {}, [
                          h("label", { className: "block font-bold uppercase text-slate-600 mb-1" }, "Status"),
                          h("select", { name: "addMemberStatus", defaultValue: "active", className: "w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer" }, [
                            h("option", { value: "active" }, "Active"),
                            h("option", { value: "inactive" }, "Inactive")
                          ])
                        ])
                      ]),
                      h("div", { className: "flex gap-2 pt-2 border-t border-slate-100" }, [
                        h("button", { type: "button", onClick: () => setTeamAddModalOpen(false), className: "flex-1 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer" }, "Cancel"),
                        h("button", { type: "submit", className: "flex-1 px-4 py-2 rounded-xl bg-indigo-600 text-xs font-black text-white hover:bg-indigo-700 shadow-sm cursor-pointer" }, "Add Member")
                      ])
                    ])
                  ])
                ]),

                // EXPORT MODAL
                teamExportModal && h("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" }, [
                  h("div", { className: "w-full max-w-xs rounded-2xl bg-white border border-slate-200 shadow-2xl p-5 space-y-4" }, [
                    h("h3", { className: "text-sm font-black text-slate-900" }, "Export Team Records PDF"),
                    h("p", { className: "text-xs text-slate-500" }, "Choose which records to export."),
                    h("div", { className: "space-y-2" }, [
                      h("button", { type: "button", onClick: () => { setTeamExportModal(false); openPdfPreview(storageService.exportTeamRecordPDF()); }, className: "w-full px-4 py-2.5 rounded-xl bg-indigo-600 text-xs font-black text-white hover:bg-indigo-700 cursor-pointer" }, "All Members"),
                      h("button", { type: "button", onClick: () => { setTeamExportModal(false); openPdfPreview(storageService.exportTeamRecordPDF(null, { activeOnly: true })); }, className: "w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer" }, "Active Members Only")
                    ]),
                    h("button", { type: "button", onClick: () => setTeamExportModal(false), className: "w-full text-xs font-bold text-slate-400 hover:text-slate-600 cursor-pointer pt-1" }, "Cancel")
                  ])
                ]),

                // DELETE CONFIRM MODAL
                teamDeleteConfirm && h("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-4" }, [
                  h("div", { className: "w-full max-w-sm rounded-2xl bg-white border border-slate-200 shadow-2xl p-6 space-y-4" }, [
                    h("div", { className: "flex items-center gap-3" }, [
                      h("div", { className: "w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0" }, h(Icon, { name: "trash", className: "w-4 h-4 text-rose-600" })),
                      h("h3", { className: "text-sm font-black text-slate-900" }, "Delete Team Member?")
                    ]),
                    h("p", { className: "text-xs text-slate-600" }, [
                      h("span", { className: "font-black" }, teamDeleteConfirm.name),
                      " will be removed from the active team. Existing historical job/production records will NOT be deleted."
                    ]),
                    h("div", { className: "rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-[10px] text-amber-800 font-semibold" }, "Historical records (jobs, designs, financial entries) are preserved and will still show the member name."),
                    h("div", { className: "flex gap-2 pt-1" }, [
                      h("button", { type: "button", onClick: () => setTeamDeleteConfirm(null), className: "flex-1 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer" }, "Cancel"),
                      h("button", {
                        type: "button",
                        onClick: () => {
                          storageService.deleteTeamMember(teamDeleteConfirm.id);
                          setTeamDeleteConfirm(null);
                          if (selectedTeam?.id === teamDeleteConfirm.id) setSelectedTeam(null);
                          refresh();
                          showFeedback(\`\${teamDeleteConfirm.name} removed from team.\`);
                        },
                        className: "flex-1 px-4 py-2 rounded-xl bg-rose-600 text-xs font-black text-white hover:bg-rose-700 cursor-pointer"
                      }, "Delete Member")
                    ])
                  ])
                ])
              ]);
            })(),

`;

content = content.slice(0, teamBlockStart) + newTeamBlock + content.slice(teamBlockEnd);
console.log('Part 1 done. New length:', content.length);

// ============================================================
// PART 2: Replace the member profile modal
// ============================================================
// Find the new positions after part 1
const profileStart = content.indexOf('      selectedTeam && (() => {');
const profileEnd = content.indexOf('      // ADD EXPENSE MODAL');
if (profileStart === -1) { console.error('Profile modal start not found'); process.exit(1); }
if (profileEnd === -1) { console.error('Before expense modal not found'); process.exit(1); }

const newProfileModal = `      selectedTeam && (() => {
        const member = team.find(item => item.id === selectedTeam.id) || selectedTeam;
        const records = [...(member.records || [])].sort((a,b) => String(b.date||'').localeCompare(String(a.date||'')) || String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
        const notes = [...(member.notes || [])].sort((a,b) => String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
        const attendance = member.attendance || [];
        const isInactive = member.status === 'inactive';
        const saveMember = (changes) => { const saved = storageService.saveTeamMember({...member, ...changes}); if(saved){ setSelectedTeam(saved); refresh(); } return saved; };

        // Attendance helpers
        const [attYear, attMonth] = teamAttendanceMonth.split('-').map(Number);
        const daysInMonth = new Date(attYear, attMonth, 0).getDate();
        const monthAttendance = attendance.filter(a => String(a.date || '').startsWith(teamAttendanceMonth));
        const attSummary = { Present: 0, Absent: 0, Leave: 0, 'Half Day': 0 };
        monthAttendance.forEach(a => { if (attSummary[a.status] !== undefined) attSummary[a.status]++; });

        // Salary helpers
        const salaryRecords = records.filter(r => r.type === 'Salary Payment');
        const lastSalaryRecord = salaryRecords[0];
        const borrowedAmt = Number(member.borrowed || 0);
        const salaryAfterBorrow = Math.max(0, Number(member.salary || 0) - borrowedAmt);

        const tabList = [
          { id: 'info',       label: 'Profile Info' },
          { id: 'salary',     label: 'Salary & Records' },
          { id: 'attendance', label: 'Attendance' },
          { id: 'notes',      label: 'Notes' }
        ];

        return h("div", {
          key: "teamprofilemodal",
          className: "fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-950/70 backdrop-blur-sm",
          onMouseDown: e => { if (e.target === e.currentTarget) { setSelectedTeam(null); setTeamMemberEditMode(false); } }
        }, [
          h("div", {
            role: "dialog", "aria-modal": "true", "aria-label": member.name + " profile",
            className: "w-full sm:max-w-3xl max-h-[96vh] sm:max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-slate-200 bg-slate-50 shadow-2xl flex flex-col"
          }, [
            // ── HEADER ──────────────────────────────────────────────────
            h("div", { className: "sticky top-0 z-10 bg-gradient-to-r from-slate-950 via-indigo-950 to-indigo-800 px-5 py-4 text-white rounded-t-3xl sm:rounded-t-3xl shrink-0" }, [
              h("div", { className: "flex items-start justify-between gap-3" }, [
                h("div", { className: "flex items-center gap-3" }, [
                  h("div", { className: "flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15 text-base font-black ring-1 ring-white/20 shrink-0" }, member.name.slice(0,2).toUpperCase()),
                  h("div", {}, [
                    h("h2", { className: "text-lg font-black leading-tight" }, member.name),
                    h("p", { className: "text-xs text-indigo-200 font-semibold" }, member.jobTitle),
                    h("div", { className: "mt-1 flex items-center gap-2 flex-wrap" }, [
                      h("span", { className: \`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black \${isInactive ? 'bg-slate-600 text-slate-200' : 'bg-emerald-500/30 text-emerald-200'}\` }, isInactive ? 'Inactive' : 'Active'),
                      member.createdAt && h("span", { className: "text-[10px] text-indigo-300 font-semibold" }, \`Joined: \${storageService.displayDate(member.createdAt.slice(0,10))}\`)
                    ])
                  ])
                ]),
                h("div", { className: "flex items-center gap-1.5 shrink-0" }, [
                  h("button", { type: "button", onClick: () => { const r = storageService.exportTeamRecordPDF(member); if(r) openPdfPreview(r); }, className: "hidden sm:inline-flex h-8 items-center gap-1.5 rounded-xl bg-white/10 px-2.5 text-xs font-bold text-white hover:bg-white/20 cursor-pointer" }, [h(Icon, { name: "download", className: "w-3.5 h-3.5" }), "PDF"]),
                  h("button", { type: "button", onClick: () => { setSelectedTeam(null); setTeamMemberEditMode(false); setTeamProfileTab('info'); }, className: "flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 cursor-pointer", "aria-label": "Close" }, h(Icon, { name: "x", className: "w-4 h-4" }))
                ])
              ]),
              // TABS
              h("div", { className: "mt-3 flex gap-1 overflow-x-auto" },
                tabList.map(tab =>
                  h("button", {
                    key: tab.id, type: "button",
                    onClick: () => setTeamProfileTab(tab.id),
                    className: \`px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap cursor-pointer transition-all \${teamProfileTab === tab.id ? 'bg-white text-indigo-700 shadow-xs' : 'text-indigo-200 hover:bg-white/10'}\`
                  }, tab.label)
                )
              )
            ]),

            // ── TAB CONTENT ─────────────────────────────────────────────
            h("div", { className: "flex-1 p-4 space-y-4 overflow-y-auto min-h-0" }, [

              // ── PROFILE INFO TAB ────────────────────────────────────
              teamProfileTab === 'info' && h("div", { className: "space-y-4" }, [
                h("div", { className: "bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden" }, [
                  h("div", { className: "flex items-center justify-between px-4 py-3 border-b border-slate-100" }, [
                    h("h3", { className: "font-black text-slate-900 text-sm" }, "Profile Information"),
                    !teamMemberEditMode
                      ? h("button", { type: "button", onClick: () => setTeamMemberEditMode(true), className: "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer" }, [h(Icon, { name: "edit", className: "w-3.5 h-3.5" }), "Edit"])
                      : null
                  ]),
                  teamMemberEditMode
                    ? h("form", {
                        onSubmit: e => {
                          e.preventDefault();
                          const f = e.currentTarget;
                          const pin = f.editPin.value.replace(/\\D/g, '');
                          if (pin.length !== 6) { alert('PIN must be exactly 6 digits.'); return; }
                          const nextSalary = Math.max(0, Number(f.editSalary.value || 0));
                          const oldSalary = Number(member.salary || 0);
                          const nextRecords = [...(member.records || [])];
                          if (nextSalary !== oldSalary) nextRecords.push({ id: createId('teamrec'), type: 'Salary Updated', date: todayStr, amount: nextSalary, note: \`Changed from \${storageService.formatCurrency(oldSalary)}\`, createdAt: new Date().toISOString() });
                          saveMember({ name: f.editName.value.trim(), jobTitle: f.editTitle.value.trim(), phone: f.editPhone.value.replace(/\\D/g, ''), pin, salary: nextSalary, status: f.editStatus.value, records: nextRecords });
                          setTeamMemberEditMode(false);
                          showFeedback('✓ Profile updated.');
                        },
                        className: "p-4 space-y-3 text-xs"
                      }, [
                        h("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-3" }, [
                          h("div", {}, [h("label", { className: "block font-bold uppercase text-slate-600 mb-1" }, "Full Name *"), h("input", { name: "editName", required: true, defaultValue: member.name, className: "w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none" })]),
                          h("div", {}, [h("label", { className: "block font-bold uppercase text-slate-600 mb-1" }, "Job Title *"), h("input", { name: "editTitle", required: true, defaultValue: member.jobTitle, className: "w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none" })]),
                          h("div", {}, [h("label", { className: "block font-bold uppercase text-slate-600 mb-1" }, "Phone Number"), h("input", { name: "editPhone", type: "tel", inputMode: "numeric", defaultValue: member.phone || '', onInput: e => { e.currentTarget.value = e.currentTarget.value.replace(/\\D/g, ''); }, className: "w-full p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" })]),
                          h("div", {}, [h("label", { className: "block font-bold uppercase text-slate-600 mb-1" }, "Monthly Salary (Rs.)"), h("input", { name: "editSalary", type: "number", min: "0", defaultValue: Number(member.salary || 0), className: "w-full p-2.5 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none" })]),
                          h("div", {}, [h("label", { className: "block font-bold uppercase text-slate-600 mb-1" }, "Security PIN (6 digits)"), h("input", { name: "editPin", type: "password", inputMode: "numeric", maxLength: 6, defaultValue: member.pin || '', className: "w-full p-2.5 border border-slate-200 rounded-xl text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none" })]),
                          h("div", {}, [h("label", { className: "block font-bold uppercase text-slate-600 mb-1" }, "Status"), h("select", { name: "editStatus", defaultValue: member.status || 'active', className: "w-full p-2.5 border border-slate-200 rounded-xl text-xs font-bold bg-white focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer" }, [h("option", { value: "active" }, "Active"), h("option", { value: "inactive" }, "Inactive")])])
                        ]),
                        h("div", { className: "flex gap-2 pt-1 border-t border-slate-100" }, [
                          h("button", { type: "button", onClick: () => setTeamMemberEditMode(false), className: "flex-1 px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer" }, "Cancel"),
                          h("button", { type: "submit", className: "flex-1 px-4 py-2 rounded-xl bg-indigo-600 text-xs font-black text-white hover:bg-indigo-700 cursor-pointer" }, "Save Changes")
                        ])
                      ])
                    : h("div", { className: "p-4 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs" }, [
                        ...[
                          ['Full Name', member.name],
                          ['Job Title', member.jobTitle],
                          ['Phone Number', member.phone || 'Not set'],
                          ['Security PIN', member.pin ? '••••••' : 'Not set'],
                          ['Account Status', isInactive ? 'Inactive' : 'Active'],
                          ['Join Date', member.createdAt ? storageService.displayDate(member.createdAt.slice(0,10)) : 'Unknown']
                        ].map(([label, value]) =>
                          h("div", { key: label, className: "flex flex-col gap-0.5 border-b border-slate-100 pb-2" }, [
                            h("span", { className: "text-[9px] font-black uppercase tracking-wider text-slate-400" }, label),
                            h("span", { className: "font-bold text-slate-800" }, value)
                          ])
                        )
                      ])
                ]),

                // Delete button inside profile
                h("div", { className: "pt-2" }, [
                  h("button", {
                    type: "button",
                    onClick: () => setTeamDeleteConfirm(member),
                    className: "inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 text-xs font-black hover:bg-rose-100 cursor-pointer"
                  }, [h(Icon, { name: "trash", className: "w-3.5 h-3.5" }), "Delete Member"])
                ])
              ]),

              // ── SALARY & RECORDS TAB ───────────────────────────────
              teamProfileTab === 'salary' && h("div", { className: "space-y-4" }, [
                // Salary summary cards
                h("div", { className: "grid grid-cols-2 lg:grid-cols-4 gap-2.5" }, [
                  h("div", { className: "rounded-xl border border-emerald-200 bg-emerald-50 p-3" }, [h("div", { className: "text-[9px] font-black uppercase text-emerald-700" }, "Monthly Salary"), h("div", { className: "mt-1 font-mono text-base font-black text-emerald-800" }, storageService.formatCurrency(member.salary || 0))]),
                  h("div", { className: "rounded-xl border border-rose-200 bg-rose-50 p-3" }, [h("div", { className: "text-[9px] font-black uppercase text-rose-700" }, "Outstanding Borrow"), h("div", { className: "mt-1 font-mono text-base font-black text-rose-800" }, storageService.formatCurrency(borrowedAmt))]),
                  h("div", { className: "rounded-xl border border-indigo-200 bg-indigo-50 p-3" }, [h("div", { className: "text-[9px] font-black uppercase text-indigo-700" }, "Salary After Borrow"), h("div", { className: "mt-1 font-mono text-base font-black text-indigo-800" }, storageService.formatCurrency(salaryAfterBorrow))]),
                  h("div", { className: "rounded-xl border border-slate-200 bg-white p-3" }, [h("div", { className: "text-[9px] font-black uppercase text-slate-500" }, "Last Payment"), h("div", { className: "mt-1 text-xs font-black text-slate-800" }, lastSalaryRecord ? storageService.displayDate(lastSalaryRecord.date) : 'None')])
                ]),
                // Add record form
                h("form", {
                  onSubmit: e => {
                    e.preventDefault();
                    const f = e.currentTarget;
                    const type = f.recType.value;
                    const amount = Math.max(0, Number(f.recAmount.value || 0));
                    if (amount <= 0) { alert('Please enter a valid amount.'); return; }
                    const record = { id: createId('teamrec'), type, date: f.recDate.value || todayStr, amount, note: f.recNote.value.trim(), createdAt: new Date().toISOString() };
                    let borrowed = Number(member.borrowed || 0);
                    if (type === 'Borrowed') borrowed += amount;
                    if (type === 'Repayment') borrowed = Math.max(0, borrowed - amount);
                    const saved = saveMember({ borrowed, records: [...(member.records || []), record] });
                    if (saved) { f.reset(); showFeedback('✓ Record added.'); }
                  },
                  className: "bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-3"
                }, [
                  h("div", { className: "flex items-center justify-between" }, [h("h4", { className: "text-xs font-black text-slate-900" }, "Add Salary / Borrow / Leave Record"), null]),
                  h("div", { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_130px_140px_1.5fr_auto] gap-2" }, [
                    h("select", { name: "recType", className: "rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer" }, [
                      h("option", { value: "Salary Payment" }, "Salary Payment"),
                      h("option", { value: "Borrowed" }, "Money Borrowed / Advance"),
                      h("option", { value: "Repayment" }, "Borrow Repayment"),
                      h("option", { value: "Leave" }, "Leave")
                    ]),
                    h("input", { name: "recDate", type: "date", defaultValue: todayStr, required: true, className: "rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none" }),
                    h("input", { name: "recAmount", type: "number", min: "0.01", step: "0.01", required: true, placeholder: "Amount / days", className: "rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none" }),
                    h("input", { name: "recNote", placeholder: "Note or reason", className: "rounded-xl border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" }),
                    h("button", { type: "submit", className: "px-4 py-2 rounded-xl bg-indigo-600 text-xs font-black text-white hover:bg-indigo-700 cursor-pointer whitespace-nowrap" }, "Add Record")
                  ])
                ]),
                // Record history table
                h("div", { className: "bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden" }, [
                  h("div", { className: "px-4 py-3 border-b border-slate-100 flex items-center justify-between" }, [
                    h("h4", { className: "text-xs font-black text-slate-900" }, "Payment History"),
                    h("span", { className: "text-[10px] text-slate-400 font-semibold" }, \`\${records.length} record\${records.length !== 1 ? 's' : ''}\`)
                  ]),
                  records.length === 0
                    ? h("div", { className: "p-8 text-center text-xs text-slate-400 font-semibold" }, "No salary or borrow records yet.")
                    : h("div", { className: "overflow-x-auto" }, h("table", { className: "w-full text-left text-xs border-collapse min-w-[500px]" }, [
                        h("thead", { className: "bg-slate-50 border-b border-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-500" }, [
                          h("tr", { className: "h-8" }, [
                            h("th", { className: "px-3 py-2 font-bold" }, "Date"),
                            h("th", { className: "px-3 py-2 font-bold" }, "Type"),
                            h("th", { className: "px-3 py-2 text-right font-bold" }, "Amount / Days"),
                            h("th", { className: "px-3 py-2 font-bold" }, "Notes")
                          ])
                        ]),
                        h("tbody", { className: "divide-y divide-slate-100" }, records.map(rec =>
                          h("tr", { key: rec.id, className: "h-9 hover:bg-slate-50" }, [
                            h("td", { className: "px-3 py-2 font-mono font-bold text-slate-700" }, storageService.displayDate(rec.date)),
                            h("td", { className: "px-3 py-2" }, [
                              h("span", { className: \`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold \${rec.type === 'Salary Payment' ? 'bg-emerald-100 text-emerald-700' : rec.type === 'Borrowed' ? 'bg-rose-100 text-rose-700' : rec.type === 'Repayment' ? 'bg-indigo-100 text-indigo-700' : rec.type === 'Leave' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}\` }, rec.type)
                            ]),
                            h("td", { className: "px-3 py-2 text-right font-mono font-black text-slate-900" }, rec.type === 'Leave' ? \`\${rec.amount} day\${Number(rec.amount) === 1 ? '' : 's'}\` : storageService.formatCurrency(rec.amount)),
                            h("td", { className: "px-3 py-2 text-slate-500" }, rec.note || '—')
                          ])
                        ))
                      ]))
                ])
              ]),

              // ── ATTENDANCE TAB ──────────────────────────────────────
              teamProfileTab === 'attendance' && h("div", { className: "space-y-4" }, [
                // Month selector + summary
                h("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs" }, [
                  h("div", {}, [
                    h("label", { className: "block text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1" }, "Month"),
                    h("input", { type: "month", value: teamAttendanceMonth, onChange: e => setTeamAttendanceMonth(e.target.value), className: "border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer" })
                  ]),
                  h("div", { className: "flex items-center gap-3 flex-wrap" }, [
                    { label: 'Present', count: attSummary.Present, color: 'emerald' },
                    { label: 'Absent', count: attSummary.Absent, color: 'rose' },
                    { label: 'Leave', count: attSummary.Leave, color: 'amber' },
                    { label: 'Half Day', count: attSummary['Half Day'], color: 'violet' }
                  ].map(({ label, count, color }) =>
                    h("div", { key: label, className: \`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-\${color}-50 border border-\${color}-200\` }, [
                      h("span", { className: \`text-\${color}-700 font-black text-sm\` }, count),
                      h("span", { className: \`text-\${color}-600 text-[10px] font-bold\` }, label)
                    ])
                  ))
                ]),
                // Add attendance record form
                h("form", {
                  onSubmit: e => {
                    e.preventDefault();
                    const f = e.currentTarget;
                    const date = f.attDate.value;
                    if (!date) { alert('Please select a date.'); return; }
                    const existing = attendance.filter(a => a.date !== date);
                    const newEntry = { date, status: f.attStatus.value, checkIn: f.attCheckIn.value || '', checkOut: f.attCheckOut.value || '', note: f.attNote.value.trim() };
                    saveMember({ attendance: [...existing, newEntry] });
                    showFeedback('✓ Attendance recorded.');
                    f.reset();
                  },
                  className: "bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs"
                }, [
                  h("h4", { className: "text-xs font-black text-slate-900 mb-3" }, "Mark Attendance"),
                  h("div", { className: "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2" }, [
                    h("input", { name: "attDate", type: "date", required: true, defaultValue: todayStr, className: "rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold col-span-1 focus:ring-2 focus:ring-indigo-500 focus:outline-none" }),
                    h("select", { name: "attStatus", defaultValue: "Present", className: "rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer" }, [
                      h("option", { value: "Present" }, "Present"),
                      h("option", { value: "Absent" }, "Absent"),
                      h("option", { value: "Leave" }, "Leave"),
                      h("option", { value: "Half Day" }, "Half Day")
                    ]),
                    h("input", { name: "attCheckIn", type: "time", placeholder: "Check In", className: "rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none" }),
                    h("input", { name: "attCheckOut", type: "time", placeholder: "Check Out", className: "rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none" }),
                    h("input", { name: "attNote", placeholder: "Note", className: "rounded-xl border border-slate-200 px-3 py-2 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none" }),
                    h("button", { type: "submit", className: "rounded-xl bg-indigo-600 px-3 py-2 text-xs font-black text-white hover:bg-indigo-700 cursor-pointer" }, "Save")
                  ])
                ]),
                // Attendance records table for the selected month
                h("div", { className: "bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden" }, [
                  h("div", { className: "px-4 py-3 border-b border-slate-100" }, [
                    h("h4", { className: "text-xs font-black text-slate-900" }, \`Attendance — \${new Date(attYear, attMonth - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}\`)
                  ]),
                  monthAttendance.length === 0
                    ? h("div", { className: "p-8 text-center text-xs text-slate-400 font-semibold" }, "No attendance records for this month.")
                    : h("div", { className: "overflow-x-auto" }, h("table", { className: "w-full text-left text-xs border-collapse min-w-[400px]" }, [
                        h("thead", { className: "bg-slate-50 border-b border-slate-100 text-[9px] font-black uppercase tracking-wider text-slate-500" }, [
                          h("tr", { className: "h-8" }, [
                            h("th", { className: "px-3 py-2 font-bold" }, "Date"),
                            h("th", { className: "px-3 py-2 font-bold" }, "Status"),
                            h("th", { className: "px-3 py-2 font-bold" }, "Check In"),
                            h("th", { className: "px-3 py-2 font-bold" }, "Check Out"),
                            h("th", { className: "px-3 py-2 font-bold" }, "Note")
                          ])
                        ]),
                        h("tbody", { className: "divide-y divide-slate-100" },
                          [...monthAttendance].sort((a,b) => String(a.date).localeCompare(String(b.date))).map(att =>
                            h("tr", { key: att.date, className: "h-9 hover:bg-slate-50" }, [
                              h("td", { className: "px-3 py-2 font-mono font-bold text-slate-700" }, storageService.displayDate(att.date)),
                              h("td", { className: "px-3 py-2" }, [
                                h("span", { className: \`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold \${att.status === 'Present' ? 'bg-emerald-100 text-emerald-700' : att.status === 'Absent' ? 'bg-rose-100 text-rose-700' : att.status === 'Leave' ? 'bg-amber-100 text-amber-700' : 'bg-violet-100 text-violet-700'}\` }, att.status)
                              ]),
                              h("td", { className: "px-3 py-2 text-slate-600" }, att.checkIn || '—'),
                              h("td", { className: "px-3 py-2 text-slate-600" }, att.checkOut || '—'),
                              h("td", { className: "px-3 py-2 text-slate-500" }, att.note || '—')
                            ])
                          )
                        )
                      ]))
                ])
              ]),

              // ── NOTES TAB ───────────────────────────────────────────
              teamProfileTab === 'notes' && h("div", { className: "space-y-4" }, [
                h("form", {
                  onSubmit: e => {
                    e.preventDefault();
                    const f = e.currentTarget;
                    const text = f.noteText.value.trim();
                    if (!text) return;
                    const newNote = { id: createId('note'), text, createdAt: new Date().toISOString() };
                    saveMember({ notes: [...(member.notes || []), newNote] });
                    showFeedback('✓ Note added.');
                    f.reset();
                  },
                  className: "bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs space-y-2"
                }, [
                  h("h4", { className: "text-xs font-black text-slate-900" }, "Add Note"),
                  h("textarea", { name: "noteText", rows: 3, placeholder: "Write an internal note about this team member...", required: true, className: "w-full p-3 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none" }),
                  h("div", { className: "flex justify-end" }, [
                    h("button", { type: "submit", className: "px-4 py-2 rounded-xl bg-indigo-600 text-xs font-black text-white hover:bg-indigo-700 cursor-pointer" }, "+ Add Note")
                  ])
                ]),
                notes.length === 0
                  ? h("div", { className: "bg-white rounded-xl border border-dashed border-slate-200 p-8 text-center text-xs text-slate-400 font-semibold" }, "No notes yet. Add your first internal note above.")
                  : h("div", { className: "space-y-2.5" }, notes.map(note =>
                      h("div", { key: note.id, className: "bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5" }, [
                        h("div", { className: "flex items-start justify-between gap-2" }, [
                          h("p", { className: "text-xs text-slate-800 font-medium leading-relaxed flex-1" }, note.text),
                          h("button", {
                            type: "button",
                            title: "Delete note",
                            onClick: () => saveMember({ notes: (member.notes || []).filter(n => n.id !== note.id) }),
                            className: "shrink-0 text-slate-300 hover:text-rose-500 cursor-pointer p-0.5 mt-0.5"
                          }, h(Icon, { name: "x", className: "w-3 h-3" }))
                        ]),
                        h("div", { className: "mt-1.5 text-[10px] text-slate-400 font-semibold" }, new Date(note.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }))
                      ])
                    ))
              ])

            ]) // end tab content
          ]) // end dialog div
        ]); // end return
      })(),

`;

content = content.slice(0, profileStart) + newProfileModal + content.slice(profileEnd);
console.log('Part 2 done. New length:', content.length);

fs.writeFileSync('dist/app.js', content, 'utf8');
console.log('File written successfully.');
