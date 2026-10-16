import React, { useState, useEffect, useCallback } from 'react';
import { AppSettings, FinancialLedgerData } from '../types';
import { storageService } from '../services/storageService';
import { apiService } from '../services/apiService';
import { 
  Building2, 
  Wallet, 
  Receipt, 
  MessageSquare, 
  Users, 
  Sparkles, 
  Calendar, 
  Clock, 
  ChevronRight, 
  ArrowLeft, 
  CheckCircle2, 
  Keyboard,
  Download,
  Search,
  X,
  Cloud,
  Upload,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  FileText,
  TrendingUp
} from 'lucide-react';

interface FinancialSettingsTopicProps {
  settings: AppSettings;
  setSettings: React.Dispatch<React.SetStateAction<AppSettings>>;
  triggerFeedback: (msg: string) => void;
}

const FinancialSettingsTopic: React.FC<FinancialSettingsTopicProps> = ({
  settings,
  setSettings,
  triggerFeedback
}) => {
  const [financialSubTab, setFinancialSubTab] = useState<'ledger' | 'summary' | 'expenses' | 'credit' | 'opening'>('ledger');
  const [financialLedgerMonth, setFinancialLedgerMonth] = useState<string>('');
  const [financialSearch, setFinancialSearch] = useState<string>('');
  const [financialTypeFilter, setFinancialTypeFilter] = useState<'ALL' | 'JOB' | 'EXPENSE' | 'PAYMENT'>('ALL');
  const [financialDesignerFilter, setFinancialDesignerFilter] = useState<string>('ALL');
  const [financialExportModal, setFinancialExportModal] = useState<{ dateMode: 'AD' | 'BS'; fromInput: string; toInput: string; error?: string; isWorking?: boolean } | null>(null);
  const [financialLedgerPreview, setFinancialLedgerPreview] = useState<{ url: string; filename: string; blob?: Blob; fromDate?: string; toDate?: string } | null>(null);
  const [isEditingOpeningBalance, setIsEditingOpeningBalance] = useState<boolean>(false);
  const [openingBalanceInput, setOpeningBalanceInput] = useState<string>('');
  const [openingBankBalanceInput, setOpeningBankBalanceInput] = useState<string>('');
  const [isArchivingLedger, setIsArchivingLedger] = useState<boolean>(false);
  const [archivedCloudinaryUrl, setArchivedCloudinaryUrl] = useState<string | null>(null);

  const [ledgerData, setLedgerData] = useState<FinancialLedgerData>({
    allEntries: [],
    visibleEntries: [],
    periodOpeningBalance: 0,
    totalJobIncome: 0,
    totalReceivedCredit: 0,
    totalExpenses: 0,
    totalStocking: 0,
    totalInflow: 0,
    totalOutflow: 0,
    netCash: 0,
    currentBalance: 0,
    designers: [],
  });
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  const fetchLedger = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [data, expenses] = await Promise.all([
        storageService.getFinancialLedgerData({
          month: financialLedgerMonth,
          search: financialSearch,
          typeFilter: financialTypeFilter,
          designerFilter: financialDesignerFilter,
          dateMode: settings.dateMode
        }),
        storageService.getExpenses()
      ]);
      setLedgerData(data);

      const dates = storageService.getOrders().map(o => o.orderDate).concat(expenses.map(e => e.date)).filter(Boolean);
      const set = new Set<string>();
      dates.forEach(d => {
        const monthKey = settings.dateMode === 'BS' ? (storageService as any).getADandBSDate(d).bsFormatted.slice(0, 7) : d.slice(0, 7);
        if (monthKey) set.add(monthKey);
      });
      const todayKey = new Date().toISOString().split('T')[0];
      const curr = settings.dateMode === 'BS' ? (storageService as any).getADandBSDate(todayKey).bsFormatted.slice(0, 7) : todayKey.slice(0, 7);
      set.add(curr);
      setAvailableMonths(Array.from(set).sort().reverse());
    } catch (err: any) {
      console.error('Failed to load financial ledger:', err);
      setError(err?.message || 'Failed to load financial ledger data. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [financialLedgerMonth, financialSearch, financialTypeFilter, financialDesignerFilter, settings.dateMode, reloadKey]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  const formatMonthName = (monthKey: string) => {
    if (!monthKey) return 'All Months';
    const parts = monthKey.split('-');
    if (parts.length !== 2) return monthKey;
    const year = parts[0];
    const m = parseInt(parts[1], 10);
    if (settings.dateMode === 'BS') {
      const bsNames = ['Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];
      return `${bsNames[m - 1] || 'Month ' + m} ${year} (${monthKey})`;
    } else {
      const adNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      return `${adNames[m - 1] || 'Month ' + m} ${year}`;
    }
  };

  const openFinancialExportModal = () => {
    const today = new Date().toISOString().split('T')[0];
    const dateMode = settings.dateMode || 'AD';
    const todayInput = typeof (storageService as any).dateInputValueForMode === 'function' 
      ? (storageService as any).dateInputValueForMode(today, dateMode)
      : today;
    const monthStartInput = `${todayInput.slice(0, 8)}01`;
    setFinancialExportModal({ dateMode, fromInput: monthStartInput, toInput: todayInput, error: '', isWorking: false });
  };

  const generateFinancialLedgerExport = async () => {
    if (!financialExportModal || financialExportModal.isWorking) return;
    const dateMode = financialExportModal.dateMode || settings.dateMode || 'AD';
    const fromDate = typeof (storageService as any).dateInputToADForMode === 'function' 
      ? (storageService as any).dateInputToADForMode(financialExportModal.fromInput, dateMode)
      : financialExportModal.fromInput;
    const toDate = typeof (storageService as any).dateInputToADForMode === 'function'
      ? (storageService as any).dateInputToADForMode(financialExportModal.toInput, dateMode)
      : financialExportModal.toInput;
    if (!fromDate || !toDate) { setFinancialExportModal(current => current ? ({ ...current, error: 'Choose both From and To dates.' }) : null); return; }
    if (fromDate > toDate) { setFinancialExportModal(current => current ? ({ ...current, error: 'From date cannot be after To date.' }) : null); return; }
    setFinancialExportModal(current => current ? ({ ...current, isWorking: true, error: '' }) : null);
    try {
      const generated = await storageService.createFinancialLedgerPdf({ fromDate, toDate, dateMode });
      const url = URL.createObjectURL(generated.blob);
      setFinancialLedgerPreview({ ...generated, url });
      setFinancialExportModal(null);
    } catch (error: any) {
      setFinancialExportModal(current => current ? ({ ...current, isWorking: false, error: error.message || 'Unable to generate ledger PDF.' }) : null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Error banner with retry */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-rose-600 font-extrabold">Error:</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey(k => k + 1)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-rose-300 text-rose-700 text-xs font-black hover:bg-rose-100 cursor-pointer shadow-2xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      )}

      {/* Header: Title & Month Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Wallet className="w-5 h-5 text-indigo-600" />
            <span>Financial Settings & Statement</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Detailed ledger, breakdown, expenses, and credit collections for accounting reconciliation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-500">Statement Period:</label>
          <select
            value={financialLedgerMonth}
            onChange={(e) => setFinancialLedgerMonth(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-slate-50 text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">All Recorded Periods</option>
            {availableMonths.map(m => (
              <option key={m} value={m}>{formatMonthName(m)}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        {[
          { id: 'ledger', label: '14-Column Ledger', icon: FileText },
          { id: 'summary', label: 'Monthly Summary', icon: Sparkles },
          { id: 'expenses', label: 'Period Expenses', icon: Receipt },
          { id: 'credit', label: 'Received Credit', icon: TrendingUp },
          { id: 'opening', label: 'Opening Balance', icon: Wallet }
        ].map(tab => {
          const TabIcon = tab.icon;
          const isActive = financialSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFinancialSubTab(tab.id as any)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <TabIcon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* SUB-TAB 1: 14-COLUMN LEDGER */}
      {financialSubTab === 'ledger' && (
        <div className="space-y-4">
          {/* Toolbar: Search, Filters & Export */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={financialSearch}
                  onChange={(e) => setFinancialSearch(e.target.value)}
                  placeholder="Search party name, job #, item details, vendor, designer…"
                  className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                {financialSearch && (
                  <button
                    type="button"
                    onClick={() => setFinancialSearch('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={financialTypeFilter}
                  onChange={(e) => setFinancialTypeFilter(e.target.value as any)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="ALL">All Transaction Types</option>
                  <option value="JOB">Job Inflow</option>
                  <option value="PAYMENT">Received Credit</option>
                  <option value="EXPENSE">Expenses Outflow</option>
                </select>

                <select
                  value={financialDesignerFilter}
                  onChange={(e) => setFinancialDesignerFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  <option value="ALL">All Designers</option>
                  {ledgerData.designers.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await storageService.exportFinancialLedgerCSV({
                        month: financialLedgerMonth,
                        typeFilter: financialTypeFilter,
                        designerFilter: financialDesignerFilter,
                        search: financialSearch,
                        dateMode: settings.dateMode
                      });
                      triggerFeedback('✓ Financial transactions exported to CSV!');
                    } catch (err: any) {
                      alert(err.message || 'Export failed');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold border border-slate-200 shadow-2xs transition-all cursor-pointer"
                  title="Download CSV spreadsheet"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  CSV
                </button>

                <button
                  type="button"
                  onClick={openFinancialExportModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-sm transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export PDF
                </button>
              </div>
            </div>
          </div>

          {/* 14-Column Ledger Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto max-h-[580px]">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-50 sticky top-0 z-10 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="p-2.5 text-center w-10">S.N.</th>
                    <th className="p-2.5">Date</th>
                    <th className="p-2.5">Ready Date</th>
                    <th className="p-2.5">Job No.</th>
                    <th className="p-2.5">Party Name</th>
                    <th className="p-2.5 min-w-[140px]">Details</th>
                    <th className="p-2.5">Payment</th>
                    <th className="p-2.5">Designer</th>
                    <th className="p-2.5">Printing</th>
                    <th className="p-2.5">Mistake By</th>
                    <th className="p-2.5 text-right text-rose-700">Dr Amount</th>
                    <th className="p-2.5 text-right text-emerald-700">Cr Amount</th>
                    <th className="p-2.5 text-right text-violet-700">Received Credit</th>
                    <th className="p-2.5 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={14} className="text-center py-10 text-slate-500 font-medium">
                        <div className="flex items-center justify-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                          <span>Loading financial ledger data from server...</span>
                        </div>
                      </td>
                    </tr>
                  ) : error ? (
                    <tr>
                      <td colSpan={14} className="text-center py-10 text-rose-600 font-medium">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <span>{error}</span>
                          <button
                            type="button"
                            onClick={() => setReloadKey(k => k + 1)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold hover:bg-rose-100"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            Retry
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : ledgerData.visibleEntries.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="text-center py-10 text-slate-400 font-medium">
                        No financial ledger entries found for the selected criteria.
                      </td>
                    </tr>
                  ) : (
                    ledgerData.visibleEntries.map((entry, idx) => {
                      const isExp = entry.type === 'expense';
                      const isPay = entry.type === 'payment';
                      return (
                        <tr key={entry.id} className={`hover:bg-slate-50 transition-colors ${isExp ? 'bg-rose-50/20' : isPay ? 'bg-violet-50/20' : ''}`}>
                          <td className="p-2.5 text-center font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-2.5 font-bold text-slate-700 whitespace-nowrap">{(storageService as any).formatDateForMode(entry.date, settings.dateMode)}</td>
                          <td className="p-2.5 text-slate-500 whitespace-nowrap">{entry.readyDate ? (storageService as any).formatDateForMode(entry.readyDate, settings.dateMode) : '—'}</td>
                          <td className="p-2.5 font-mono font-bold text-indigo-600 whitespace-nowrap">{entry.jobNo}</td>
                          <td className="p-2.5 font-bold text-slate-900 max-w-[150px] truncate">{entry.partyName}</td>
                          <td className="p-2.5 text-slate-600 max-w-[200px] truncate">{entry.details}</td>
                          <td className="p-2.5 text-slate-700">{entry.payment}</td>
                          <td className="p-2.5 text-slate-600">{entry.designer}</td>
                          <td className="p-2.5 text-slate-600">{entry.printing}</td>
                          <td className={`p-2.5 ${entry.mistakeBy !== '—' ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>{entry.mistakeBy}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-rose-600">{entry.drAmount > 0 ? storageService.formatCurrency(entry.drAmount) : '—'}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-emerald-600">{entry.crAmount > 0 ? storageService.formatCurrency(entry.crAmount) : '—'}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-violet-600">{entry.receivedCredit > 0 ? storageService.formatCurrency(entry.receivedCredit) : '—'}</td>
                          <td className="p-2.5 text-right font-mono font-black text-slate-900">{storageService.formatCurrency(entry.runningBalance || 0)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: MONTHLY SUMMARY */}
      {financialSubTab === 'summary' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h4 className="text-base font-black text-slate-900">
              Financial Summary {financialLedgerMonth ? `— ${formatMonthName(financialLedgerMonth)}` : '(All Periods)'}
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">Summary of opening balance, revenue, expenses and net cashflow.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="text-xs font-black uppercase text-slate-500 tracking-wider">Accounting Breakdown</div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1 border-b border-slate-200">
                  <span className="text-slate-600 font-medium">Opening Balance (Brought Forward)</span>
                  <span className="font-mono font-bold text-slate-800">{storageService.formatCurrency(ledgerData.periodOpeningBalance)}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200">
                  <span className="text-blue-700 font-medium">(+) Total Job Income</span>
                  <span className="font-mono font-bold text-blue-700">{storageService.formatCurrency(ledgerData.totalJobIncome)}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200">
                  <span className="text-violet-700 font-medium">(+) Received Credit Settlements</span>
                  <span className="font-mono font-bold text-violet-700">{storageService.formatCurrency(ledgerData.totalReceivedCredit)}</span>
                </div>
                <div className="flex items-center justify-between py-1 border-b border-slate-200">
                  <span className="text-rose-700 font-medium">(-) Total Expenses</span>
                  <span className="font-mono font-bold text-rose-700">{storageService.formatCurrency(ledgerData.totalExpenses)}</span>
                </div>
                <div className="flex items-center justify-between py-2 font-black text-sm bg-indigo-50/50 px-2 rounded-lg text-indigo-950">
                  <span>(=) Closing / Net Balance</span>
                  <span className="font-mono text-indigo-700">{storageService.formatCurrency(ledgerData.netCash)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="text-xs font-black uppercase text-slate-500 tracking-wider">Period Transaction Counts</div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Total Jobs In Period</span>
                  <span className="font-bold text-slate-900">{ledgerData.allEntries.filter(e => e.type === 'job').length} jobs</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Total Expenses Recorded</span>
                  <span className="font-bold text-slate-900">{ledgerData.allEntries.filter(e => e.type === 'expense').length} expenses</span>
                </div>
                <div className="flex items-center justify-between py-1.5 border-b border-slate-100">
                  <span className="text-slate-600">Credit Payments Received</span>
                  <span className="font-bold text-slate-900">{ledgerData.allEntries.filter(e => e.type === 'payment').length} payments</span>
                </div>
                <div className="flex items-center justify-between py-1.5">
                  <span className="text-slate-600">Active Designers</span>
                  <span className="font-bold text-indigo-600">{ledgerData.designers.length} designers</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: EXPENSES */}
      {financialSubTab === 'expenses' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-black text-slate-900">Period Expenses</h4>
              <p className="text-[11px] text-slate-500">Expenses recorded for the selected financial month.</p>
            </div>
            <div className="text-xs font-black font-mono text-rose-700">
              Total: {storageService.formatCurrency(ledgerData.totalExpenses)}
            </div>
          </div>
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 sticky top-0 z-10 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Expense</th>
                  <th className="p-2.5">Category</th>
                  <th className="p-2.5">Vendor</th>
                  <th className="p-2.5">Payment Status</th>
                  <th className="p-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledgerData.allEntries.filter(e => e.type === 'expense').length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400 font-medium">No expenses recorded for this period.</td>
                  </tr>
                ) : (
                  ledgerData.allEntries.filter(e => e.type === 'expense').map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-700">{(storageService as any).formatDateForMode(exp.date, settings.dateMode)}</td>
                      <td className="p-2.5 font-bold text-slate-900">{exp.details}</td>
                      <td className="p-2.5 text-slate-600">{exp.jobNo}</td>
                      <td className="p-2.5 text-slate-600">{exp.partyName}</td>
                      <td className="p-2.5 text-slate-600">{exp.payment}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-rose-600">{storageService.formatCurrency(exp.drAmount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: RECEIVED CREDIT */}
      {financialSubTab === 'credit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h4 className="text-sm font-black text-slate-900">Received Credit Collections</h4>
              <p className="text-[11px] text-slate-500">Payments collected against previous credit jobs.</p>
            </div>
            <div className="text-xs font-black font-mono text-violet-700">
              Total: {storageService.formatCurrency(ledgerData.totalReceivedCredit)}
            </div>
          </div>
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 sticky top-0 z-10 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Date</th>
                  <th className="p-2.5">Reference</th>
                  <th className="p-2.5">Client</th>
                  <th className="p-2.5">Payment Method</th>
                  <th className="p-2.5">Note</th>
                  <th className="p-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledgerData.allEntries.filter(e => e.type === 'payment').length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-slate-400 font-medium">No received credit settlements for this period.</td>
                  </tr>
                ) : (
                  ledgerData.allEntries.filter(e => e.type === 'payment').map(pay => (
                    <tr key={pay.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-700">{(storageService as any).formatDateForMode(pay.date, settings.dateMode)}</td>
                      <td className="p-2.5 font-mono font-bold text-indigo-600">{pay.jobNo}</td>
                      <td className="p-2.5 font-bold text-slate-900">{pay.partyName}</td>
                      <td className="p-2.5 text-slate-600">{pay.payment}</td>
                      <td className="p-2.5 text-slate-600">{pay.details}</td>
                      <td className="p-2.5 text-right font-mono font-bold text-violet-600">{storageService.formatCurrency(pay.receivedCredit)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-TAB 5: OPENING BALANCE */}
      {financialSubTab === 'opening' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6 max-w-xl">
          <div className="border-b border-slate-100 pb-4">
            <h4 className="text-base font-black text-slate-900">Opening Balance</h4>
            <p className="text-xs text-slate-500 mt-0.5">Set the baseline cash & bank balances brought forward before starting system records.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
              <div className="text-[10px] font-bold uppercase text-slate-400">Cash Balance</div>
              <div className="text-xl font-black font-mono text-slate-800">
                {storageService.formatCurrency(settings.openingCashBalance == null ? Number(settings.openingBalance || 0) : Number(settings.openingCashBalance || 0))}
              </div>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
              <div className="text-[10px] font-bold uppercase text-slate-400">Bank Balance</div>
              <div className="text-xl font-black font-mono text-slate-800">
                {storageService.formatCurrency(settings.openingBankBalance == null ? 0 : Number(settings.openingBankBalance || 0))}
              </div>
            </div>
          </div>

          {isEditingOpeningBalance ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const cashVal = parseFloat(openingBalanceInput);
                const bankVal = parseFloat(openingBankBalanceInput);
                const openingCashBalance = isNaN(cashVal) ? 0 : cashVal;
                const openingBankBalance = isNaN(bankVal) ? 0 : bankVal;
                storageService.saveSettings({
                  ...settings,
                  openingBalance: openingCashBalance + openingBankBalance,
                  openingCashBalance,
                  openingBankBalance
                });
                setSettings(storageService.getSettings());
                setIsEditingOpeningBalance(false);
                triggerFeedback('✓ Opening balance updated successfully!');
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Cash Opening Balance (Rs.)</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={openingBalanceInput}
                  onChange={(e) => setOpeningBalanceInput(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-mono font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Bank Opening Balance (Rs.)</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={openingBankBalanceInput}
                  onChange={(e) => setOpeningBankBalanceInput(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-mono font-bold"
                />
              </div>
              <p className="text-[11px] text-slate-400">Cash transactions adjust Cash balance. Online and Bank transactions adjust Bank balance.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditingOpeningBalance(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm cursor-pointer"
                >
                  Save Balance
                </button>
              </div>
            </form>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => {
                  setOpeningBalanceInput(String(settings.openingCashBalance == null ? Number(settings.openingBalance || 0) : Number(settings.openingCashBalance || 0)));
                  setOpeningBankBalanceInput(String(settings.openingBankBalance == null ? 0 : Number(settings.openingBankBalance || 0)));
                  setIsEditingOpeningBalance(true);
                }}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white hover:bg-indigo-700 shadow-sm transition-all cursor-pointer"
              >
                Edit Opening Balance
              </button>
            </div>
          )}
        </div>
      )}

      {/* Export Modal */}
      {financialExportModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[.16em] text-indigo-600">Financial Ledger PDF Export</div>
                <h3 className="mt-1 text-lg font-black text-slate-900">Export Financial Ledger</h3>
              </div>
              <button type="button" onClick={() => setFinancialExportModal(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); generateFinancialLedgerExport(); }} className="space-y-4 p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">From ({financialExportModal.dateMode})</span>
                  <input
                    type={financialExportModal.dateMode === 'BS' ? 'text' : 'date'}
                    required
                    value={financialExportModal.fromInput}
                    onChange={(e) => setFinancialExportModal({ ...financialExportModal, fromInput: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-[10px] font-bold uppercase text-slate-500">To ({financialExportModal.dateMode})</span>
                  <input
                    type={financialExportModal.dateMode === 'BS' ? 'text' : 'date'}
                    required
                    value={financialExportModal.toInput}
                    onChange={(e) => setFinancialExportModal({ ...financialExportModal, toInput: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
                  />
                </label>
              </div>
              {financialExportModal.error && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-bold text-rose-700">
                  {financialExportModal.error}
                </div>
              )}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setFinancialExportModal(null)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-600">Cancel</button>
                <button type="submit" disabled={financialExportModal.isWorking} className="rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50">
                  {financialExportModal.isWorking ? 'Generating…' : 'Generate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {financialLedgerPreview && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4">
          <div className="flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>Financial Ledger & Balance Sheet Preview</span>
                  {archivedCloudinaryUrl && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Archived to Cloudinary
                    </span>
                  )}
                </h3>
                <p className="mt-0.5 truncate text-[10px] font-semibold text-slate-500">{financialLedgerPreview.filename}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Download to local device */}
                <a
                  href={financialLedgerPreview.url}
                  download={financialLedgerPreview.filename}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Save PDF to Device</span>
                </a>

                {/* 2. Archive to Cloudinary */}
                <button
                  type="button"
                  disabled={isArchivingLedger}
                  onClick={async () => {
                    if (!financialLedgerPreview.blob) {
                      alert('PDF data not available for upload.');
                      return;
                    }
                    setIsArchivingLedger(true);
                    try {
                      const targetMonth = financialLedgerPreview.fromDate?.slice(0, 7) || new Date().toISOString().slice(0, 7);
                      const res = await apiService.uploadMonthlyLedger(financialLedgerPreview.blob, {
                        month: targetMonth,
                        title: `Financial Ledger ${financialLedgerPreview.filename}`,
                        periodStart: financialLedgerPreview.fromDate,
                        periodEnd: financialLedgerPreview.toDate,
                      });
                      setArchivedCloudinaryUrl(res.report?.cloudinaryPdfUrl || 'Saved');
                      triggerFeedback('✓ Financial Ledger archived to Cloudinary!');
                    } catch (err: any) {
                      alert(`Cloudinary archival failed: ${err.message}`);
                    } finally {
                      setIsArchivingLedger(false);
                    }
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 transition-colors cursor-pointer ${isArchivingLedger ? 'opacity-60 pointer-events-none' : ''}`}
                >
                  <Cloud className="h-4 w-4 text-emerald-600" />
                  <span>{isArchivingLedger ? 'Archiving to Cloudinary…' : 'Backup to Cloudinary'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setFinancialLedgerPreview(null);
                    setArchivedCloudinaryUrl(null);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
            <iframe src={financialLedgerPreview.url} title="Financial ledger PDF preview" className="min-h-0 flex-1 bg-slate-100" />
          </div>
        </div>
      )}
    </div>
  );
};

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(storageService.getSettings());
  const [profileTopic, setProfileTopic] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState<boolean>(false);
  const [annualStatusList, setAnnualStatusList] = useState<any[]>(storageService.getAnnualBackupStatus());

  const customers = storageService.getCustomers();
  const orders = storageService.getOrders();
  const team = storageService.getTeam();
  const totalIncome = storageService.getTotalIncome();

  const activeClientsCount = customers.filter(c => !c.isProfileAccount).length;

  const topics = [
    { id: 'business-profile', title: 'Business Profile', desc: 'Manage your business information and contact details.', icon: Building2, badge: settings.shopName || 'Print Ghar' },
    { id: 'financial', title: 'Financial Settings', desc: 'View your financial summary and manage ledger settings.', icon: Wallet },
    { id: 'numbering', title: 'Invoice & Job Numbering', desc: 'Configure how invoice and job numbers are generated.', icon: Receipt, badge: `${settings.invoicePrefix || 'INV-'} / ${settings.jobPrefix || 'JOB-'}` },
    { id: 'whatsapp', title: 'WhatsApp Settings', desc: 'Manage WhatsApp message sending and templates.', icon: MessageSquare, badge: settings.whatsappNotificationsEnabled !== false ? 'Connected' : 'Disabled' },
    { id: 'team', title: 'Team Management', desc: 'Manage team members, roles and permissions.', icon: Users, badge: `${team.length} Members` },
    { id: 'branding', title: 'Branding & Theme', desc: 'Customize store branding and appearance.', icon: Sparkles, badge: settings.appearance === 'dark' ? 'Dark Mode' : 'Light Mode' },
    { id: 'date-appearance', title: 'Date & Appearance', desc: 'Set date format, time zone, currency and language.', icon: Calendar, badge: settings.dateMode === 'BS' ? 'BS (नेपाली मिति)' : 'AD (Gregorian)' },
    { id: 'reports-archive', title: 'Reports & Archive', desc: 'View daily reports and manage archived data.', icon: Clock, badge: `${orders.length} Orders` },
    { id: 'data-safety', title: 'Backup & Cloud Lifecycle', desc: 'Download 1-year annual backups and manage Cloudinary storage.', icon: Download, badge: 'Cloud & Local' }
  ];

  const currentTopicObj = topics.find(t => t.id === profileTopic);

  const triggerFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3000);
  };

  // 1. MAIN LANDING TOPIC LIST
  if (!profileTopic) {
    return (
      <div className="profile-landing-page space-y-6 max-w-5xl mx-auto animate-fade-in p-2 sm:p-4 lg:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Profile & Business Settings
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
              Manage your business information, system settings and preferences.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs transition-all cursor-pointer"
            >
              <Keyboard className="w-4 h-4 text-slate-500" />
              <span>Keyboard Shortcuts</span>
            </button>
          </div>
        </div>

        {/* Quick Shop Summary Bar */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white font-black text-xl flex items-center justify-center shadow-xs shrink-0 overflow-hidden">
              {settings.shopLogo ? (
                <img src={settings.shopLogo} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                'PG'
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold text-slate-900">{settings.shopName || 'Print Ghar'}</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                {settings.businessCategory || 'Wholesale Printing Platform'} • Owner: {settings.ownerName || 'Rabin Bista'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-bold text-slate-600 border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0">
            <div className="text-center sm:text-right">
              <div className="text-[10px] uppercase font-bold text-slate-400">Team</div>
              <div className="font-black text-slate-900">{team.length} Members</div>
            </div>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="text-center sm:text-right">
              <div className="text-[10px] uppercase font-bold text-slate-400">Orders</div>
              <div className="font-black text-slate-900">{orders.length} Total</div>
            </div>
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />
            <div className="text-center sm:text-right">
              <div className="text-[10px] uppercase font-bold text-slate-400">Clients</div>
              <div className="font-black text-slate-900">{activeClientsCount} Active</div>
            </div>
          </div>
        </div>

        {/* Topic List */}
        <div className="space-y-3">
          <div className="text-xs font-black uppercase tracking-wider text-slate-400 px-1">Settings Categories</div>
          <div className="grid grid-cols-1 gap-3">
            {topics.map((t) => {
              const TopicIcon = t.icon;
              return (
                <div
                  key={t.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setProfileTopic(t.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setProfileTopic(t.id); } }}
                  className="group bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md p-4 sm:p-5 flex items-center justify-between gap-4 transition-all duration-150 cursor-pointer shadow-2xs"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white flex items-center justify-center shrink-0 transition-colors shadow-2xs">
                      <TopicIcon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="text-sm sm:text-base font-black text-slate-900 group-hover:text-indigo-600 transition-colors">
                          {t.title}
                        </h3>
                        {t.badge && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 group-hover:bg-indigo-50 group-hover:text-indigo-700 transition-colors truncate max-w-[180px]">
                            {t.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-slate-500 mt-0.5 truncate">{t.desc}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-slate-400 group-hover:text-indigo-600 transition-colors pl-2">
                    <span className="text-xs font-bold hidden sm:inline text-slate-400 group-hover:text-indigo-600">Configure</span>
                    <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // 2. DEDICATED TOPIC VIEW
  const CurrentIcon = currentTopicObj?.icon || Building2;

  return (
    <div className="profile-topic-page max-w-7xl mx-auto animate-fade-in p-2 sm:p-4 lg:p-6 space-y-6">
      {/* Breadcrumb and Back Navigation */}
      <div className="space-y-3 pb-2 border-b border-slate-200">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setProfileTopic(null)}
            className="inline-flex items-center gap-2 text-xs font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Profile & Business</span>
          </button>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <span>Settings</span>
            <span>/</span>
            <span className="text-slate-600">Profile & Business</span>
            <span>/</span>
            <span className="font-black text-indigo-600">{currentTopicObj?.title}</span>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-1">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <CurrentIcon className="w-6 h-6 text-indigo-600" />
              <span>{currentTopicObj?.title}</span>
            </h1>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{currentTopicObj?.desc}</p>
          </div>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-black flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Main Topic Content Container */}
      <div className="space-y-6">
        {/* TOPIC 1: BUSINESS PROFILE */}
          {profileTopic === 'business-profile' && (
            <div className="space-y-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const target = e.currentTarget;
                  storageService.saveSettings({
                    ...settings,
                    shopName: (target.elements.namedItem('shopName') as HTMLInputElement).value.trim() || 'Print Ghar',
                    ownerName: (target.elements.namedItem('ownerName') as HTMLInputElement).value.trim() || 'Rabin Bista',
                    businessCategory: (target.elements.namedItem('businessCategory') as HTMLInputElement).value.trim() || 'Wholesale Printing Platform',
                    shopPhone: (target.elements.namedItem('shopPhone') as HTMLInputElement).value.replace(/\D/g, '') || '9800000000',
                    shopEmail: (target.elements.namedItem('shopEmail') as HTMLInputElement).value.trim() || 'hello@printghar.com',
                    shopAddress: (target.elements.namedItem('shopAddress') as HTMLInputElement).value.trim() || 'Kathmandu, Nepal'
                  });
                  setSettings(storageService.getSettings());
                  triggerFeedback('✓ Business Profile updated successfully!');
                }}
                className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-black text-slate-900">Business Details & Contact</h3>
                    <p className="text-xs text-slate-500 mt-0.5">These details appear on customer invoices, WhatsApp messages and receipts.</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Active
                  </span>
                </div>

                {/* Shop Logo & Cloudinary Hosting */}
                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-14 h-14 rounded-xl border-2 border-slate-200 bg-white flex items-center justify-center overflow-hidden shadow-2xs shrink-0">
                      {settings.shopLogo ? (
                        <img src={settings.shopLogo} alt="Shop Logo" className="w-full h-full object-contain" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        Shop Logo
                        {settings.shopLogo && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">Cloud Hosted</span>}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">Upload your company logo. Hosted on Cloudinary and displayed on invoices & chalans.</p>
                    </div>
                  </div>
                  <label className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-xs font-bold text-indigo-700 cursor-pointer shadow-2xs transition-colors shrink-0 ${isUploadingLogo ? 'opacity-50 pointer-events-none' : ''}`}>
                    <Upload className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{isUploadingLogo ? 'Uploading to Cloudinary…' : 'Upload Logo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isUploadingLogo}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setIsUploadingLogo(true);
                        try {
                          const res = await apiService.uploadLogo(file);
                          const updated = { ...settings, shopLogo: res.url };
                          storageService.saveSettings(updated);
                          setSettings(updated);
                          triggerFeedback('✓ Logo uploaded and saved to Cloudinary!');
                        } catch (err: any) {
                          alert(`Logo upload failed: ${err.message}`);
                        } finally {
                          setIsUploadingLogo(false);
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold uppercase text-slate-600 mb-1">Business Name *</label>
                    <input name="shopName" required defaultValue={settings.shopName || 'Print Ghar'} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-slate-600 mb-1">Category *</label>
                    <input name="businessCategory" required defaultValue={settings.businessCategory || 'Wholesale Printing Platform'} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-slate-600 mb-1">Owner Name *</label>
                    <input name="ownerName" required defaultValue={settings.ownerName || 'Rabin Bista'} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-slate-600 mb-1">Phone Number *</label>
                    <input name="shopPhone" type="tel" required defaultValue={settings.shopPhone || '9800000000'} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-slate-600 mb-1">Email Address</label>
                    <input name="shopEmail" type="email" defaultValue={settings.shopEmail || 'hello@printghar.com'} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block font-bold uppercase text-slate-600 mb-1">Address</label>
                    <input name="shopAddress" defaultValue={settings.shopAddress || 'Kathmandu, Nepal'} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none" />
                  </div>
                </div>

                <div className="flex justify-end pt-3 border-t border-slate-100">
                  <button type="submit" className="px-6 py-2.5 rounded-xl bg-indigo-600 text-xs font-black text-white hover:bg-indigo-700 shadow-sm transition-all cursor-pointer">
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TOPIC 2: FINANCIAL SETTINGS */}
          {profileTopic === 'financial' && (
            <FinancialSettingsTopic
              settings={settings}
              setSettings={setSettings}
              triggerFeedback={triggerFeedback}
            />
          )}

          {/* TOPIC 3: INVOICE & JOB NUMBERING */}
          {profileTopic === 'numbering' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const target = e.currentTarget;
                storageService.saveSettings({
                  ...settings,
                  invoicePrefix: (target.elements.namedItem('invoicePrefix') as HTMLInputElement).value.trim() || 'INV-',
                  jobPrefix: (target.elements.namedItem('jobPrefix') as HTMLInputElement).value.trim() || 'JOB-'
                });
                setSettings(storageService.getSettings());
                triggerFeedback('✓ Numbering prefixes updated successfully!');
              }}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-black text-slate-900">Invoice & Job Numbering Configuration</h3>
                <p className="text-xs text-slate-500 mt-0.5">Configure prefixes for customer billing invoices and jobs.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">Invoice Prefix</label>
                  <input name="invoicePrefix" required defaultValue={settings.invoicePrefix || 'INV-'} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-mono font-bold" />
                </div>
                <div className="p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/50 space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-indigo-600">Next Invoice Preview</span>
                  <span className="block text-base font-black font-mono text-indigo-700">{storageService.generateNextInvoiceNumber()}</span>
                </div>
                <div>
                  <label className="block font-bold uppercase text-slate-600 mb-1">Job Prefix</label>
                  <input name="jobPrefix" required defaultValue={settings.jobPrefix || 'JOB-'} className="w-full p-2.5 border border-slate-200 rounded-xl text-sm font-mono font-bold" />
                </div>
                <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Next Job Preview</span>
                  <span className="block text-base font-black font-mono text-slate-800">{storageService.generateNextOrderNumber()}</span>
                </div>
              </div>
              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button type="submit" className="px-6 py-2.5 rounded-xl bg-indigo-600 text-xs font-black text-white hover:bg-indigo-700 shadow-sm transition-all cursor-pointer">
                  Save Prefixes
                </button>
              </div>
            </form>
          )}

          {/* TOPIC 7: DATE & APPEARANCE (GLOBAL TRUTH) */}
          {profileTopic === 'date-appearance' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const target = e.currentTarget;
                const nextMode = (target.elements.namedItem('dateMode') as HTMLSelectElement).value as 'AD' | 'BS';
                storageService.saveSettings({ ...settings, dateMode: nextMode });
                setSettings(storageService.getSettings());
                triggerFeedback(`✓ Global calendar updated to ${nextMode === 'BS' ? 'Bikram Sambat (BS)' : 'Gregorian (AD)'}!`);
              }}
              className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6"
            >
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-black text-slate-900">Date & Regional Preferences</h3>
                <p className="text-xs text-slate-500 mt-0.5">Global calendar mode, currency and regional settings.</p>
              </div>
              <div className="p-4 rounded-xl border-2 border-indigo-200 bg-indigo-50/40 space-y-2">
                <label className="block font-black uppercase text-indigo-900 text-xs">Calendar Mode (Global Source of Truth)</label>
                <select name="dateMode" defaultValue={settings.dateMode || 'AD'} className="w-full p-3 border-2 border-indigo-300 bg-white rounded-xl text-sm font-black text-indigo-950">
                  <option value="BS">Bikram Sambat (BS - नेपाली मिति)</option>
                  <option value="AD">Gregorian Calendar (AD)</option>
                </select>
                <p className="text-[11px] font-semibold text-indigo-700 pt-1">
                  ⚡ All customer profiles, balance sheets, PDF chalans and WhatsApp statements follow this setting automatically.
                </p>
              </div>
              <div className="flex justify-end pt-3 border-t border-slate-100">
                <button type="submit" className="px-6 py-2.5 rounded-xl bg-indigo-600 text-xs font-black text-white hover:bg-indigo-700 shadow-sm transition-all cursor-pointer">
                  Apply Preferences
                </button>
              </div>
            </form>
          )}

          {/* TOPIC 8: BACKUP & DATA SAFETY (1-YEAR CLOUD ROLLOVER & LOCAL DOWNLOAD) */}
          {profileTopic === 'data-safety' && (
            <div className="space-y-6">
              {/* ANNUAL CLOUD BACKUP & LIFECYCLE (1-YEAR ROLLOVER & PURGE) */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase tracking-wider mb-1">
                      <Sparkles className="w-3 h-3" />
                      1-Year Cloud Rollover
                    </div>
                    <h3 className="text-base font-black text-slate-900">Annual Cloud Backup & Storage Lifecycle</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                      After 1 year of monthly financial backups in Cloudinary (12 monthly statements), download the full annual package to your local disk and purge cloud storage to keep Cloudinary free and clean.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAnnualStatusList(storageService.getAnnualBackupStatus())}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Refresh Status
                  </button>
                </div>

                {annualStatusList.length === 0 ? (
                  <div className="p-6 text-center text-xs font-semibold text-slate-400 bg-slate-50 rounded-xl">
                    No annual financial batches recorded yet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {annualStatusList.map((yr: any) => {
                      const isPurged = yr.cloudCleanupStatus === 'PURGED_FROM_CLOUD';
                      const isArchived = yr.isArchivedLocally;
                      const isReady = yr.isReadyForAnnualArchival;

                      return (
                        <div key={yr.year} className={`p-4 rounded-2xl border transition-all ${isReady ? 'border-indigo-300 bg-indigo-50/40 shadow-xs' : 'border-slate-200 bg-slate-50/60'}`}>
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-black text-base text-slate-950">Year {yr.year}</span>
                                <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${isPurged ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isArchived ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : isReady ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                  {isPurged ? '✓ Cloud Purged (Local Archived)' : isArchived ? '📥 Local Archived (Ready to Purge)' : isReady ? '🔔 1-Year Ready for Local Download' : 'Active in Cloud'}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-slate-600 font-semibold">
                                {yr.monthCount} monthly backup{yr.monthCount === 1 ? '' : 's'} recorded • {yr.orderCount} completed jobs • Revenue: {storageService.formatCurrency(yr.totalRevenue)}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <button
                                type="button"
                                onClick={async () => {
                                  await storageService.downloadAnnualBackupPackage(yr.year);
                                  triggerFeedback(`✓ Year ${yr.year} annual backup package downloaded to device!`);
                                  setAnnualStatusList(storageService.getAnnualBackupStatus());
                                }}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black shadow-2xs cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                📥 Download 1-Year Backup
                              </button>
                              {!isPurged ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (window.confirm(`Are you sure you want to purge Year ${yr.year} monthly backups from Cloudinary? Make sure you have downloaded the local backup first.`)) {
                                      await storageService.purgeAnnualCloudBackup(yr.year);
                                      triggerFeedback(`✓ Cloudinary backup storage for Year ${yr.year} purged.`);
                                      setAnnualStatusList(storageService.getAnnualBackupStatus());
                                    }
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-black shadow-2xs cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                  🧹 Purge Cloudinary
                                </button>
                              ) : (
                                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                                  ✓ Cloud Storage Cleaned
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
  );
};
