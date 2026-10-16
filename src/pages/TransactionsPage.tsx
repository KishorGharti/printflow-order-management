import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { storageService } from '../services/storageService';
import { apiService } from '../services/apiService';
import { Order, FinancialLedgerData } from '../types';
import {
  ArrowLeftRight,
  Download,
  FileSpreadsheet,
  Cloud,
  CheckCircle2,
  Calendar,
  Search,
  RotateCcw,
  Eye,
  X,
  TrendingUp,
  Wallet,
  Receipt
} from 'lucide-react';

interface TransactionsPageProps {
  onOpenOrder: (order: Order) => void;
}

type DatePreset = 'today' | 'yesterday' | 'week' | 'month' | 'last_month' | 'last_30_days' | 'year' | 'all' | 'custom';

const EMPTY_LEDGER_DATA: FinancialLedgerData = {
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
};

export const TransactionsPage: React.FC<TransactionsPageProps> = ({ onOpenOrder }) => {
  const settings = storageService.getSettings();
  const dateMode = settings.dateMode || 'AD';

  // Helper to get formatted date string for today/ranges
  const getTodayAD = () => new Date().toISOString().split('T')[0];

  const getPresetRange = (preset: DatePreset): { fromDate: string; toDate: string } => {
    const today = new Date();
    const todayStr = getTodayAD();

    if (preset === 'today') {
      return { fromDate: todayStr, toDate: todayStr };
    }

    if (preset === 'yesterday') {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      const yestStr = yest.toISOString().split('T')[0];
      return { fromDate: yestStr, toDate: yestStr };
    }

    if (preset === 'week') {
      const d = new Date(today);
      const day = d.getDay(); // 0 is Sunday
      const diff = d.getDate() - day; // start of week (Sunday)
      const start = new Date(d.setDate(diff));
      return { fromDate: start.toISOString().split('T')[0], toDate: todayStr };
    }

    if (preset === 'month') {
      if (dateMode === 'BS') {
        const bsDigits = (storageService as any).getADandBSDate(todayStr).bs.replace(' BS', ''); // e.g. "2083-06-21"
        const bsMonthStart = `${bsDigits.slice(0, 8)}01`;
        const fromAD = storageService.dateInputToADForMode(bsMonthStart, 'BS');
        return { fromDate: fromAD || `${todayStr.slice(0, 8)}01`, toDate: todayStr };
      } else {
        const monthStart = `${todayStr.slice(0, 8)}01`;
        return { fromDate: monthStart, toDate: todayStr };
      }
    }

    if (preset === 'last_month') {
      if (dateMode === 'BS') {
        const bsDigits = (storageService as any).getADandBSDate(todayStr).bs.replace(' BS', '');
        const parts = bsDigits.split('-');
        let year = parseInt(parts[0], 10);
        let month = parseInt(parts[1], 10) - 1;
        if (month < 1) { month = 12; year -= 1; }
        const startBs = `${year}-${String(month).padStart(2, '0')}-01`;
        const endBs = `${year}-${String(month).padStart(2, '0')}-30`;
        const fromAD = storageService.dateInputToADForMode(startBs, 'BS');
        const toAD = storageService.dateInputToADForMode(endBs, 'BS');
        return { fromDate: fromAD || '', toDate: toAD || '' };
      } else {
        const prevMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const prevMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
        return {
          fromDate: prevMonth.toISOString().split('T')[0],
          toDate: prevMonthEnd.toISOString().split('T')[0]
        };
      }
    }

    if (preset === 'last_30_days') {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      return { fromDate: d.toISOString().split('T')[0], toDate: todayStr };
    }

    if (preset === 'year') {
      const yearStart = `${today.getFullYear()}-01-01`;
      return { fromDate: yearStart, toDate: todayStr };
    }

    return { fromDate: '', toDate: '' };
  };

  const initialRange = getPresetRange('month');

  // Filter States
  const [activePreset, setActivePreset] = useState<DatePreset>('month');
  const [fromDate, setFromDate] = useState<string>(initialRange.fromDate);
  const [toDate, setToDate] = useState<string>(initialRange.toDate);

  // Input states for BS or manual edits
  const [fromInput, setFromInput] = useState<string>(
    storageService.dateInputValueForMode(initialRange.fromDate, dateMode)
  );
  const [toInput, setToInput] = useState<string>(
    storageService.dateInputValueForMode(initialRange.toDate, dateMode)
  );

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'JOB' | 'EXPENSE' | 'STOCKING' | 'PAYMENT' | 'CREDIT_PAID'>('ALL');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('ALL');
  const [designerFilter, setDesignerFilter] = useState<string>('ALL');

  // Export / Preview States
  const [pdfPreview, setPdfPreview] = useState<{ url: string; filename: string; blob?: Blob; fromDate?: string; toDate?: string } | null>(null);
  const [isArchiving, setIsArchiving] = useState<boolean>(false);
  const [archivedCloudinaryUrl, setArchivedCloudinaryUrl] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  // Async Ledger Data & Loading States
  const [ledgerData, setLedgerData] = useState<FinancialLedgerData>(EMPTY_LEDGER_DATA);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  const triggerFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Preset Selector Handler
  const handleSelectPreset = (preset: DatePreset) => {
    setActivePreset(preset);
    if (preset === 'all') {
      setFromDate('');
      setToDate('');
      setFromInput('');
      setToInput('');
      return;
    }
    const range = getPresetRange(preset);
    setFromDate(range.fromDate);
    setToDate(range.toDate);
    setFromInput(storageService.dateInputValueForMode(range.fromDate, dateMode));
    setToInput(storageService.dateInputValueForMode(range.toDate, dateMode));
  };

  // Custom Input Change Handler
  const handleApplyCustomDates = () => {
    setActivePreset('custom');
    const adFrom = dateMode === 'BS' ? storageService.dateInputToADForMode(fromInput, 'BS') : fromInput;
    const adTo = dateMode === 'BS' ? storageService.dateInputToADForMode(toInput, 'BS') : toInput;
    setFromDate(adFrom);
    setToDate(adTo);
  };

  // Fetch Ledger Data Asynchronously from MongoDB
  const fetchLedger = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await storageService.getFinancialLedgerData({
        fromDate,
        toDate,
        search: searchQuery,
        typeFilter,
        paymentMethodFilter,
        designerFilter,
        dateMode
      });
      setLedgerData(data);
    } catch (err: any) {
      console.error('[TransactionsPage] Error loading ledger data:', err);
      setError(err.message || 'Unable to load financial transactions. Please check your internet connection and try again.');
    } finally {
      setIsLoading(false);
    }
  }, [fromDate, toDate, searchQuery, typeFilter, paymentMethodFilter, designerFilter, dateMode, reloadKey]);

  useEffect(() => {
    fetchLedger();
  }, [fetchLedger]);

  // Handle PDF Export
  const handleDownloadPdf = async () => {
    try {
      const generated = await storageService.createFinancialLedgerPdf({
        fromDate: fromDate || '2020-01-01',
        toDate: toDate || getTodayAD(),
        typeFilter,
        designerFilter,
        search: searchQuery,
        dateMode
      });
      const url = URL.createObjectURL(generated.blob);
      setPdfPreview({ ...generated, url });
    } catch (err: any) {
      alert(err.message || 'Unable to generate financial PDF statement.');
    }
  };

  // Direct Save PDF
  const handleDirectSavePdf = async () => {
    try {
      const generated = await storageService.createFinancialLedgerPdf({
        fromDate: fromDate || '2020-01-01',
        toDate: toDate || getTodayAD(),
        typeFilter,
        designerFilter,
        search: searchQuery,
        dateMode
      });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(generated.blob);
      link.download = generated.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      triggerFeedback(`✓ Downloaded ${generated.filename}`);
    } catch (err: any) {
      alert(err.message || 'Unable to download PDF statement.');
    }
  };

  // Handle CSV Export
  const handleExportCsv = async () => {
    try {
      const res = await storageService.exportFinancialLedgerCSV({
        fromDate,
        toDate,
        typeFilter,
        paymentMethodFilter,
        designerFilter,
        search: searchQuery,
        dateMode
      });
      triggerFeedback(`✓ Exported ${res.filename}`);
    } catch (err: any) {
      alert(err.message || 'Unable to export CSV.');
    }
  };

  // Cloudinary Backup
  const handleArchiveCloudinary = async (blobToUpload?: Blob, filename?: string) => {
    setIsArchiving(true);
    try {
      let targetBlob = blobToUpload;
      let targetName = filename;
      if (!targetBlob) {
        const generated = await storageService.createFinancialLedgerPdf({
          fromDate: fromDate || '2020-01-01',
          toDate: toDate || getTodayAD(),
          dateMode
        });
        targetBlob = generated.blob;
        targetName = generated.filename;
      }
      const targetMonth = fromDate?.slice(0, 7) || new Date().toISOString().slice(0, 7);
      const res = await apiService.uploadMonthlyLedger(targetBlob, {
        month: targetMonth,
        title: `Financial Ledger ${targetName || ''}`,
        periodStart: fromDate,
        periodEnd: toDate
      });
      setArchivedCloudinaryUrl(res.report?.cloudinaryPdfUrl || 'Saved');
      triggerFeedback('✓ Financial Ledger successfully archived to Cloudinary!');
    } catch (err: any) {
      alert(`Cloudinary archival failed: ${err.message}`);
    } finally {
      setIsArchiving(false);
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setTypeFilter('ALL');
    setPaymentMethodFilter('ALL');
    setDesignerFilter('ALL');
    handleSelectPreset('month');
  };

  // Date Range Display Text
  const dateRangeDisplay = useMemo(() => {
    if (!fromDate && !toDate) return 'All Recorded Transactions (All Time)';
    const fromStr = fromDate ? storageService.formatDateForMode(fromDate, dateMode) : 'Beginning';
    const toStr = toDate ? storageService.formatDateForMode(toDate, dateMode) : 'Present';
    return `${fromStr}  →  ${toStr}`;
  }, [fromDate, toDate, dateMode]);

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Toast Feedback Notification */}
      {feedbackMsg && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 text-white text-xs font-bold rounded-2xl shadow-2xl border border-slate-700 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0 animate-pulse" />
            <span className="text-xs font-bold text-rose-800">{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey(k => k + 1)}
            className="self-end sm:self-auto px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-2xs transition-all cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white p-6 sm:p-7 rounded-3xl shadow-xl border border-slate-800">
        <div className="space-y-1.5 min-w-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full text-xs font-bold text-indigo-300 border border-white/10 mb-1">
            <ArrowLeftRight className="w-3.5 h-3.5 text-indigo-400" />
            <span>Financial Audit & Accounting Trail</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-3">
            <span>All Transactions</span>
            <span className="text-xs font-bold px-2.5 py-1 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              {dateMode === 'BS' ? 'BS (नेपाली मिति)' : 'AD (Gregorian)'}
            </span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 font-medium">
            Active Period: <span className="font-bold text-amber-300">{dateRangeDisplay}</span> · {ledgerData.visibleEntries.length} transactions shown
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 lg:pt-0">
          {/* 1. Direct PDF Download */}
          <button
            type="button"
            onClick={handleDirectSavePdf}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black shadow-md hover:shadow-lg transition-all cursor-pointer"
            title="Download formatted multi-page PDF statement to your computer"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>

          {/* 2. Export CSV */}
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 shadow-sm transition-all cursor-pointer"
            title="Export full transaction dataset to Excel/CSV"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          {/* 3. PDF Preview & Print */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 shadow-sm transition-all cursor-pointer"
            title="View interactive PDF preview and print"
          >
            <Eye className="w-4 h-4 text-sky-400" />
            <span>Preview Statement</span>
          </button>

          {/* 4. Cloud Backup */}
          <button
            type="button"
            disabled={isArchiving}
            onClick={() => handleArchiveCloudinary()}
            className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-200 text-xs font-bold border border-emerald-700 shadow-sm transition-all cursor-pointer ${isArchiving ? 'opacity-50 pointer-events-none' : ''}`}
            title="Archive this statement to Cloudinary storage"
          >
            <Cloud className="w-4 h-4 text-emerald-400" />
            <span>{isArchiving ? 'Archiving…' : 'Backup to Cloud'}</span>
          </button>
        </div>
      </div>

      {/* Date Range Selection & Preset Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              Filter By Date Range
            </span>
            <div className="text-sm font-bold text-slate-800 mt-0.5">
              Select a quick preset or choose custom From Date and To Date
            </div>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'week', label: 'This Week' },
              { id: 'month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'last_30_days', label: 'Last 30 Days' },
              { id: 'year', label: 'This Year' },
              { id: 'all', label: 'All Time' }
            ].map((preset) => {
              const isSelected = activePreset === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleSelectPreset(preset.id as DatePreset)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Inline From & To Date Pickers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-3 items-end pt-2 border-t border-slate-100">
          <div className="lg:col-span-4">
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              From Date ({dateMode})
            </label>
            <input
              type={dateMode === 'BS' ? 'text' : 'date'}
              value={fromInput}
              onChange={(e) => setFromInput(e.target.value)}
              placeholder={dateMode === 'BS' ? 'YYYY-MM-DD (BS)' : 'YYYY-MM-DD'}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50/50"
            />
          </div>

          <div className="lg:col-span-4">
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
              To Date ({dateMode})
            </label>
            <input
              type={dateMode === 'BS' ? 'text' : 'date'}
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              placeholder={dateMode === 'BS' ? 'YYYY-MM-DD (BS)' : 'YYYY-MM-DD'}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-slate-50/50"
            />
          </div>

          <div className="lg:col-span-4 flex items-center gap-2">
            <button
              type="button"
              onClick={handleApplyCustomDates}
              className="flex-1 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
            >
              Apply Date Filter
            </button>
            <button
              type="button"
              onClick={handleResetFilters}
              className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-2xs transition-all cursor-pointer"
              title="Reset all filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Financial KPI Summary Cards (Live Calculations for the Selected Range) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Opening Balance */}
        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-slate-400">
            <span>Opening Balance</span>
            <span className="w-2 h-2 rounded-full bg-slate-400" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-slate-800">
            {storageService.formatCurrency(ledgerData.periodOpeningBalance)}
          </div>
          <div className="text-[10px] text-slate-400 truncate">Brought forward</div>
        </div>

        {/* Card 2: Job Income */}
        <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/30 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-blue-700">
            <span>Job Sales Income</span>
            <span className="w-2 h-2 rounded-full bg-blue-500" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-blue-700">
            {storageService.formatCurrency(ledgerData.totalJobIncome)}
          </div>
          <div className="text-[10px] text-blue-600 truncate">Immediate sales cash</div>
        </div>

        {/* Card 3: Received Credit */}
        <div className="p-4 rounded-2xl border border-violet-200 bg-violet-50/30 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-violet-700">
            <span>Received Credit</span>
            <span className="w-2 h-2 rounded-full bg-violet-500" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-violet-700">
            {storageService.formatCurrency(ledgerData.totalReceivedCredit)}
          </div>
          <div className="text-[10px] text-violet-600 truncate">Old credit collections</div>
        </div>

        {/* Card 4: Expenses */}
        <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/30 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-rose-700">
            <span>Total Expenses</span>
            <span className="w-2 h-2 rounded-full bg-rose-500" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-rose-700">
            {storageService.formatCurrency(ledgerData.totalExpenses)}
          </div>
          <div className="text-[10px] text-rose-600 truncate">Shop costs & bills</div>
        </div>

        {/* Card 5: Total Inflow vs Outflow */}
        <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/30 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-amber-800">
            <span>Period Inflow</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-lg sm:text-xl font-black font-mono text-emerald-700">
            {storageService.formatCurrency(ledgerData.totalInflow)}
          </div>
          <div className="text-[10px] text-rose-600 truncate">Outflow: {storageService.formatCurrency(ledgerData.totalOutflow)}</div>
        </div>

        {/* Card 6: Net Balance */}
        <div className="p-4 rounded-2xl border-2 border-indigo-300 bg-indigo-50/50 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase text-indigo-900">
            <span>Closing Balance</span>
            <Wallet className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div className={`text-lg sm:text-xl font-black font-mono ${ledgerData.netCash >= 0 ? 'text-indigo-950' : 'text-rose-700'}`}>
            {storageService.formatCurrency(ledgerData.netCash)}
          </div>
          <div className="text-[10px] text-indigo-700 font-bold truncate">Net cash on hand</div>
        </div>
      </div>

      {/* Secondary Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search party name, job #, item details, vendor, designer…"
            className="w-full pl-9 pr-3 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Types</option>
            <option value="JOB">Print Jobs (Income)</option>
            <option value="PAYMENT">Received Credit</option>
            <option value="EXPENSE">Expenses (Outflow)</option>
            <option value="STOCKING">Material Stocking</option>
            <option value="CREDIT_PAID">Credit Paid Out</option>
          </select>

          {/* Payment Method */}
          <select
            value={paymentMethodFilter}
            onChange={(e) => setPaymentMethodFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Payments</option>
            <option value="Cash">Cash</option>
            <option value="Online">Online / Bank</option>
            <option value="Credit">Credit</option>
          </select>

          {/* Designer Filter */}
          <select
            value={designerFilter}
            onChange={(e) => setDesignerFilter(e.target.value)}
            className="px-3 py-2 border border-slate-200 rounded-xl text-xs font-bold bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="ALL">All Designers</option>
            {ledgerData.designers.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 14-Column Full Financial Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto max-h-[640px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-900 sticky top-0 z-10 text-[10px] font-bold text-slate-300 uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-3 text-center w-10">S.N.</th>
                <th className="p-3 whitespace-nowrap">Date</th>
                <th className="p-3 whitespace-nowrap">Ready Date</th>
                <th className="p-3 whitespace-nowrap">Job / Ref #</th>
                <th className="p-3 min-w-[150px]">Party Name</th>
                <th className="p-3 min-w-[200px]">Details / Items</th>
                <th className="p-3 whitespace-nowrap">Payment</th>
                <th className="p-3 whitespace-nowrap">Designer</th>
                <th className="p-3 whitespace-nowrap">Printing</th>
                <th className="p-3 whitespace-nowrap">Mistake By</th>
                <th className="p-3 text-right text-rose-400 whitespace-nowrap">Dr Amount</th>
                <th className="p-3 text-right text-emerald-400 whitespace-nowrap">Cr Amount</th>
                <th className="p-3 text-right text-violet-400 whitespace-nowrap">Received Credit</th>
                <th className="p-3 text-right text-white whitespace-nowrap">Running Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={14} className="text-center py-16 text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs font-bold text-slate-600">Loading financial transactions from database…</p>
                    </div>
                  </td>
                </tr>
              ) : ledgerData.visibleEntries.length === 0 ? (
                <tr>
                  <td colSpan={14} className="text-center py-16 text-slate-400 font-medium">
                    <div className="max-w-md mx-auto space-y-2">
                      <Receipt className="w-8 h-8 mx-auto text-slate-300" />
                      <p className="font-bold text-slate-600">No financial transactions found for this date range.</p>
                      <p className="text-xs text-slate-400">Try selecting &quot;All Time&quot; or changing your filters.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                ledgerData.visibleEntries.map((entry, idx) => {
                  const isExp = entry.type === 'expense' || entry.type === 'credit-paid';
                  const isPay = entry.type === 'payment';
                  const isJob = entry.type === 'job';
                  const isStock = entry.type === 'stocking';

                  // If it's a job, link to open the Order
                  const rawOrderId = isJob && entry.id.startsWith('job-') ? entry.id.replace('job-', '') : null;
                  const matchedOrder = rawOrderId ? storageService.getOrderById(rawOrderId) : null;

                  return (
                    <tr
                      key={entry.id}
                      className={`hover:bg-indigo-50/30 transition-colors ${
                        isExp ? 'bg-rose-50/15' : isPay ? 'bg-violet-50/15' : isStock ? 'bg-amber-50/15' : ''
                      }`}
                    >
                      <td className="p-3 text-center font-mono text-slate-400">{idx + 1}</td>
                      <td className="p-3 font-bold text-slate-800 whitespace-nowrap">
                        {storageService.formatDateForMode(entry.date, dateMode)}
                      </td>
                      <td className="p-3 text-slate-500 whitespace-nowrap">
                        {entry.readyDate && entry.readyDate !== '—'
                          ? storageService.formatDateForMode(entry.readyDate, dateMode)
                          : '—'}
                      </td>
                      <td className="p-3 font-mono font-bold whitespace-nowrap">
                        {matchedOrder ? (
                          <button
                            type="button"
                            onClick={() => onOpenOrder(matchedOrder)}
                            className="text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1 font-black cursor-pointer"
                            title="Click to view order details"
                          >
                            <span>{entry.jobNo}</span>
                            <Eye className="w-3 h-3 text-indigo-400" />
                          </button>
                        ) : (
                          <span className={isExp ? 'text-rose-600' : isPay ? 'text-violet-600' : 'text-slate-700'}>
                            {entry.jobNo}
                          </span>
                        )}
                      </td>
                      <td className="p-3 font-bold text-slate-900 max-w-[180px] truncate" title={entry.partyName}>
                        {entry.partyName}
                      </td>
                      <td className="p-3 text-slate-600 max-w-[240px] truncate" title={entry.details}>
                        {entry.details}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                            entry.payment === 'Cash'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : entry.payment === 'Online'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : entry.payment === 'Credit'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {entry.payment}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">{entry.designer}</td>
                      <td className="p-3 text-slate-600 whitespace-nowrap">{entry.printing}</td>
                      <td className={`p-3 whitespace-nowrap ${entry.mistakeBy !== '—' ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                        {entry.mistakeBy}
                      </td>

                      {/* Dr Amount */}
                      <td className="p-3 text-right font-mono font-bold text-rose-600 whitespace-nowrap">
                        {entry.drAmount > 0 ? storageService.formatCurrency(entry.drAmount) : '—'}
                      </td>

                      {/* Cr Amount */}
                      <td className="p-3 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                        {entry.crAmount > 0 ? storageService.formatCurrency(entry.crAmount) : '—'}
                      </td>

                      {/* Received Credit */}
                      <td className="p-3 text-right font-mono font-bold text-violet-600 whitespace-nowrap">
                        {entry.receivedCredit > 0 ? storageService.formatCurrency(entry.receivedCredit) : '—'}
                      </td>

                      {/* Running Balance */}
                      <td className="p-3 text-right font-mono font-black text-slate-900 whitespace-nowrap bg-slate-50/50">
                        {storageService.formatCurrency(entry.runningBalance || 0)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {ledgerData.visibleEntries.length > 0 && (
              <tfoot className="bg-slate-100 font-black text-xs text-slate-900 border-t-2 border-slate-300">
                <tr>
                  <td colSpan={10} className="p-3 text-right uppercase tracking-wider text-slate-600 font-bold">
                    Period Totals:
                  </td>
                  <td className="p-3 text-right font-mono text-rose-700 whitespace-nowrap">
                    {storageService.formatCurrency(ledgerData.totalOutflow)}
                  </td>
                  <td className="p-3 text-right font-mono text-emerald-700 whitespace-nowrap">
                    {storageService.formatCurrency(ledgerData.totalInflow)}
                  </td>
                  <td className="p-3 text-right font-mono text-violet-700 whitespace-nowrap">
                    {storageService.formatCurrency(ledgerData.totalReceivedCredit)}
                  </td>
                  <td className="p-3 text-right font-mono text-indigo-950 whitespace-nowrap text-sm">
                    {storageService.formatCurrency(ledgerData.netCash)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* PDF Statement Preview Modal */}
      {pdfPreview && (
        <div className="fixed inset-0 z-[125] flex items-center justify-center bg-slate-950/70 p-2 backdrop-blur-sm sm:p-4">
          <div className="flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between bg-slate-50">
              <div className="min-w-0">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <span>Financial Statement Preview ({dateMode})</span>
                  {archivedCloudinaryUrl && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                      Archived to Cloudinary
                    </span>
                  )}
                </h3>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">
                  {pdfPreview.filename}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Save PDF to Device */}
                <a
                  href={pdfPreview.url}
                  download={pdfPreview.filename}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-2xs hover:bg-indigo-700 transition-colors"
                >
                  <Download className="h-4 w-4" />
                  <span>Save PDF to Device</span>
                </a>

                {/* 2. Archive to Cloudinary */}
                <button
                  type="button"
                  disabled={isArchiving}
                  onClick={() => handleArchiveCloudinary(pdfPreview.blob, pdfPreview.filename)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs hover:bg-emerald-100 transition-colors cursor-pointer ${
                    isArchiving ? 'opacity-60 pointer-events-none' : ''
                  }`}
                >
                  <Cloud className="h-4 w-4 text-emerald-600" />
                  <span>{isArchiving ? 'Archiving…' : 'Backup to Cloudinary'}</span>
                </button>

                {/* 3. Close */}
                <button
                  type="button"
                  onClick={() => {
                    setPdfPreview(null);
                    setArchivedCloudinaryUrl(null);
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
            <iframe
              src={pdfPreview.url}
              title="Financial Statement PDF Preview"
              className="min-h-0 flex-1 bg-slate-100"
            />
          </div>
        </div>
      )}
    </div>
  );
};
